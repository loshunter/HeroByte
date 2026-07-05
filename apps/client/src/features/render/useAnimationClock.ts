import { useSyncExternalStore } from "react";
import { animationClockStep, subscribeAnimationClock } from "./animationClock";

const subscribeNever = () => () => {};
const frozenSnapshot = () => 0;

/**
 * Current animation frame index within a `frameCount`-frame cycle, driven by
 * the shared 300ms clock. Re-renders the calling component once per frame.
 *
 * Pass `enabled: false` (e.g. no animated content on screen) to opt out
 * entirely — no clock subscription, no re-renders. Frame 0 is the static
 * frame, so a disabled or reduced-motion consumer renders identically to the
 * export path.
 */
export function useAnimationFrameIndex(frameCount: number, enabled = true): number {
  const active = enabled && frameCount > 1;
  const step = useSyncExternalStore(
    active ? subscribeAnimationClock : subscribeNever,
    active ? animationClockStep : frozenSnapshot,
    frozenSnapshot,
  );
  if (!active) return 0;
  return ((step % frameCount) + frameCount) % frameCount;
}
