// ============================================================
//  Call media bus — passes live MediaStreamTracks between the
//  separate call legs that live in different hook instances and
//  therefore cannot see each other directly.
//
//    coachAudio  — the supervisor's voice as received by the
//                  manager's whisper leg. Fed into the main
//                  leg's auto-recording, so coaching is on file.
//    clientAudio — the client's voice as received by the
//                  manager's MAIN leg. In P2P mode a call is a
//                  strict 1:1 pipe with no room for a third
//                  listener, so the manager's whisper leg
//                  relays this track to the coach — that is how
//                  the supervisor hears the client in P2P mode.
//    coachVideo  — the supervisor's screen share as received by
//                  the manager's (headless) whisper leg, shown
//                  in the manager's main dock. The client never
//                  sees it: it travels on the whisper channel.
// ============================================================

type TrackHandler = (track: MediaStreamTrack | null) => void;

function makeSlot() {
  let current: MediaStreamTrack | null = null;
  const listeners = new Set<TrackHandler>();
  return {
    get: (): MediaStreamTrack | null => current,
    set: (track: MediaStreamTrack | null) => {
      if (current === track) return;
      current = track;
      listeners.forEach(fn => {
        try {
          fn(track);
        } catch {
          /* a listener must never break the bus */
        }
      });
    },
    /** Subscribes and immediately delivers the current value. */
    subscribe: (fn: TrackHandler): (() => void) => {
      listeners.add(fn);
      fn(current);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}

export const callMediaBus = {
  coachAudio: makeSlot(),
  clientAudio: makeSlot(),
  coachVideo: makeSlot(),
};
