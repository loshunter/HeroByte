// ============================================================================
// AIM TOUCH GUARD — a tap is a tap only if the finger did not move
// ============================================================================
// Konva synthesises `tap` from the touch events themselves with NO movement
// slop: Stage.js sets its ListenClick flag on touchstart, never clears it on
// touchmove, and fires `tap` on the first finger-lift that hits no listening
// shape. So a one-finger pan and a pinch both END in a Stage tap at the lift
// point — and the atlas-link aim captures on exactly that tap. That is why the
// aim used to freeze the camera outright and treat a second finger as a cancel
// (the mobile-surface review lens's L3), which left a phone DM unable to bring
// the target wall into view before placing.
//
// This guard remembers whether the gesture since the last touchstart MOVED —
// past a slop, or onto a second finger — so the camera may pan and pinch under
// an armed aim while the aim still places only on a real tap. Touch-only by
// construction: the mouse path never calls onTouchStart/Move, so a desktop
// click consumes `false` and captures as before.

import { useCallback, useMemo, useRef } from "react";
import type { KonvaEventObject } from "konva/lib/Node";

/** Movement past this many CSS px is a pan, not a tap. */
export const AIM_TAP_SLOP_PX = 8;

export interface AimTouchGuard {
  onTouchStart: (event: KonvaEventObject<TouchEvent>) => void;
  onTouchMove: (event: KonvaEventObject<TouchEvent>) => void;
  /** True — once — when the gesture since the last touchstart was a pan or a pinch. */
  consumeGesture: () => boolean;
}

export function useAimTouchGuard(): AimTouchGuard {
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  const onTouchStart = useCallback((event: KonvaEventObject<TouchEvent>) => {
    const touches = event.evt.touches;
    const first = touches[0];
    // A second finger down before the first lifted is a pinch, never a tap.
    // `touches` is document-wide, so a finger landing on the dock counts too —
    // which is right: that press was not aimed either.
    moved.current = touches.length > 1;
    start.current = first ? { x: first.clientX, y: first.clientY } : null;
  }, []);

  const onTouchMove = useCallback((event: KonvaEventObject<TouchEvent>) => {
    const touches = event.evt.touches;
    if (touches.length > 1) {
      moved.current = true;
      return;
    }
    const first = touches[0];
    const from = start.current;
    if (!first || !from) return;
    if (Math.hypot(first.clientX - from.x, first.clientY - from.y) > AIM_TAP_SLOP_PX) {
      moved.current = true;
    }
  }, []);

  const consumeGesture = useCallback(() => {
    const result = moved.current;
    moved.current = false;
    start.current = null;
    return result;
  }, []);

  return useMemo(
    () => ({ onTouchStart, onTouchMove, consumeGesture }),
    [onTouchStart, onTouchMove, consumeGesture],
  );
}
