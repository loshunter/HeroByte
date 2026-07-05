// A single shared "300ms clock" that drives ambient tile animation (water
// shimmer, torchlight) across every render surface — the editor canvas today,
// the live table next. One timer feeds all subscribers so N animated things
// cost one interval, and reduced-motion freezes it to a static frame.
//
// The step is a monotonic frame COUNTER (advances one per tick), not a
// wall-clock phase, so it starts at 0 and is deterministic under fake timers.
// Cross-client frame sync (a shared wall-clock/server phase) is a deliberate
// later refinement — ambient shimmer doesn't need it; juice events will.
import { motionDisabled, subscribeJuiceSettings } from "../juice/juiceSettings";

/** The shared cadence: one animation frame every 300ms (SNES-style). */
export const ANIMATION_STEP_MS = 300;

const subscribers = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeMotion: (() => void) | null = null;
let frame = 0;

/** Current animation frame; frozen to 0 while reduced motion is active. */
export function animationClockStep(): number {
  return motionDisabled() ? 0 : frame;
}

/**
 * Subscribe to frame advances. The listener fires once per 300ms step while
 * motion is on, and once when motion turns off (so consumers repaint the
 * static frame). Returns an unsubscribe that tears the timer down when the
 * last subscriber leaves.
 */
export function subscribeAnimationClock(listener: () => void): () => void {
  subscribers.add(listener);
  if (!unsubscribeMotion) unsubscribeMotion = subscribeJuiceSettings(onMotionChange);
  start();
  return () => {
    subscribers.delete(listener);
    if (subscribers.size === 0) {
      stop();
      unsubscribeMotion?.();
      unsubscribeMotion = null;
    }
  };
}

function onMotionChange(): void {
  if (motionDisabled()) {
    // Freeze: stop the timer and let consumers repaint frame 0 once.
    stop();
    notify();
  } else {
    start();
  }
}

function start(): void {
  if (timer !== null || subscribers.size === 0 || motionDisabled()) return;
  timer = setTimeout(tick, ANIMATION_STEP_MS);
}

function stop(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

function tick(): void {
  timer = null;
  frame += 1;
  notify();
  start();
}

function notify(): void {
  subscribers.forEach((listener) => listener());
}

/** Test-only: reset the timer, subscribers, and frame counter. */
export function __resetAnimationClockForTests(): void {
  stop();
  subscribers.clear();
  unsubscribeMotion?.();
  unsubscribeMotion = null;
  frame = 0;
}
