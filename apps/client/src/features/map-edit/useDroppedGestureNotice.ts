// ============================================================================
// DROPPED-GESTURE NOTICE
// ============================================================================
// The DM finished a gesture while a map command was still in flight, so the
// commit was skipped and the gesture produced nothing at all.
//
// That outcome is the only one in map-edit that leaves NO evidence. The rubber
// band clears whether or not the commit ran; a skipped commit never sets
// controller.error, so the error toast never fires; and place/scatter drop
// their click with the ghost still sitting under the cursor. From the DM's side
// it is indistinguishable from a successful no-op — they drew a wall and the
// wall is not there. On a phone at real latency that is a whole round trip's
// worth of gestures, and the natural reaction is to draw it again.
//
// Throttled, because useToast appends without dedupe and the gestures this
// fires on arrive in bursts: three fast taps inside one round trip would stack
// three identical toasts on top of the map they are complaining about.

import { useCallback, useRef } from "react";

/** One string, one place — the notice reads the same wherever it is wired. */
export const DROPPED_GESTURE_MESSAGE = "Still saving the last change — draw that again.";

/**
 * One notice per toast lifetime (useToast's own default duration), so a burst
 * of dropped gestures can never put two copies of this message on screen at
 * once, while a genuinely repeated failure seconds later still speaks.
 */
export const DROPPED_GESTURE_THROTTLE_MS = 3_000;

export function useDroppedGestureNotice(notify: (message: string) => void): () => void {
  // -Infinity rather than 0: a clock that has not been read yet must not be
  // inside the window, and 0 only happens to work because Date.now() is large.
  const lastShownAt = useRef(Number.NEGATIVE_INFINITY);

  return useCallback(() => {
    const now = Date.now();
    if (now - lastShownAt.current < DROPPED_GESTURE_THROTTLE_MS) return;
    lastShownAt.current = now;
    notify(DROPPED_GESTURE_MESSAGE);
  }, [notify]);
}
