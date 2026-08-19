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
  const pollRef = useRef<number | null>(null);
  const negotiatingRef = useRef(false);
  const retryRef = useRef<number | null>(null);
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
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (retryRef.current) {
      clearInterval(retryRef.current);
      retryRef.current = null;
    }
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
      // Unmount without an explicit hangUp (navigation, tab close on
      // some browsers) — end the call server-side as well.
      end();
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
      const { iceServers } = await apiIceServers();
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

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
        const [stream] = e.streams;
        remoteStreamRef.current = stream;
        if (e.track.kind === 'video') {
          setHasRemoteVideo(true);
          e.track.onended = () => setHasRemoteVideo(false);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
        } else if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch(() => undefined);
          // Recording started before the remote audio arrived? Add it now
          // so the file contains both voices.
          if (recStreamRef.current) recStreamRef.current.addTrack(e.track);
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate && callId) {
          apiPostSignal(callId, 'ice', JSON.stringify(e.candidate), role, channel).catch(() => undefined);
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
            }, 6000);
          }
        }
      };

      if (initiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await apiPostSignal(callId, 'offer', JSON.stringify(offer), role, channel);

        /**
         * The callee may not have opened the page yet, and a missed offer
         * leaves both sides waiting forever. Re-send it every 4s until the
         * answer lands.
         */
        let tries = 0;
        const retry = window.setInterval(async () => {
          tries += 1;
          const pcNow = pcRef.current;
          if (!pcNow || pcNow.remoteDescription || tries > 15) {
            clearInterval(retry);
            return;
          }
          try {
            await apiPostSignal(callId, 'offer', JSON.stringify(pcNow.localDescription), role, channel);
          } catch {
            /* keep trying */
          }
        }, 4000);
        retryRef.current = retry;
      }

      // Poll for the other side's SDP / ICE
      pollRef.current = window.setInterval(async () => {
        if (!pcRef.current) return;
        try {
          const { signals, lastId } = await apiReadSignals(callId, lastSignalRef.current, channel);
          lastSignalRef.current = Math.max(lastSignalRef.current, lastId);

          for (const s of signals) {
            const data = JSON.parse(s.payload);

            if (s.kind === 'offer') {
              if (negotiatingRef.current) continue;
              negotiatingRef.current = true;
              try {
                // Rolling back first lets a re-offer (screen share) succeed
                if (pcRef.current.signalingState !== 'stable') {
                  await pcRef.current.setLocalDescription({ type: 'rollback' });
                }
                await pcRef.current.setRemoteDescription(new RTCSessionDescription(data));
                await flushIceQueue();
                const answer = await pcRef.current.createAnswer();
                await pcRef.current.setLocalDescription(answer);
                await apiPostSignal(callId, 'answer', JSON.stringify(answer), role, channel);
                if (role === 'client') await apiCallStatus(callId, 'active');
              } finally {
                negotiatingRef.current = false;
              }
            } else if (s.kind === 'answer') {
              if (pcRef.current.signalingState === 'have-local-offer') {
                await pcRef.current.setRemoteDescription(new RTCSessionDescription(data));
                await flushIceQueue();
              }
            } else if (s.kind === 'ice') {
              if (!pcRef.current.remoteDescription) {
                // Too early — queue it, it is flushed after the description
                iceQueueRef.current.push(new RTCIceCandidate(data));
              } else {
                try {
                  await pcRef.current.addIceCandidate(new RTCIceCandidate(data));
                } catch {
                  /* stale candidate — drop it */
                }
              }
            } else if (s.kind === 'bye') {
              await hangUp();
            }
          }
        } catch {
          /* transient network errors are fine, we poll again */
        }
      }, 1200);
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
  }, [callId, role, initiator, cleanup, hangUp, flushIceQueue]);

  const toggleMute = useCallback(() => {
    const track = localRef.current?.getAudioTracks()[0];
    if (!track) {
      setWarning('Nothing to mute — no microphone track on this device.');
      return;
    }
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }, []);

  /**
   * Renegotiate the connection (a fresh offer with the current track set).
   * Both starting and STOPPING a screen share go through this — without
   * the re-offer on stop the other side keeps a frozen screen forever.
   */
  const renegotiate = useCallback(async (pc: RTCPeerConnection) => {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await apiPostSignal(callId!, 'offer', JSON.stringify(offer), role, channel);
  }, [callId, role, channel]);

  /**
   * Stop sharing. Kept as its own stable callback (refs only, no state) so
   * the track's "ended" event can call it without a stale closure —
   * re-invoking the toggle from onended with an old `sharingScreen` state
   * is what used to re-open the OS screen picker by itself.
   */
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

  /** Share the screen over the same connection (PDF p.4). */
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
      // The user can also stop from the OS picker's "Stop sharing" button
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

  /**
   * Record BOTH sides of the conversation: our own mic track plus the
   * remote audio track, merged into one stream. (Recording the local
   * stream alone produced files with only our own voice.)
   */
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
    phase, error, warning, muted, micAvailable,
    sharingScreen, recording, hasRemoteVideo,
    remoteAudioRef, remoteVideoRef,
    connect, hangUp, toggleMute, toggleScreenShare, toggleRecording,
  };
}
