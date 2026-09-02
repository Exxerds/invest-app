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
  /** Automatically record the main staff-to-client call. */
  autoRecord?: boolean;
  /** Supervisor monitor leg listens without publishing back to the main room. */
  publishAudio?: boolean;
  /** Use one hidden audio element per remote track (supervisor monitor). */
  multiAudio?: boolean;
  onEnded?: () => void;
}

export function useLiveKitCall({ callId, role, channel = 'main', autoRecord = false, publishAudio = true, multiAudio = false, onEnded }: Options) {
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [muted, setMuted] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const [micAvailable, setMicAvailable] = useState(true);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [audioPlaybackReady, setAudioPlaybackReady] = useState(false);
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
  const recordStreamRef = useRef<MediaStream | null>(null);
  const multiAudioElementsRef = useRef<Map<any, HTMLAudioElement>>(new Map());
  const chunksRef = useRef<Blob[]>([]);
  /** The manager pressed "Stop recording" — the watchdog must not restart it. */
  const manualStopRef = useRef(false);
  /** A remote audio track has arrived — otherwise the voice is not flowing. */
  const remoteAudioSeenRef = useRef(false);

  const cleanup = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    recorderRef.current = null;
    recordStreamRef.current = null;
    setRecording(false);
    for (const [track, element] of multiAudioElementsRef.current) {
      try { (track as any).detach(element); } catch {}
      element.remove();
    }
    multiAudioElementsRef.current.clear();
    try {
      roomRef.current?.disconnect();
    } catch {}
    roomRef.current = null;
    localAudioTrackRef.current = null;
    screenTrackRef.current = null;
    pendingRemoteAudioRef.current = [];
    setSharingScreen(false);
    setHasRemoteVideo(false);
    setAudioPlaybackReady(false);
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

  const addRecordingTrack = useCallback((track: any) => {
    const native = track?.mediaStreamTrack || track;
    const stream = recordStreamRef.current;
    if (!stream || !native || stream.getTracks().includes(native)) return;
    stream.addTrack(native);
  }, []);

  const startRecording = useCallback(async ({ silent = false, keepChunks = false } = {}) => {
    if (!callId || !roomRef.current || recorderRef.current?.state === 'recording') return false;

    const tracks: MediaStreamTrack[] = [];
    const room = roomRef.current as any;
    room.localParticipant?.audioTrackPublications?.forEach((pub: any) => {
      if (pub.track?.mediaStreamTrack) tracks.push(pub.track.mediaStreamTrack);
    });
    room.remoteParticipants?.forEach((participant: any) => {
      participant.audioTrackPublications?.forEach((pub: any) => {
        if (pub.track?.mediaStreamTrack) tracks.push(pub.track.mediaStreamTrack);
      });
    });

    const uniqueTracks = tracks.filter((track, index) => tracks.indexOf(track) === index);
    if (!uniqueTracks.length) {
      if (!silent) setError('Nothing to record yet — no audio tracks in the call.');
      return false;
    }

    try {
      const stream = new MediaStream(uniqueTracks);
      recordStreamRef.current = stream;
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
        .find(type => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type));
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      // keepChunks: a watchdog restart keeps everything captured so far,
      // so the file uploaded on the final stop is cumulative, not partial.
      if (!keepChunks) chunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        recordStreamRef.current = null;
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
      manualStopRef.current = false;
      setRecording(true);
      return true;
    } catch {
      if (!silent) setError('Recording is not supported in this browser.');
      return false;
    }
  }, [callId]);

  const stopRecording = useCallback(() => {
    manualStopRef.current = true;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    recorderRef.current = null;
    recordStreamRef.current = null;
    setRecording(false);
  }, []);

  const toggleRecording = useCallback(async () => {
    if (recording) {
      stopRecording();
      return;
    }
    await startRecording();
  }, [recording, startRecording, stopRecording]);

  const maybeStartAutoRecording = useCallback(() => {
    if (!autoRecord || role === 'client' || channel !== 'main') return;
    void startRecording({ silent: true, keepChunks: true });
  }, [autoRecord, channel, role, startRecording]);

  /**
   * Watchdog: mobile browsers (and a backgrounded tab) can silently kill
   * the MediaRecorder mid-call, which is why a 16 s call sometimes yields
   * a 5 s file. If the call is still alive but the auto-recorder died —
   * and the manager did NOT stop it manually — restart it, keeping the
   * chunks captured so far (the upload is cumulative).
   */
  useEffect(() => {
    if (!autoRecord || role === 'client' || channel !== 'main') return;
    const check = () => {
      if (manualStopRef.current) return;
      const room = roomRef.current as any;
      if (!room || room.state === 'disconnected' || room.state === 'failed') return;
      const rec = recorderRef.current;
      if (rec && rec.state === 'recording') return; // healthy
      if (rec === null && !recording) return;       // never started — event handlers start it
      void startRecording({ silent: true, keepChunks: true });
    };
    const t = window.setInterval(check, 4000);
    return () => window.clearInterval(t);
  }, [autoRecord, channel, role, recording, startRecording]);

  /**
   * The remote voice must arrive shortly after the call is live. If no
   * remote audio track comes through, the call is silently one-way —
   * typical when a plain proxy/VPN carries the web page but not the
   * voice stream. Say so instead of leaving everyone guessing.
   */
  useEffect(() => {
    if (phase !== 'active') return;
    if (remoteAudioSeenRef.current) return;
    const t = window.setTimeout(() => {
      if (!remoteAudioSeenRef.current) {
        setWarning("The other side's voice is not reaching you. Check the connection — " +
          "a plain proxy carries the page but not the voice stream (use a VPN or a " +
          "direct connection). The other side may also have no microphone.");
      }
    }, 10000);
    return () => window.clearTimeout(t);
  }, [phase]);

  const connect = useCallback(async () => {
    if (!callId || roomRef.current) return;
    setError(null);
    setWarning(null);
    setAudioPlaybackReady(false);
    setPhase('connecting');

    // Browsers refuse to run WebRTC on plain HTTP ("RTCPeerConnection is
    // not allowed") — say exactly that instead of leaking the raw error.
    if (!window.isSecureContext) {
      cleanup();
      setPhase('failed');
      setError('Voice calls need a secure connection (HTTPS). ' +
        'Open the site via its HTTPS address or through a VPN — on plain HTTP ' +
        'the browser blocks the audio engine.');
      if (channel === 'main') {
        try { await apiCallStatus(callId, 'ended'); } catch {}
      }
      return;
    }

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
        let audio = multiAudioElementsRef.current.get(track);
        if (!audio && !multiAudio) audio = remoteAudioRef.current;
        if (!audio && multiAudio) {
          audio = document.createElement('audio');
          audio.autoplay = true;
          audio.playsInline = true;
          audio.style.display = 'none';
          document.body.appendChild(audio);
          multiAudioElementsRef.current.set(track, audio);
        }
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
        audio.play()
          .then(() => {
            setAudioPlaybackReady(true);
            setNeedsAudioUnlock(false);
          })
          .catch(() => {
            setAudioPlaybackReady(false);
            setNeedsAudioUnlock(true);
          });
      };

      room.on(RoomEvent.ParticipantConnected, () => {
        syncRemoteParticipant();
        maybeStartAutoRecording();
      });
      room.on(RoomEvent.ParticipantDisconnected, syncRemoteParticipant);

      // LiveKit can connect the room before the audio element is ready, so
      // retain subscribed tracks and attach them on the next user gesture.
      room.on(RoomEvent.AudioPlaybackStatusChanged, (playing: boolean) => {
        setAudioPlaybackReady(Boolean(playing));
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
          remoteAudioSeenRef.current = true;
          // The supervisor listens to the main room for both voices. Its
          // separate whisper room is publish-only for the supervisor, so the
          // manager's voice is not played twice.
          if (!(role === 'supervisor' && channel === 'whisper')) {
            attachRemoteAudio(track);
          }
          addRecordingTrack(track);
          maybeStartAutoRecording();
        }
        setPhase('active');
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: TrackType) => {
        const audio = multiAudioElementsRef.current.get(track);
        try { (track as any).detach(audio || undefined); } catch {}
        if (audio) {
          audio.remove();
          multiAudioElementsRef.current.delete(track);
        }
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
      maybeStartAutoRecording();

      // For client, mark the call answered as soon as the client has joined
      // the LiveKit room. Do this before microphone setup so a slow/blocked
      // microphone cannot make an answered call appear as missed.
      if (role === 'client' && channel === 'main') {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            await apiCallStatus(callId, 'active');
            break;
          } catch {
            if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
          }
        }
      }

      // The supervisor's main-room monitor is listen-only. The normal
      // manager/client and the separate whisper leg publish their mic.
      if (publishAudio) {
        try {
          const audioTrack = await createLocalAudioTrack();
          await room.localParticipant.publishTrack(audioTrack);
          localAudioTrackRef.current = audioTrack.mediaStreamTrack;
          setMicAvailable(true);
          addRecordingTrack(audioTrack);
          maybeStartAutoRecording();
        } catch (err) {
          if (err instanceof DOMException && (err.name === 'NotFoundError' || err.name === 'OverconstrainedError')) {
            setMicAvailable(false);
            setWarning('No microphone — listen-only: you can hear the other side, but they cannot hear you.');
          } else {
            throw err;
          }
        }
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
  }, [callId, role, channel, publishAudio, multiAudio, cleanup, onEnded, addRecordingTrack, maybeStartAutoRecording]);

  const enableAudio = useCallback(async () => {
    try {
      const room = roomRef.current as any;
      // Mobile browsers may block LiveKit's audio pipeline until a user
      // gesture explicitly starts playback.
      if (room?.startAudio) await room.startAudio();
      const audio = remoteAudioRef.current;
      if (multiAudio) {
        for (const track of pendingRemoteAudioRef.current) {
          let element = multiAudioElementsRef.current.get(track);
          if (!element) {
            element = document.createElement('audio');
            element.autoplay = true;
            element.playsInline = true;
            element.style.display = 'none';
            document.body.appendChild(element);
            multiAudioElementsRef.current.set(track, element);
          }
          element.muted = false;
          element.volume = 1;
          (track as any).attach(element);
          await element.play();
        }
        pendingRemoteAudioRef.current = [];
      } else if (audio) {
        audio.autoplay = true;
        audio.playsInline = true;
        audio.muted = false;
        audio.volume = 1;
        for (const track of pendingRemoteAudioRef.current) (track as any).attach(audio);
        pendingRemoteAudioRef.current = [];
        await audio.play();
      }
      setAudioPlaybackReady(true);
      setNeedsAudioUnlock(false);
    } catch {
      setWarning('Click Enable sound to start remote audio.');
    }
  }, [multiAudio]);

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
    audioPlaybackReady,
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
