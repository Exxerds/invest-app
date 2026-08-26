// ============================================================
//  WebRTC calling.
//
//  Audio (and an optional screen share) travels peer-to-peer; only
//  the handshake goes through our API. Signalling is polled rather
//  than socket-based because the API runs on serverless functions.
//
//  Roles:
//    manager    — places the call, creates the offer
//    client     — answers it
//    supervisor — joins a live call in WHISPER mode: heard by the
//                 manager, never by the client (PDF p.5)
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  apiIceServers,
  apiPostSignal,
  apiPostSignals,
  apiReadSignals,
  apiCallStatus,
  apiUploadRecording,
  TOKEN_KEY,
} from '../api';

export type CallRole = 'manager' | 'client' | 'supervisor';
export type CallPhase = 'idle' | 'connecting' | 'active' | 'ended' | 'failed';

interface Options {
  callId: number | null;
  role: CallRole;
  /** Start the handshake (the caller does, the callee waits for an offer) */
  initiator: boolean;
  /**
   * 'main'    — manager <-> client
   * 'whisper' — manager <-> supervisor, a separate connection so the
   *             client never receives the supervisor's audio
   */
  channel?: 'main' | 'whisper';
  onEnded?: () => void;
}

export function useWebRTCCall({ callId, role, initiator, channel = 'main', onEnded }: Options) {
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [muted, setMuted] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Non-fatal notice (e.g. no microphone → listen-only mode) */
  const [warning, setWarning] = useState<string | null>(null);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  /** A local microphone track is present */
  const [micAvailable, setMicAvailable] = useState(true);
  /** The other side is actually sending a video (screen share) */
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lastSignalRef = useRef(0);
  const pollAbortRef = useRef<AbortController | null>(null);
  const negotiatingRef = useRef(false);
  const outgoingSignalsRef = useRef<{ kind: string; payload: string; role: string }[]>([]);
  const outgoingTimerRef = useRef<number | null>(null);
  /**
   * ICE candidates often arrive BEFORE the remote description is applied;
   * feeding them to addIceCandidate at that moment throws and the candidate
   * is lost forever — which is exactly what makes P2P fail behind
   * non-trivial NATs (office networks, VPN). Queue them and flush once the
   * description is in place.
   */
  const iceQueueRef = useRef<RTCIceCandidate[]>([]);
  /** True from the moment this side ended the call server-side */
  const endedSentRef = useRef(false);
  /** Guards the screen-share toggle against the track's own "ended" event */
  const sharingRef = useRef(false);
  const disconnectTimerRef = useRef<number | null>(null);

  const flushIceQueue = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    const queue = iceQueueRef.current;
    iceQueueRef.current = [];
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        /* stale candidate — drop it */
      }
    }
  }, []);

  /** Tear everything down — safe to call twice. */
  const cleanup = useCallback(() => {
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;
    if (outgoingTimerRef.current) {
      clearTimeout(outgoingTimerRef.current);
      outgoingTimerRef.current = null;
    }
    outgoingSignalsRef.current = [];
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    if (recorderRef.current?.state === 'recording') {
      // stop() fires onstop, which uploads whatever was captured
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    recStreamRef.current = null;
    localRef.current?.getTracks().forEach(t => t.stop());
    screenRef.current?.getTracks().forEach(t => t.stop());
    localRef.current = null;
    screenRef.current = null;
    remoteStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    iceQueueRef.current = [];
    lastSignalRef.current = 0;
    negotiatingRef.current = false;
    sharingRef.current = false;
  }, []);

  const hangUp = useCallback(async () => {
    endedSentRef.current = true;
    if (callId && channel === 'main') {
      // A supervisor leaving must not end the conversation for everyone
      try {
        await apiCallStatus(callId, 'ended');
      } catch {
        /* the call is over locally regardless */
      }
    }
    cleanup();
    setPhase('ended');
    setSharingScreen(false);
    setRecording(false);
    setNeedsAudioUnlock(false);
    setHasRemoteVideo(false);
    onEnded?.();
  }, [callId, channel, cleanup, onEnded]);

  /**
   * Closing the tab, killing the browser or reloading the page skips the
   * red button — without this the call would sit "active" on the server
   * forever and the other side's panel would hang. keepalive fetch is the
   * only way to ship a request with headers out of a dying page.
   */
  useEffect(() => {
    if (!callId || channel !== 'main') return;
    const end = () => {
      if (endedSentRef.current) return;
      endedSentRef.current = true;
      fetch(`/api/calls/${callId}/status`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ''}`,
        },
        body: JSON.stringify({ status: 'ended' }),
      }).catch(() => undefined);
    };
    window.addEventListener('pagehide', end);
    window.addEventListener('beforeunload', end);
    return () => {
      window.removeEventListener('pagehide', end);
      window.removeEventListener('beforeunload', end);
      // Do NOT call end() on unmount — React re-render / inbox tick
      // that sets activeCall=null would otherwise end the call
      // prematurely and delete signals (client ICE missing bug).
    };
  }, [callId, channel]);

  /** Human-friendly explanation for the most common "it just fails" cases. */
  const describeMediaError = (err: unknown): string => {
    if (err instanceof DOMException) {
      switch (err.name) {
        case 'NotAllowedError':
          return 'Microphone access was blocked. Click the lock icon left of the address bar → ' +
            'Site settings → Microphone → Allow, also check the OS microphone privacy settings. Then press Retry.';
        case 'NotFoundError':
        case 'OverconstrainedError':
          return 'No microphone was found on this device.';
        case 'NotReadableError':
          return 'The microphone is busy in another app — close it and press Retry.';
        default:
          break;
      }
    }
    return err instanceof Error && err.message ? err.message : 'Could not start the call.';
  };

  /** Open the microphone, build the peer connection and start polling. */
  const connect = useCallback(async () => {
    if (!callId || pcRef.current) return;
    setError(null);
    setWarning(null);
    setNeedsAudioUnlock(false);
    setMicAvailable(true);
    setPhase('connecting');

    if (!window.isSecureContext) {
      cleanup();
      endedSentRef.current = true;
      void apiCallStatus(callId, 'ended').catch(() => undefined);
      setPhase('failed');
      setError('Voice calls need a secure connection (HTTPS or localhost). ' +
        'Open the site via its HTTPS address.');
      return;
    }

    try {
      const { iceServers, turnConfigured } = await apiIceServers();
      const pc = new RTCPeerConnection({
        iceServers,
        iceCandidatePoolSize: 8,
        // In production force the proven TURN relay. This avoids a flaky
        // direct candidate being selected on a strict NAT and then dropping
        // the call after the initial handshake. Local development still uses
        // direct ICE when no TURN credentials are configured.
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
      });
      pcRef.current = pc;
      let restartAttempts = 0;
      let restartInFlight = false;

      const flushOutgoingSignals = async () => {
        if (!callId || !outgoingSignalsRef.current.length || !pcRef.current) return;
        const batch = outgoingSignalsRef.current.splice(0, 64);
        try {
          await apiPostSignals(callId, batch, channel);
        } catch {
          outgoingSignalsRef.current.unshift(...batch);
          if (!outgoingTimerRef.current && pcRef.current) {
            outgoingTimerRef.current = window.setTimeout(() => {
              outgoingTimerRef.current = null;
              void flushOutgoingSignals();
            }, 300);
          }
        }
        if (outgoingSignalsRef.current.length && !outgoingTimerRef.current && pcRef.current) {
          outgoingTimerRef.current = window.setTimeout(() => {
            outgoingTimerRef.current = null;
            void flushOutgoingSignals();
          }, 90);
        }
      };

      const queueSignal = (signal: { kind: string; payload: string; role: string }) => {
        outgoingSignalsRef.current.push(signal);
        if (!outgoingTimerRef.current) {
          outgoingTimerRef.current = window.setTimeout(() => {
            outgoingTimerRef.current = null;
            void flushOutgoingSignals();
          }, 90);
        }
      };

      const restartIce = async () => {
        if (!initiator || restartInFlight || restartAttempts >= 3 || !pcRef.current) return false;
        restartInFlight = true;
        restartAttempts += 1;
        try {
          const offer = await pc.createOffer({ iceRestart: true });
          await pc.setLocalDescription(offer);
          await apiPostSignal(callId, 'offer', JSON.stringify(pc.localDescription), role, channel);
          if (restartAttempts < 3) {
            window.setTimeout(() => {
              if (pcRef.current === pc && pc.connectionState !== 'connected') void restartIce();
            }, 2500);
          }
          return true;
        } catch {
          return false;
        } finally {
          restartInFlight = false;
        }
      };

      /**
       * The microphone is NOT mandatory. Laptops without a built-in mic (or
       * with it disabled) used to kill the call instantly with
       * "No microphone was found on this device". Now we continue as
       * listen-only: a bare audio transceiver keeps the audio media line
       * in the offer, so the remote voice still reaches us.
       */
      let mic: MediaStream | null = null;
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch (err) {
        if (!(err instanceof DOMException && (err.name === 'NotFoundError' || err.name === 'OverconstrainedError'))) {
          throw err; // blocked / busy — a real error, fail as before
        }
        setMicAvailable(false);
        setWarning('No microphone on this device — listen-only: you can hear the other side, ' +
          'but they cannot hear you. Connect a headset or use a phone to talk.');
      }
      if (mic) {
        localRef.current = mic;
        mic.getTracks().forEach(t => pc.addTrack(t, mic));
      } else {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
      }

      pc.ontrack = (e) => {
        // Some browsers deliver a track WITHOUT a bundled MediaStream
        // (most notably a screen-share track). Fabricate one so the
        // <video> element always gets a renderable srcObject instead of
        // a black rectangle.
        const stream = e.streams[0] || new MediaStream([e.track]);
        remoteStreamRef.current = stream;
        // A track arriving means media is actually flowing — mark the call
        // active even if the connection-state handlers have not fired yet.
        setPhase('active');
        if (e.track.kind === 'video') {
          setHasRemoteVideo(true);
          e.track.onended = () => setHasRemoteVideo(false);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
        } else if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch(() => setNeedsAudioUnlock(true));
          // Recording started before the remote audio arrived? Add it now
          // so the file contains both voices.
          if (recStreamRef.current) recStreamRef.current.addTrack(e.track);
        }
      };

      pc.onicecandidate = event => {
        if (event.candidate) {
          queueSignal({
            kind: 'ice',
            payload: JSON.stringify(event.candidate),
            role,
          });
        }
      };

      /**
       * ICE state is the most reliable "the audio is flowing" signal: it
       * reaches `connected`/`completed` even on networks where the aggregate
       * connection state lingers. Listen here as well so the call timer
       * starts promptly.
       */
      pc.oniceconnectionstatechange = () => {
        if (
          pc.iceConnectionState === 'connected' ||
          pc.iceConnectionState === 'completed'
        ) {
          if (disconnectTimerRef.current) {
            clearTimeout(disconnectTimerRef.current);
            disconnectTimerRef.current = null;
          }
          setPhase('active');
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          if (disconnectTimerRef.current) {
            clearTimeout(disconnectTimerRef.current);
            disconnectTimerRef.current = null;
          }
          setPhase('active');
        } else if (pc.connectionState === 'failed') {
          if (initiator && restartAttempts < 3) {
            void restartIce();
            return;
          }
          setError('Connection failed — both sides could not reach each other. ' +
            'Try again, or connect over a different network.');
          void hangUp();
        } else if (pc.connectionState === 'disconnected') {
          // A short dip usually recovers by itself; if it does not, end the
          // call server-side instead of leaving both docks hanging.
          if (!disconnectTimerRef.current) {
            disconnectTimerRef.current = window.setTimeout(() => {
              disconnectTimerRef.current = null;
              if (pcRef.current?.connectionState === 'disconnected' || pcRef.current === null) {
                setError('The connection was lost.');
                void hangUp();
              }
            }, 45000);
          }
        }
      };

      if (initiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await apiPostSignal(callId, 'offer', JSON.stringify(pc.localDescription), role, channel);
      }

      // One long-poll loop replaces overlapping interval requests. The cursor
      // advances only after each signal has been handled, so ICE cannot be
      // lost between two polls.
      const pollSignals = async () => {
        while (pcRef.current === pc) {
          const controller = new AbortController();
          pollAbortRef.current = controller;
          try {
            const result = await apiReadSignals(callId, lastSignalRef.current, channel, {
              wait: 25_000,
              signal: controller.signal,
            });
            for (const signal of result.signals.sort((a, b) => a.id - b.id)) {
              if (signal.id <= lastSignalRef.current) continue;
              const data = JSON.parse(signal.payload);

              if (signal.kind === 'offer') {
                // Rolling back first lets a re-offer (including ICE restart or
                // screen sharing) succeed without dropping the call.
                if (pc.signalingState !== 'stable') {
                  await pc.setLocalDescription({ type: 'rollback' });
                }
                await pc.setRemoteDescription(new RTCSessionDescription(data));
                await flushIceQueue();
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await apiPostSignal(callId, 'answer', JSON.stringify(pc.localDescription), role, channel);
                if (role === 'client') await apiCallStatus(callId, 'active');
              } else if (signal.kind === 'answer') {
                if (pc.signalingState === 'have-local-offer') {
                  await pc.setRemoteDescription(new RTCSessionDescription(data));
                  await flushIceQueue();
                  setPhase('active');
                }
              } else if (signal.kind === 'ice') {
                const candidate = new RTCIceCandidate(data);
                if (!pc.remoteDescription) {
                  iceQueueRef.current.push(candidate);
                } else {
                  try {
                    await pc.addIceCandidate(candidate);
                  } catch {
                    /* stale candidate — drop it */
                  }
                }
              } else if (signal.kind === 'bye') {
                await hangUp();
              }
              lastSignalRef.current = Math.max(lastSignalRef.current, signal.id);
            }
            // The server cursor also includes our own signals. Skipping those
            // is safe and prevents scanning the same mailbox forever.
            lastSignalRef.current = Math.max(lastSignalRef.current, result.lastId);
          } catch {
            if (controller.signal.aborted) return;
            await new Promise(resolve => window.setTimeout(resolve, 250));
          } finally {
            if (pollAbortRef.current === controller) pollAbortRef.current = null;
          }
        }
      };
      void pollSignals();
    } catch (err) {
      cleanup();
      setPhase('failed');
      setError(describeMediaError(err));
      // The call cannot continue without our microphone — tell the server
      // so the other side is not left waiting on a ringing call forever.
      endedSentRef.current = true;
      if (channel === 'main') {
        void apiCallStatus(callId, 'ended').catch(() => undefined);
      }
    }
  }, [callId, role, initiator, channel, cleanup, hangUp, flushIceQueue]);

  const enableAudio = useCallback(async () => {
    try {
      await remoteAudioRef.current?.play();
      setNeedsAudioUnlock(false);
    } catch {
      setWarning('Click Enable sound in the call window to start the remote audio.');
    }
  }, []);

  const toggleMute = useCallback(() => {
    const track = localRef.current?.getAudioTracks()[0];
    if (!track) {
      setWarning('Nothing to mute — no microphone track on this device.');
      return;
    }
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }, []);

  const renegotiate = useCallback(async (pc: RTCPeerConnection) => {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await apiPostSignal(callId!, 'offer', JSON.stringify(pc.localDescription), role, channel);
  }, [callId, role, channel]);

  const stopScreenShare = useCallback(async () => {
    if (!sharingRef.current) return;
    sharingRef.current = false;

    const pc = pcRef.current;
    const id = callId;
    screenRef.current?.getTracks().forEach(t => {
      t.onended = null;
      t.stop();
    });
    screenRef.current = null;
    if (pc) {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) pc.removeTrack(sender);
      negotiatingRef.current = true;
      try {
        await renegotiate(pc);
      } catch {
        /* the call itself is still alive */
      } finally {
        negotiatingRef.current = false;
      }
    }
    setSharingScreen(false);
    if (id) {
      await apiCallStatus(id, 'active', { screenShare: false }).catch(() => undefined);
    }
  }, [callId, renegotiate]);

  const stopShareRef = useRef(stopScreenShare);
  stopShareRef.current = stopScreenShare;

  const toggleScreenShare = useCallback(async () => {
    if (sharingScreen || sharingRef.current) {
      void stopShareRef.current();
      return;
    }

    const pc = pcRef.current;
    if (!pc || !callId || negotiatingRef.current) return;

    if (typeof navigator.mediaDevices?.getDisplayMedia !== 'function') {
      setError('Screen sharing is not supported in this browser ' +
        '(iPhone Safari has no screen sharing; on Android use Chrome).');
      return;
    }

    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenRef.current = screen;
      const [track] = screen.getVideoTracks();
      pc.addTrack(track, screen);
      sharingRef.current = true;
      track.onended = () => { void stopShareRef.current(); };

      negotiatingRef.current = true;
      try {
        await renegotiate(pc);
      } finally {
        negotiatingRef.current = false;
      }

      setSharingScreen(true);
      await apiCallStatus(callId, 'active', { screenShare: true }).catch(() => undefined);
    } catch {
      /* the user simply cancelled the picker */
    }
  }, [sharingScreen, callId, renegotiate]);

  const toggleRecording = useCallback(async () => {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    const local = localRef.current;
    const remote = remoteStreamRef.current;
    if (!callId) return;

    const tracks = [
      ...(local ? local.getAudioTracks() : []),
      ...(remote ? remote.getAudioTracks() : []),
    ];
    if (!tracks.length) {
      setError('Nothing to record yet — no audio tracks in the call.');
      return;
    }

    try {
      const stream = new MediaStream(tracks);
      recStreamRef.current = stream;
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
        .find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t));
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        if (!chunksRef.current.length) return;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          apiUploadRecording(callId, String(reader.result)).catch(() => undefined);
        };
        reader.readAsDataURL(blob);
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError('Recording is not supported in this browser.');
    }
  }, [recording, callId]);

  useEffect(() => cleanup, [cleanup]);

  return {
    phase, error, warning, needsAudioUnlock, muted, micAvailable,
    sharingScreen, recording, hasRemoteVideo,
    remoteAudioRef, remoteVideoRef, peerConnectionRef: pcRef,
    connect, hangUp, enableAudio, toggleMute, toggleScreenShare, toggleRecording,
  };
}