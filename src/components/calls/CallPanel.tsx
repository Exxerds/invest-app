// ============================================================
//  Live call widgets.
//
//  CallDock      — the in-call controls, shared by both sides
//  IncomingCall  — full-screen prompt in the client's cabinet
// ============================================================
import React, { useEffect, useRef, useState } from 'react';
import {
  Phone, PhoneOff, Mic, MicOff, MonitorUp, Circle, Ear, Loader2, GripVertical,
} from 'lucide-react';
import { useWebRTCCall } from '../../hooks/useWebRTCCall';
import type { CallRole } from '../../hooks/useWebRTCCall';
import type { ApiCall } from '../../api';

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

interface DockProps {
  call: ApiCall;
  role: CallRole;
  initiator: boolean;
  /** Separate peer connection for supervisor coaching */
  channel?: 'main' | 'whisper';
  /** Supervisor listening in — shown to the manager only */
  whisperName?: string | null;
  /** Audio-only leg: connects and plays sound, draws no window */
  headless?: boolean;
  onClosed: () => void;
}

export const CallDock: React.FC<DockProps> = ({
  call, role, initiator, channel = 'main', whisperName, headless = false, onClosed,
}) => {
  const {
    phase, error, muted, sharingScreen, recording,
    remoteAudioRef, remoteVideoRef,
    connect, hangUp, toggleMute, toggleScreenShare, toggleRecording,
  } = useWebRTCCall({ callId: call.id, role, initiator, channel, onEnded: onClosed });

  const [seconds, setSeconds] = useState(0);

  /* The dock can be dragged anywhere, so it never covers a toast or a table */
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
    void connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.id]);

  useEffect(() => {
    if (phase !== 'active') return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const title =
    role === 'client'
      ? call.callerName
      : role === 'supervisor'
      ? `Coaching ${call.managerName}`
      : call.clientName;

  /**
   * The manager's whisper leg exists only to carry the coach's audio —
   * a second window on screen would just confuse them.
   */
  if (headless) {
    return (
      <>
        <audio ref={remoteAudioRef} autoPlay />
        <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
      </>
    );
  }

  return (
    <div
      className="fixed z-[70] w-[320px] bg-[#14161c] border border-[#f5b400]/30 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
      style={pos ? { left: pos.x, top: pos.y } : { right: 20, bottom: 96 }}
    >
      <div className="px-4 py-3 bg-[#0f1116] border-b border-white/[.06] flex items-center gap-2.5">
        <button
          onMouseDown={startDrag}
          title="Drag to move"
          className="shrink-0 -ml-1 text-slate-600 hover:text-slate-300 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="w-9 h-9 rounded-full bg-[#f5b400]/15 border border-[#f5b400]/30 flex items-center justify-center">
          {phase === 'connecting' ? (
            <Loader2 className="w-4 h-4 text-[#f5b400] animate-spin" />
          ) : (
            <Phone className="w-4 h-4 text-[#f5b400]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-white truncate">{title}</div>
          <div className="text-[11px] text-slate-500">
            {phase === 'connecting' && 'Connecting…'}
            {phase === 'active' && fmt(seconds)}
            {phase === 'failed' && 'Failed'}
            {phase === 'ended' && 'Call ended'}
          </div>
        </div>
        {recording && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-rose-400">
            <Circle className="w-2 h-2 fill-rose-400" /> REC
          </span>
        )}
      </div>

      {/* Only the manager is told a supervisor is listening */}
      {whisperName && role === 'manager' && (
        <div className="px-4 py-2 bg-violet-500/10 border-b border-violet-500/20 text-[11px] text-violet-300 flex items-center gap-1.5">
          <Ear className="w-3.5 h-3.5" /> {whisperName} is coaching you — the client cannot hear them
        </div>
      )}

      {role === 'supervisor' && (
        <div className="px-4 py-2 bg-violet-500/10 border-b border-violet-500/20 text-[11px] text-violet-300 flex items-center gap-1.5">
          <Ear className="w-3.5 h-3.5" /> Only {call.managerName} hears you
        </div>
      )}

      {error && (
        <div className="px-4 py-2 bg-rose-500/10 text-[11px] text-rose-400">{error}</div>
      )}

      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={`w-full bg-black ${sharingScreen || phase === 'active' ? 'block' : 'hidden'}`}
        style={{ maxHeight: 160 }}
      />
      <audio ref={remoteAudioRef} autoPlay />

      <div className="p-3 flex items-center justify-center gap-2">
        <button
          onClick={toggleMute}
          title={muted ? 'Unmute' : 'Mute'}
          className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
            muted ? 'bg-rose-500/20 text-rose-400' : 'bg-white/[.06] text-slate-300 hover:bg-white/[.12]'
          }`}
        >
          {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {role !== 'client' && (
          <>
            <button
              onClick={toggleScreenShare}
              title="Share screen"
              className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                sharingScreen ? 'bg-[#f5b400]/20 text-[#f5b400]' : 'bg-white/[.06] text-slate-300 hover:bg-white/[.12]'
              }`}
            >
              <MonitorUp className="w-4 h-4" />
            </button>
            <button
              onClick={toggleRecording}
              title={recording ? 'Stop recording' : 'Record call'}
              className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                recording ? 'bg-rose-500/20 text-rose-400' : 'bg-white/[.06] text-slate-300 hover:bg-white/[.12]'
              }`}
            >
              <Circle className={`w-4 h-4 ${recording ? 'fill-rose-400' : ''}`} />
            </button>
          </>
        )}

        <button
          onClick={hangUp}
          title="Hang up"
          className="w-10 h-10 rounded-full bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center cursor-pointer"
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

export const IncomingCall: React.FC<IncomingProps> = ({ call, onAccept, onDecline }) => (
  <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm">
    <div className="bg-[#14161c] border border-[#f5b400]/30 rounded-3xl p-8 w-[340px] text-center shadow-2xl">
      <div className="w-20 h-20 rounded-full bg-[#f5b400]/15 border border-[#f5b400]/30 mx-auto flex items-center justify-center animate-pulse">
        <Phone className="w-9 h-9 text-[#f5b400]" />
      </div>
      <div className="mt-5 text-[11px] uppercase tracking-widest text-slate-500">Incoming call</div>
      <div className="mt-1 text-[19px] font-bold text-white">{call.callerName}</div>

      <div className="mt-7 flex items-center justify-center gap-4">
        <button
          onClick={onDecline}
          className="w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center cursor-pointer"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
        <button
          onClick={onAccept}
          className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center cursor-pointer"
        >
          <Phone className="w-6 h-6" />
        </button>
      </div>
    </div>
  </div>
);
