// @ts-nocheck
// ============================================================
// LiveKit calling — replacement for P2P when LIVEKIT_URL is set
// Supports: audio, screen share, whisper (separate room), recording via Egress
// Falls back to P2P if LiveKit not configured
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  createLocalScreenTracks,
  LocalTrackPublication,
} from 'livekit-client';
import type { Track as TrackType, RemoteParticipant, LocalTrack } from 'livekit-client';
import { apiCallStatus, apiUploadRecording, TOKEN_KEY } from '../api';

export type CallRole = 'manager' | 'client' | 'supervisor';
export type CallPhase = 'idle' | 'connecting' | 'active' | 'ended' | 'failed';

interface Options {
  callId: number | null;
  role: CallRole;
  channel?: 'main' | 'whisper';
  onEnded?: () => void;
}

export function useLiveKitCall({ callId, role, channel = 'main', onEnded }: Options) {
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [muted, setMuted] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const [micAvailable, setMicAvailable] = useState(true);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  // The room can be connected while the other participant is still ringing.
  // Keep this separate so the UI timer starts only after both sides are in it.
  const [remoteParticipantConnected, setRemoteParticipantConnected] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const pendingRemoteAudioRef = useRef<TrackType[]>([]);
  const localAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const cleanup = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    recorderRef.current = null;
    try {
      roomRef.current?.disconnect();
    } catch {}
    roomRef.current = null;
    localAudioTrackRef.current = null;
    screenTrackRef.current = null;
    pendingRemoteAudioRef.current = [];
    setSharingScreen(false);
    setHasRemoteVideo(false);
    setRemoteParticipantConnected(false);
  }, []);

  const hangUp = useCallback(async () => {
    cleanup();
    if (callId && channel === 'main') {
      try {
        await apiCallStatus(callId, 'ended');
      } catch {}
    }
    setPhase('ended');
    onEnded?.();
  }, [callId, channel, cleanup, onEnded]);

  const connect = useCallback(async () => {
    if (!callId || roomRef.current) return;
    setError(null);
    setWarning(null);
    setPhase('connecting');

    try {
      // Get LiveKit token from backend
      const tokenRes = await fetch(`/api/calls/${callId}/livekit-token?channel=${channel}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ''}` },
      });
      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        throw new Error(err.error || 'LiveKit not configured');
      }
      const { url, token } = await tokenRes.json();

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      const syncRemoteParticipant = () => {
        setRemoteParticipantConnected(room.remoteParticipants.size > 0);
      };

      const attachRemoteAudio = (track: TrackType) => {
        const audio = remoteAudioRef.current;
        if (!audio) {
          if (!pendingRemoteAudioRef.current.includes(track)) pendingRemoteAudioRef.current.push(track);
          return;
        }
        pendingRemoteAudioRef.current = pendingRemoteAudioRef.current.filter(item => item !== track);
        audio.autoplay = true;
        audio.playsInline = true;
        audio.muted = false;
        audio.volume = 1;
        (track as any).attach(audio);
        audio.play().then(() => setNeedsAudioUnlock(false)).catch(() => setNeedsAudioUnlock(true));
      };

      room.on(RoomEvent.ParticipantConnected, syncRemoteParticipant);
      room.on(RoomEvent.ParticipantDisconnected, syncRemoteParticipant);

      // LiveKit can connect the room before the audio element is ready, so
      // retain subscribed tracks and attach them on the next user gesture.
      room.on(RoomEvent.AudioPlaybackStatusChanged, (playing: boolean) => {
        if (!playing) setNeedsAudioUnlock(true);
      });

      // Remote tracks
      room.on(RoomEvent.TrackSubscribed, (track: TrackType, _pub: any, participant: RemoteParticipant) => {
        setRemoteParticipantConnected(true);
        // Whisper filtering: client must not hear supervisor
        if (channel === 'main' && role === 'client' && participant.identity.includes('supervisor')) {
          return;
        }
        if (track.kind === Track.Kind.Video) {
          setHasRemoteVideo(true);
          if (remoteVideoRef.current) {
            (track as any).attach(remoteVideoRef.current);
          }
          track.on('ended', () => setHasRemoteVideo(false));
        } else if (track.kind === Track.Kind.Audio) {
          attachRemoteAudio(track);
        }
        setPhase('active');
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: TrackType) => {
        (track as any).detach();
        pendingRemoteAudioRef.current = pendingRemoteAudioRef.current.filter(item => item !== track);
        if (track.kind === Track.Kind.Video) setHasRemoteVideo(false);
      });

      room.on(RoomEvent.Disconnected, () => {
        setRemoteParticipantConnected(false);
        setPhase('ended');
        onEnded?.();
      });

      room.on(RoomEvent.ConnectionStateChanged, (state: any) => {
        if (state === 'connected') setPhase('active');
      });

      await room.connect(url, token);
      // A caller is connected to the SFU before the client accepts. Check
      // the remote participant here in case they joined just before us.
      syncRemoteParticipant();

      // Publish local audio (mic) — optional
      try {
        const audioTrack = await createLocalAudioTrack();
        await room.localParticipant.publishTrack(audioTrack);
        localAudioTrackRef.current = audioTrack.mediaStreamTrack;
        setMicAvailable(true);
      } catch (err) {
        if (err instanceof DOMException && (err.name === 'NotFoundError' || err.name === 'OverconstrainedError')) {
          setMicAvailable(false);
          setWarning('No microphone — listen-only: you can hear the other side, but they cannot hear you.');
        } else {
          throw err;
        }
      }

      // For client, mark call active
      if (role === 'client' && channel === 'main') {
        await apiCallStatus(callId, 'active').catch(() => {});
      }

      setPhase('active');
    } catch (err) {
      cleanup();
      setPhase('failed');
      setError(err instanceof Error ? err.message : 'Could not connect via LiveKit');
      if (channel === 'main') {
        try {
          await apiCallStatus(callId!, 'ended');
        } catch {}
      }
    }
  }, [callId, role, channel, cleanup, onEnded]);

  const enableAudio = useCallback(async () => {
    try {
      const room = roomRef.current as any;
      // Mobile browsers may block LiveKit's audio pipeline until a user
      // gesture explicitly starts playback.
      if (room?.startAudio) await room.startAudio();
      const audio = remoteAudioRef.current;
      if (audio) {
        audio.autoplay = true;
        audio.playsInline = true;
        audio.muted = false;
        audio.volume = 1;
        for (const track of pendingRemoteAudioRef.current) (track as any).attach(audio);
        pendingRemoteAudioRef.current = [];
        await audio.play();
      }
      setNeedsAudioUnlock(false);
    } catch {
      setWarning('Click Enable sound to start remote audio.');
    }
  }, []);

  const toggleMute = useCallback(() => {
    const track = localAudioTrackRef.current;
    if (!track) {
      setWarning('No microphone track.');
      return;
    }
    // LiveKit track mute
    const room = roomRef.current;
    if (room) {
      const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone) as LocalTrackPublication | undefined;
      if (pub) {
        if (pub.isMuted) {
          pub.unmute();
          setMuted(false);
        } else {
          pub.mute();
          setMuted(true);
        }
        return;
      }
    }
    // Fallback
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    if (sharingScreen) {
      // Stop screen share
      const pub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare) as LocalTrackPublication | undefined;
      if (pub) {
        await room.localParticipant.unpublishTrack(pub.track!);
        pub.track?.stop();
      }
      setSharingScreen(false);
      if (callId) await apiCallStatus(callId, 'active', { screenShare: false }).catch(() => {});
      return;
    }

    try {
      const tracks = await createLocalScreenTracks();
      for (const track of tracks) {
        await room.localParticipant.publishTrack(track);
        if (track.kind === Track.Kind.Video) {
          screenTrackRef.current = track.mediaStreamTrack;
        }
      }
      setSharingScreen(true);
      if (callId) await apiCallStatus(callId, 'active', { screenShare: true }).catch(() => {});
    } catch {
      // user cancelled picker
    }
  }, [sharingScreen, callId]);

  const toggleRecording = useCallback(async () => {
    // For LiveKit, recording is server-side Egress — we keep browser recording as fallback
    // If LiveKit Egress is configured, backend should start it via webhook
    // Here we keep simple browser recording for compatibility
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    if (!callId) return;
    const room = roomRef.current;
    if (!room) return;

    // Collect local + remote audio
    const localStream = new MediaStream();
    room.localParticipant.audioTrackPublications.forEach((pub: any) => {
      if (pub.track) localStream.addTrack(pub.track.mediaStreamTrack);
    });
    room.remoteParticipants.forEach((p: any) => {
      p.audioTrackPublications.forEach((pub: any) => {
        if (pub.track) localStream.addTrack(pub.track.mediaStreamTrack);
      });
    });

    if (localStream.getTracks().length === 0) {
      setError('Nothing to record yet.');
      return;
    }

    try {
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(
        (t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)
      );
      const recorder = mime ? new MediaRecorder(localStream, { mimeType: mime }) : new MediaRecorder(localStream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        if (!chunksRef.current.length) return;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          apiUploadRecording(callId, String(reader.result)).catch(() => {});
        };
        reader.readAsDataURL(blob);
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError('Recording not supported in this browser.');
    }
  }, [recording, callId]);

  useEffect(() => cleanup, [cleanup]);

  // For compatibility with diagnostics hook that expects peerConnectionRef
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  return {
    phase,
    error,
    warning,
    needsAudioUnlock,
    muted,
    micAvailable,
    sharingScreen,
    recording,
    hasRemoteVideo,
    remoteParticipantConnected,
    remoteAudioRef,
    remoteVideoRef,
    peerConnectionRef,
    connect,
    hangUp,
    enableAudio,
    toggleMute,
    toggleScreenShare,
    toggleRecording,
    // LiveKit specific
    roomRef,
  };
}
