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

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lastSignalRef = useRef(0);
  const pollRef = useRef<number | null>(null);
  const negotiatingRef = useRef(false);
  const retryRef = useRef<number | null>(null);

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
    recorderRef.current?.state === 'recording' && recorderRef.current.stop();
    recorderRef.current = null;
    localRef.current?.getTracks().forEach(t => t.stop());
    screenRef.current?.getTracks().forEach(t => t.stop());
    localRef.current = null;
    screenRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    lastSignalRef.current = 0;
    negotiatingRef.current = false;
  }, []);

  const hangUp = useCallback(async () => {
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
    onEnded?.();
  }, [callId, channel, cleanup, onEnded]);

  /** Open the microphone, build the peer connection and start polling. */
  const connect = useCallback(async () => {
    if (!callId || pcRef.current) return;
    setError(null);
    setPhase('connecting');

    try {
      const { iceServers } = await apiIceServers();
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      const mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localRef.current = mic;
      mic.getTracks().forEach(t => pc.addTrack(t, mic));

      pc.ontrack = (e) => {
        const [stream] = e.streams;
        if (e.track.kind === 'video') {
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
        } else if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch(() => undefined);
        }
      };

      pc.onicecandidate = (e) => {
        if (e.candidate && callId) {
          apiPostSignal(callId, 'ice', JSON.stringify(e.candidate), role, channel).catch(() => undefined);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') setPhase('active');
        if (pc.connectionState === 'failed') {
          setPhase('failed');
          setError('Connection failed — the other side may be behind a strict firewall.');
        }
        if (pc.connectionState === 'disconnected') setPhase('ended');
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
              }
            } else if (s.kind === 'ice') {
              try {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(data));
              } catch {
                /* candidates can arrive before the description; harmless */
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
      setError(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow it in the browser and try again.'
          : 'Could not start the call.',
      );
    }
  }, [callId, role, initiator, cleanup, hangUp]);

  const toggleMute = useCallback(() => {
    const track = localRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }, []);

  /** Share the screen over the same connection (PDF p.4). */
  const toggleScreenShare = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !callId) return;

    if (sharingScreen) {
      screenRef.current?.getTracks().forEach(t => t.stop());
      screenRef.current = null;
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) pc.removeTrack(sender);
      setSharingScreen(false);
      await apiCallStatus(callId, 'active', { screenShare: false }).catch(() => undefined);
      return;
    }

    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenRef.current = screen;
      const [track] = screen.getVideoTracks();
      pc.addTrack(track, screen);
      track.onended = () => { void toggleScreenShare(); };

      // Adding a track requires a fresh offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await apiPostSignal(callId, 'offer', JSON.stringify(offer), role, channel);

      setSharingScreen(true);
      await apiCallStatus(callId, 'active', { screenShare: true }).catch(() => undefined);
    } catch {
      /* the user simply cancelled the picker */
    }
  }, [sharingScreen, callId, role]);

  /** Record the conversation locally, then upload it to the call log. */
  const toggleRecording = useCallback(async () => {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    const local = localRef.current;
    if (!local || !callId) return;

    try {
      const recorder = new MediaRecorder(local);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          apiUploadRecording(callId, String(reader.result)).catch(() => undefined);
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError('Recording is not supported in this browser.');
    }
  }, [recording, callId]);

  useEffect(() => cleanup, [cleanup]);

  return {
    phase, error, muted, sharingScreen, recording,
    remoteAudioRef, remoteVideoRef,
    connect, hangUp, toggleMute, toggleScreenShare, toggleRecording,
  };
}
