/**
 * The throttle on the dropped-gesture notice.
 *
 * useToast appends without dedupe and has no "already showing this" check, so
 * an un-throttled notice would stack one toast per dropped gesture — and the
 * gestures this fires on arrive in bursts, several inside one round trip. The
 * cure would then cover more of the map than the disease.
 *
 * Source: apps/client/src/features/map-edit/useDroppedGestureNotice.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  useDroppedGestureNotice,
  DROPPED_GESTURE_MESSAGE,
  DROPPED_GESTURE_THROTTLE_MS,
} from "../useDroppedGestureNotice";

// Fake timers move Date.now(), which is what the throttle reads.
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useDroppedGestureNotice", () => {
  it("speaks the first time, with the copy the DM is meant to act on", () => {
    const notify = vi.fn();
    const { result } = renderHook(() => useDroppedGestureNotice(notify));

    result.current();

    expect(notify).toHaveBeenCalledExactlyOnceWith(DROPPED_GESTURE_MESSAGE);
  });

  it("says it ONCE for a burst inside one toast lifetime", () => {
    const notify = vi.fn();
    const { result } = renderHook(() => useDroppedGestureNotice(notify));

    // Four dropped gestures across a single round trip — a plausible rate for
    // a DM tapping out a row of props while the previous command is in flight.
    result.current();
    vi.advanceTimersByTime(200);
    result.current();
    vi.advanceTimersByTime(200);
    result.current();
    vi.advanceTimersByTime(200);
    result.current();

    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("speaks again once the previous notice has expired", () => {
    const notify = vi.fn();
    const { result } = renderHook(() => useDroppedGestureNotice(notify));

    result.current();
    vi.advanceTimersByTime(DROPPED_GESTURE_THROTTLE_MS);
    result.current();

    // A DM who hits this twice a minute apart is being told twice. Silence
    // after the first would be the same bug this whole change is about.
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it("keeps a stable identity, so the tool hooks do not re-arm every render", () => {
    // place/scatter list this in their dependency arrays; a fresh function each
    // render would rebuild the placement callbacks on every parent render.
    const notify = vi.fn();
    const { result, rerender } = renderHook(() => useDroppedGestureNotice(notify));
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
