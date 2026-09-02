// @ts-nocheck
// ============================================================
//  Live call widgets — Oak Haven brand theme
//  Supports both P2P (fallback) and LiveKit (when configured)
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Phone, PhoneOff, Mic, MicOff, MonitorUp, Circle, Ear, Loader2, GripVertical,
  Maximize2, Minimize2, Activity,
} from 'lucide-react';
import { useWebRTCCall } from '../../hooks/useWebRTCCall';
import { useLiveKitCall } from '../../hooks/useLiveKitCall';
import { useCallDiagnostics } from '../../hooks/useCallDiagnostics';
import { callMediaBus } from '../../hooks/callMediaBus';
import type { CallRole } from '../../hooks/useWebRTCCall';
import type { ApiCall } from '../../api';
import { apiLiveKitConfig } from '../../api';

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const fmtBytes = (n: number) => n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;

let sharedRingtoneContext: AudioContext | null = null;

function ringtoneContext() {
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextCtor) return null;
  sharedRingtoneContext ||= new AudioContextCtor();
  return sharedRingtoneContext;
}

/** Prime the shared audio context from an ordinary user interaction. */
export async function primeCallAudio() {
  const context = ringtoneContext();
  if (!context) return false;
  try {
    if (context.state === 'suspended') await context.resume();
    return context.state === 'running';
  } catch {
    return false;
  }
}

/** A short repeating tone for the client-side incoming-call prompt. */
function useIncomingRingtone(enabled: boolean) {
  const contextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const [blocked, setBlocked] = useState(false);

  const ringOnce = useCallback(async () => {
    if (!ringtoneContext()) {
      setBlocked(true);
      return;
    }

    try {
      const context = contextRef.current || ringtoneContext();
      contextRef.current = context;
      // A page may receive a call while hidden or before a user gesture.
      // Mark the control as blocked immediately so the client always gets a
      // visible Enable ringtone button instead of a silent prompt.
      if (context.state === 'suspended') setBlocked(true);
      if (context.state === 'suspended') await context.resume();
      if (context.state !== 'running') return;

      const start = context.currentTime;
      [0, 0.28].forEach((offset, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const at = start + offset;
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(index === 0 ? 880 : 660, at);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.16, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(at);
        oscillator.stop(at + 0.24);
      });
      setBlocked(false);
    } catch {
      // Browsers may require a user gesture before allowing sound.
      setBlocked(true);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    void ringOnce();
    timerRef.current = window.setInterval(() => void ringOnce(), 1600);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      // Keep the shared context alive: it was primed by the client page and
      // must be reusable for the next incoming call without another prompt.
      contextRef.current = null;
    };
  }, [enabled, ringOnce]);

  return { blocked, enable: ringOnce };
}

interface DockProps {
  call: ApiCall;
  role: CallRole;
  initiator: boolean;
  channel?: 'main' | 'whisper';
  whisperName?: string | null;
  headless?: boolean;
  /** Optional listen-only monitor leg for the supervisor. */
  publishAudio?: boolean;
  multiAudio?: boolean;
  onClosed: () => void;
}

