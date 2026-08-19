// ============================================================
//  Live call widgets — styled in Oak Haven brand theme.
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
    phase, error, warning, muted, micAvailable,
    sharingScreen, recording, hasRemoteVideo,
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
            {phase === 'connecting' && (role === 'supervisor' ? 'Waiting for the manager…' : 'Connecting…')}
            {phase === 'active' && fmt(seconds)}
            {phase === 'failed' && 'Call failed'}
            {phase === 'ended' && 'Call ended'}
          </div>
        </div>
        {recording && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600">
            <Circle className="w-2 h-2 fill-rose-600" /> REC
          </span>
        )}
      </div>

      {/* Only the manager is told a supervisor is listening */}
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

      {/* Kept in the DOM at all times (the ref must exist when ontrack
          fires); only becomes visible once the other side shares a screen */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        muted
        className={`w-full bg-black ${hasRemoteVideo ? 'block cursor-pointer' : 'hidden'}`}
        style={{ maxHeight: 160 }}
      />
      <audio ref={remoteAudioRef} autoPlay />

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

        {role !== 'client' && (
          <>
            <button
              onClick={toggleScreenShare}
              title="Share screen"
              className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                sharingScreen ? 'bg-[#B08B48] text-white' : 'bg-[#1C412C]/[.06] text-[#213532] hover:bg-[#1C412C]/[.12]'
              }`}
            >
              <MonitorUp className="w-4 h-4" />
            </button>
            <button
              onClick={toggleRecording}
              title={recording ? 'Stop recording' : 'Record call'}
              className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                recording ? 'bg-rose-500/15 text-rose-600' : 'bg-[#1C412C]/[.06] text-[#213532] hover:bg-[#1C412C]/[.12]'
              }`}
            >
              <Circle className={`w-4 h-4 ${recording ? 'fill-rose-600' : ''}`} />
            </button>
          </>
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

export const IncomingCall: React.FC<IncomingProps> = ({ call, onAccept, onDecline }) => (
  <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div className="bg-white border border-[#E4DECB] rounded-3xl p-8 w-[340px] text-center shadow-2xl">
      <div className="w-20 h-20 rounded-full bg-[#1C412C] mx-auto flex items-center justify-center shadow-md animate-pulse">
        <Phone className="w-9 h-9 text-[#B08B48]" />
      </div>
      <div className="mt-5 text-[11px] uppercase tracking-widest font-bold text-[#213532]/60">Incoming call</div>
      <div className="mt-1 text-[19px] font-bold text-[#1C412C]">{call.callerName}</div>

      <div className="mt-7 flex items-center justify-center gap-4">
        <button
          onClick={onDecline}
          className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center cursor-pointer shadow-md transition-transform hover:scale-105"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
        <button
          onClick={onAccept}
          className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center cursor-pointer shadow-md transition-transform hover:scale-105"
        >
          <Phone className="w-6 h-6" />
        </button>
      </div>
    </div>
  </div>
);
