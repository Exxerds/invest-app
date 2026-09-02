// ============================================================
//  Cross-dock audio bus.
//
//  The whisper (coaching) leg and the main call leg are separate
//  component instances with separate connections, so the main
//  leg's auto-recording cannot see the coach's audio track by
//  itself. This tiny module-level bus lets the manager's whisper
//  leg publish the supervisor's audio track, and the main leg's
//  recorder subscribe to it — so the coach's voice is captured
//  in the call recording too (and in the middle of the call,
//  when a supervisor joins late).
// ============================================================

type TrackListener = (track: MediaStreamTrack | null) => void;

const listeners = new Set<TrackListener>();
let coachTrack: MediaStreamTrack | null = null;

export const callAudioBus = {
  /** Current supervisor (whisper) audio track, if any. */
  getCoachTrack: () => coachTrack,
  /** The manager's whisper leg calls this when the coach's track arrives / leaves. */
  setCoachTrack: (track: MediaStreamTrack | null) => {
    coachTrack = track;
    listeners.forEach(l => l(track));
  },
  /** The recording leg subscribes; the current track is delivered immediately. */
  onCoachTrack: (fn: TrackListener) => {
    listeners.add(fn);
    fn(coachTrack);
    return () => {
      listeners.delete(fn);
    };
  },
};