export const CallDock: React.FC<DockProps> = ({
  call, role, initiator, channel = 'main', whisperName, headless = false,
  publishAudio = true, multiAudio = false, onClosed,
}) => {
  // Detect LiveKit
  const [useLiveKit, setUseLiveKit] = useState<boolean>(false);
  const [liveKitChecked, setLiveKitChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Check env var first
    const envUrl = (import.meta as any).env?.VITE_LIVEKIT_URL;
    if (envUrl) {
      setUseLiveKit(true);
      setLiveKitChecked(true);
      return;
    }
    apiLiveKitConfig()
      .then((cfg) => {
        if (!cancelled) {
          setUseLiveKit(cfg.configured);
          setLiveKitChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUseLiveKit(false);
          setLiveKitChecked(true);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const autoRecord = role === 'manager' && channel === 'main';
  const p2p = useWebRTCCall({ callId: call.id, role, initiator, channel, autoRecord, onEnded: onClosed });
  const lk = useLiveKitCall({ callId: call.id, role, channel, autoRecord, publishAudio, multiAudio, onEnded: onClosed });

  // Choose implementation — LiveKit if configured and checked, otherwise P2P
  const active = useLiveKit && liveKitChecked ? lk : p2p;

  const {
    phase, error, warning, needsAudioUnlock, muted, micAvailable,
    sharingScreen, recording, hasRemoteVideo,
    audioPlaybackReady: liveKitAudioPlaybackReady,
    remoteParticipantConnected: liveKitRemoteParticipantConnected,
    remoteAudioRef, remoteVideoRef, peerConnectionRef,
    connect, hangUp, enableAudio, toggleMute, toggleScreenShare, toggleRecording,
  } = active as any;

  // A LiveKit room becomes connected for the caller before the client
  // accepts. The remote participant alone is not enough either: use the
  // server's answeredAt marker so both clocks start only after the client
  // has accepted the call and joined the main room.
  const callAnswered = channel !== 'main' || Boolean(call.answeredAt);
  const callActive = phase === 'active'
    && callAnswered
    && (!useLiveKit || Boolean(liveKitRemoteParticipantConnected));

  const diagnostics = useCallDiagnostics(
    // LiveKit doesn't have peerConnection, so diagnostics will be empty — that's ok
    (active as any).peerConnectionRef?.current || null,
    phase !== 'idle' && phase !== 'ended'
  );
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [videoExpanded, setVideoExpanded] = useState(false);

  /**
   * The supervisor's screen share arrives on the manager's WHISPER leg
   * (which is headless) and is surfaced here, in the visible main dock.
   * The client never sees it. It yields to the client's own screen
   * share, which travels on the main connection.
   */
  const [coachVideo, setCoachVideo] = useState<MediaStreamTrack | null>(null);
  /** 'waiting' — track is live but no frame rendered yet (honest state,
   *  not a mysterious black rectangle). */
  const [screenState, setScreenState] = useState<'live' | 'waiting' | 'ended'>('waiting');
  const coachVideoStreamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    if (role !== 'manager' || channel !== 'main') {
      setCoachVideo(null);
      return undefined;
    }
    return callMediaBus.coachVideo.subscribe(setCoachVideo);
  }, [role, channel]);
  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!el || hasRemoteVideo) return; // the live connection owns the element
    if (!coachVideo) {
      if (coachVideoStreamRef.current && el.srcObject === coachVideoStreamRef.current) {
        el.srcObject = null;
        coachVideoStreamRef.current = null;
      }
      return;
    }
    const stream = new MediaStream([coachVideo]);
    coachVideoStreamRef.current = stream;
    el.srcObject = stream;
    if (coachVideo.readyState !== 'live') {
      setScreenState('ended');
      return;
    }
    setScreenState(el.videoWidth > 0 ? 'live' : 'waiting');
    const onPlaying = () => setScreenState('live');
    const onTrackEnded = () => setScreenState('ended');
    el.addEventListener('playing', onPlaying);
    coachVideo.addEventListener('ended', onTrackEnded);
    // Chrome can sit at 0 frames right after the track starts delivering
    // (element assigned the stream before the first frame arrived).
    // Nudge it once before leaving the "waiting" state.
    const t = window.setTimeout(() => {
      if (el.videoWidth === 0 && el.srcObject === stream) {
        el.load();
        void el.play().catch(() => undefined);
      }
    }, 2500);
    return () => {
      window.clearTimeout(t);
      el.removeEventListener('playing', onPlaying);
      coachVideo.removeEventListener('ended', onTrackEnded);
    };
  }, [coachVideo, hasRemoteVideo, remoteVideoRef]);
  const showVideo = hasRemoteVideo || Boolean(coachVideo);

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  const startDrag = (e: React.MouseEvent) => {
    const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    dragRef.current = { dx: e.clientX - box.left, dy: e.clientY - box.top };
    const move = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: Math.max(8, Math.min(window.innerWidth - 330, ev.clientX - dragRef.current.dx)),
        y: Math.max(8, Math.min(window.innerHeight - 120, ev.clientY - dragRef.current.dy)),
      });
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  useEffect(() => {
    if (!liveKitChecked) return;
    void connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.id, liveKitChecked, useLiveKit]);

  useEffect(() => {
    if (!callActive) {
      setSeconds(0);
      return;
    }

    // Use the server timestamp instead of counting from the local render.
    // Both browsers then show the same elapsed call time even if one inbox
    // poll arrives a little later than the other.
    const answeredAt = call.answeredAt ? Date.parse(call.answeredAt) : Date.now();
    const tick = () => {
      setSeconds(Math.max(0, Math.floor((Date.now() - answeredAt) / 1000)));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [callActive, call.answeredAt]);

  useEffect(() => {
    if (!showVideo) setVideoExpanded(false);
  }, [showVideo]);

  const title =
    role === 'client'
      ? call.callerName
      : role === 'supervisor'
      ? `Coaching ${call.managerName}`
      : call.clientName;

  if (headless) {
    return (
      <>
        <audio ref={remoteAudioRef} autoPlay playsInline />
        <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
      </>
    );
  }

  return (
    <div
      className="fixed z-[70] w-[320px] bg-white border border-[#E4DECB] rounded-2xl shadow-2xl shadow-black/20 overflow-hidden"
      style={pos ? { left: pos.x, top: pos.y } : { right: 20, bottom: 96 }}
    >
      <div className="px-4 py-3 bg-[#F5F2E9] border-b border-[#E4DECB] flex items-center gap-2.5">
        <button
          onMouseDown={startDrag}
          title="Drag to move"
          className="shrink-0 -ml-1 text-[#213532]/60 hover:text-[#1C412C] cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="w-9 h-9 rounded-full bg-[#1C412C] flex items-center justify-center">
          {phase === 'connecting' ? (
            <Loader2 className="w-4 h-4 text-[#B08B48] animate-spin" />
          ) : (
            <Phone className="w-4 h-4 text-[#B08B48]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-[#1C412C] truncate">{title}</div>
          <div className="text-[11px] text-[#213532]/70">
            {useLiveKit && <span className="mr-1 text-[9px] bg-[#B08B48] text-white px-1 rounded">LIVEKIT</span>}
            {(phase === 'connecting' || (phase === 'active' && !callActive)) && (role === 'supervisor' ? 'Waiting for the manager…' : 'Connecting…')}
            {callActive && fmt(seconds)}
            {phase === 'failed' && 'Call failed'}
            {phase === 'ended' && 'Call ended'}
          </div>
        </div>
        {/* The REC badge is staff-only: the client must never see that the
            call is being recorded (auto-record runs on the manager side). */}
        {recording && role !== 'client' && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600">
            <Circle className="w-2 h-2 fill-rose-600" /> REC
          </span>
        )}
        <button
          type="button"
          onClick={() => setDiagnosticsOpen(open => !open)}
          title="Call diagnostics"
          className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer ${diagnosticsOpen ? 'bg-[#B08B48] text-white' : 'text-[#213532]/50 hover:bg-[#1C412C]/10 hover:text-[#1C412C]'}`}
        >
          <Activity className="w-3.5 h-3.5" />
        </button>
      </div>

      {whisperName && role === 'manager' && (
        <div className="px-4 py-2 bg-violet-500/10 border-b border-violet-500/20 text-[11px] text-violet-800 flex items-center gap-1.5 font-medium">
          <Ear className="w-3.5 h-3.5" /> {whisperName} is coaching you — the client cannot hear them
        </div>
      )}

      {role === 'supervisor' && (
        <div className="px-4 py-2 bg-violet-500/10 border-b border-violet-500/20 text-[11px] text-violet-800 flex items-center gap-1.5 font-medium">
          <Ear className="w-3.5 h-3.5" /> Only {call.managerName} hears you
        </div>
      )}

      {error && (
        <div className="px-4 py-2 bg-rose-500/10 text-[11px] text-rose-700 flex items-start gap-2 border-b border-rose-500/20">
          <span className="flex-1 font-medium">{error}</span>
          {phase === 'failed' && (
            <button
              onClick={() => void connect()}
              className="shrink-0 px-2 py-0.5 rounded bg-rose-600 text-white font-bold hover:bg-rose-700 cursor-pointer text-[10px]"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {warning && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[11px] text-amber-900 font-medium leading-tight">
          {warning}
        </div>
      )}

      {/* The pink "This call is being recorded" banner was removed on
          purpose: the client must never see any sign of recording. The
          staff side keeps only the small REC badge in the header above. */}

      {(needsAudioUnlock || (useLiveKit && callActive && !liveKitAudioPlaybackReady)) && (
        <button
          type="button"
          onClick={() => void enableAudio()}
          className="w-full px-4 py-2 bg-[#B08B48] text-white text-[11px] font-bold hover:bg-[#9a7a3e] cursor-pointer"
        >
          Enable sound
        </button>
      )}

      {diagnosticsOpen && !useLiveKit && (
        <div className="border-b border-[#E4DECB] bg-[#FBF9F2] px-4 py-3 text-[10px] font-mono text-[#213532]/75 space-y-1">
          <div className="flex items-center justify-between gap-2 font-sans font-bold text-[#1C412C]">
            <span>Connection diagnostics</span>
            <button type="button" onClick={() => void diagnostics.refresh()} className="font-sans text-[#B08B48] hover:underline cursor-pointer">Refresh</button>
          </div>
          <div>state: {diagnostics.snapshot.connectionState} / {diagnostics.snapshot.iceConnectionState}</div>
          <div>ICE: {diagnostics.snapshot.iceGatheringState} · {diagnostics.snapshot.protocol}</div>
          <div>candidates: {diagnostics.snapshot.localCandidateType} → {diagnostics.snapshot.remoteCandidateType} {diagnostics.snapshot.relay ? '· relay' : ''}</div>
          <div>audio: ↑ {fmtBytes(diagnostics.snapshot.bytesSent)} · ↓ {fmtBytes(diagnostics.snapshot.bytesReceived)}</div>
          <div>packets: ↑ {diagnostics.snapshot.packetsSent} · ↓ {diagnostics.snapshot.packetsReceived}{diagnostics.snapshot.roundTripTimeMs == null ? '' : ` · RTT ${diagnostics.snapshot.roundTripTimeMs} ms`}</div>
        </div>
      )}

      {diagnosticsOpen && useLiveKit && (
        <div className="border-b border-[#E4DECB] bg-[#FBF9F2] px-4 py-3 text-[10px] font-mono text-[#213532]/75">
          <div className="font-sans font-bold text-[#1C412C]">LiveKit — SFU mode</div>
          <div>Room: {channel === 'whisper' ? `whisper-${call.id}` : `call-${call.id}`}</div>
          <div>Phase: {phase}</div>
          <div className="text-[9px] mt-1">TURN/ICE handled by LiveKit server</div>
        </div>
      )}

      <div className={videoExpanded ? '' : 'relative w-full'}>
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted
          onClick={() => setVideoExpanded(v => !v)}
          title={videoExpanded ? 'Minimize' : 'Expand to fullscreen'}
          className={`bg-black object-contain cursor-pointer ${
            videoExpanded
              ? 'fixed inset-0 z-[90] w-screen h-screen'
              : `w-full ${showVideo ? 'block' : 'hidden'}`
          }`}
          style={videoExpanded ? undefined : { maxHeight: 160 }}
        />
        {showVideo && !videoExpanded && (
          <span className={`absolute bottom-2 left-2 z-10 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide ${
            hasRemoteVideo || screenState === 'live' ? 'bg-violet-600/80 text-white' : 'bg-black/70 text-white/80'
          }`}>
            {hasRemoteVideo
              ? 'SCREEN SHARE'
              : screenState === 'ended'
              ? 'SCREEN SHARE ENDED'
              : 'Waiting for the screen signal…'}
          </span>
        )}
        {showVideo && !videoExpanded && (
          <button
            onClick={() => setVideoExpanded(true)}
            title="Expand to fullscreen"
            className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {videoExpanded && (
        <button
          onClick={() => setVideoExpanded(false)}
          title="Minimize"
          className="fixed top-4 right-4 z-[95] flex items-center gap-2 px-3 py-2 rounded-full bg-[#1C412C] text-[#F5F2E9] hover:bg-[#245238] text-[12px] font-bold cursor-pointer shadow-lg"
        >
          <Minimize2 className="w-4 h-4" /> Minimize
        </button>
      )}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="p-3 bg-white flex items-center justify-center gap-2">
        <button
          onClick={toggleMute}
          disabled={!micAvailable}
          title={!micAvailable ? 'No microphone on this device' : muted ? 'Unmute' : 'Mute'}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            !micAvailable
              ? 'bg-[#1C412C]/[.04] text-[#213532]/30 cursor-not-allowed'
              : muted
              ? 'bg-rose-500/15 text-rose-600 cursor-pointer'
              : 'bg-[#1C412C]/[.06] text-[#213532] hover:bg-[#1C412C]/[.12] cursor-pointer'
          }`}
        >
          {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Screen sharing is a staff feature: clients call from phones
            and iPhone Safari has no screen sharing at all, so the
            button would only fail for them. */}
        {role !== 'client' && (
          <button
            onClick={toggleScreenShare}
            title="Share screen"
            className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
              sharingScreen ? 'bg-[#B08B48] text-white' : 'bg-[#1C412C]/[.06] text-[#213532] hover:bg-[#1C412C]/[.12]'
            }`}
          >
            <MonitorUp className="w-4 h-4" />
          </button>
        )}

        {role === 'manager' && (
          // The manager is the only one with a record button: the main
          // call is recorded automatically on their side, and a manual
          // copy on the supervisor's dock was confusing.
          <button
            onClick={toggleRecording}
            title={recording ? 'Stop recording' : 'Record call'}
            className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
              recording ? 'bg-rose-500/15 text-rose-600' : 'bg-[#1C412C]/[.06] text-[#213532] hover:bg-[#1C412C]/[.12]'
            }`}
          >
            <Circle className={`w-4 h-4 ${recording ? 'fill-rose-600' : ''}`} />
          </button>
        )}

        <button
          onClick={hangUp}
          title="Hang up"
          className="w-10 h-10 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center cursor-pointer shadow-sm"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

interface IncomingProps {
  call: ApiCall;
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCall: React.FC<IncomingProps> = ({ call, onAccept, onDecline }) => {
  const ringtone = useIncomingRingtone(true);
  const accept = () => {
    void ringtone.enable();
    onAccept();
  };

  return (
  <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div className="bg-white border border-[#E4DECB] rounded-3xl p-8 w-[340px] text-center shadow-2xl">
      <div className="w-20 h-20 rounded-full bg-[#1C412C] mx-auto flex items-center justify-center shadow-md animate-pulse">
        <Phone className="w-9 h-9 text-[#B08B48]" />
      </div>
      <div className="mt-5 text-[11px] uppercase tracking-widest font-bold text-[#213532]/60">Incoming call</div>
      <div className="mt-1 text-[19px] font-bold text-[#1C412C]">{call.callerName}</div>

      {ringtone.blocked && (
        <button
          type="button"
          onClick={() => void ringtone.enable()}
          className="mt-4 text-[11px] font-bold text-[#B08B48] hover:underline cursor-pointer"
        >
          Enable ringtone
        </button>
      )}

      <div className="mt-7 flex items-center justify-center gap-4">
        <button
          onClick={onDecline}
          className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center cursor-pointer shadow-md transition-transform hover:scale-105"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
        <button
          onClick={accept}
          className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center cursor-pointer shadow-md transition-transform hover:scale-105"
        >
          <Phone className="w-6 h-6" />
        </button>
      </div>
    </div>
  </div>
  );
};
