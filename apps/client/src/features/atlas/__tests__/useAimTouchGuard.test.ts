// A Stage tap ends every touch gesture, moved or not (Konva has no slop), so
// the aim needs its own memory of whether the finger travelled or a second
// one landed. Each rule alone must decide it.

import { renderHook } from "@testing-library/react";
import type { KonvaEventObject } from "konva/lib/Node";
import { describe, expect, it } from "vitest";
import { AIM_TAP_SLOP_PX, useAimTouchGuard } from "../useAimTouchGuard";

function touches(...points: { x: number; y: number }[]): KonvaEventObject<TouchEvent> {
  return {
    evt: { touches: points.map((p) => ({ clientX: p.x, clientY: p.y })) },
  } as unknown as KonvaEventObject<TouchEvent>;
}

const AT = { x: 100, y: 100 };

describe("useAimTouchGuard", () => {
  it("a stationary tap — even with sub-slop jitter — is a tap", () => {
    const { result } = renderHook(() => useAimTouchGuard());
    result.current.onTouchStart(touches(AT));
    result.current.onTouchMove(touches({ x: AT.x + 3, y: AT.y - 2 }));
    expect(result.current.consumeGesture()).toBe(false);
  });

  it("a finger that travelled past the slop was a pan, and the answer is consumed ONCE", () => {
    const { result } = renderHook(() => useAimTouchGuard());
    result.current.onTouchStart(touches(AT));
    result.current.onTouchMove(touches({ x: AT.x + AIM_TAP_SLOP_PX + 1, y: AT.y }));
    expect(result.current.consumeGesture()).toBe(true);
    // The compat click that may follow a tap must not inherit the verdict.
    expect(result.current.consumeGesture()).toBe(false);
  });

  it("a second finger already down at touchstart is a pinch", () => {
    const { result } = renderHook(() => useAimTouchGuard());
    result.current.onTouchStart(touches(AT, { x: 200, y: 100 }));
    expect(result.current.consumeGesture()).toBe(true);
  });

  it("a second finger landing mid-gesture is a pinch", () => {
    const { result } = renderHook(() => useAimTouchGuard());
    result.current.onTouchStart(touches(AT));
    result.current.onTouchMove(touches(AT, { x: 200, y: 100 }));
    expect(result.current.consumeGesture()).toBe(true);
  });

  it("the mouse path never feeds it, so a desktop click captures as before", () => {
    const { result } = renderHook(() => useAimTouchGuard());
    expect(result.current.consumeGesture()).toBe(false);
  });
});
