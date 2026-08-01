/**
 * Pinch anchor invariance.
 *
 * The property that matters to a user is simple: whatever was under your
 * fingers when the pinch started stays under them for the whole gesture. These
 * assert it with exact arithmetic rather than "the camera moved", because the
 * bug this covers was invisible to any looser check — it is identically zero
 * for a pure zoom and identically zero for a pure two-finger drag, and only
 * appears when the two happen together.
 */
import { act, renderHook } from "@testing-library/react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { describe, expect, it } from "vitest";
import { useCamera } from "../useCamera";

const stageRef = { current: null } as React.RefObject<Konva.Stage | null>;

function touches(...points: { x: number; y: number }[]): KonvaEventObject<TouchEvent> {
  return {
    evt: {
      touches: points.map((p) => ({ clientX: p.x, clientY: p.y })),
      preventDefault: () => {},
    },
  } as unknown as KonvaEventObject<TouchEvent>;
}

/** Screen point -> world point under the given camera. */
function toWorld(cam: { x: number; y: number; scale: number }, screen: { x: number; y: number }) {
  return { x: (screen.x - cam.x) / cam.scale, y: (screen.y - cam.y) / cam.scale };
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

describe("useCamera — pinch anchor", () => {
  /**
   * The regression case. Zoom roughly 2x while sliding the centre 100px right.
   * The old incremental form landed (c - c0) * (1 - scale/scale0) away, i.e.
   * about a full 100px off, with the map visibly sliding out from under the
   * fingers.
   */
  it("keeps the grabbed world point under the fingers when zooming AND sliding", () => {
    const { result } = renderHook(() => useCamera());

    const startA = { x: 150, y: 400 };
    const startB = { x: 250, y: 400 };
    const startCenter = midpoint(startA, startB);
    const grabbed = toWorld(result.current.cam, startCenter);

    act(() => result.current.onTouchStart(touches(startA, startB), stageRef, false));

    // Separation 100 -> 200 (2x) and the centre travels +100 in x.
    const endA = { x: 200, y: 400 };
    const endB = { x: 400, y: 400 };
    act(() => result.current.onTouchMove(touches(endA, endB), stageRef));

    const endCenter = midpoint(endA, endB);
    const nowUnderFingers = toWorld(result.current.cam, endCenter);

    expect(result.current.cam.scale).toBeCloseTo(2, 10);
    expect(nowUnderFingers.x).toBeCloseTo(grabbed.x, 10);
    expect(nowUnderFingers.y).toBeCloseTo(grabbed.y, 10);
  });

  it("holds the anchor for a pure zoom with a still centre", () => {
    const { result } = renderHook(() => useCamera());

    const startA = { x: 300, y: 300 };
    const startB = { x: 400, y: 300 };
    const grabbed = toWorld(result.current.cam, midpoint(startA, startB));

    act(() => result.current.onTouchStart(touches(startA, startB), stageRef, false));
    act(() =>
      result.current.onTouchMove(touches({ x: 275, y: 300 }, { x: 425, y: 300 }), stageRef),
    );

    const under = toWorld(result.current.cam, midpoint({ x: 275, y: 300 }, { x: 425, y: 300 }));
    expect(result.current.cam.scale).toBeCloseTo(1.5, 10);
    expect(under.x).toBeCloseTo(grabbed.x, 10);
    expect(under.y).toBeCloseTo(grabbed.y, 10);
  });

  it("holds the anchor for a pure two-finger drag with no scale change", () => {
    const { result } = renderHook(() => useCamera());

    const startA = { x: 200, y: 200 };
    const startB = { x: 300, y: 200 };
    const grabbed = toWorld(result.current.cam, midpoint(startA, startB));

    act(() => result.current.onTouchStart(touches(startA, startB), stageRef, false));
    // Same separation, both fingers translated.
    const endA = { x: 260, y: 245 };
    const endB = { x: 360, y: 245 };
    act(() => result.current.onTouchMove(touches(endA, endB), stageRef));

    const under = toWorld(result.current.cam, midpoint(endA, endB));
    expect(result.current.cam.scale).toBeCloseTo(1, 10);
    expect(under.x).toBeCloseTo(grabbed.x, 10);
    expect(under.y).toBeCloseTo(grabbed.y, 10);
  });

  /**
   * At the clamp the scale ratio no longer equals the finger-distance ratio,
   * which is where the old form drifted hardest. The anchor must still hold.
   */
  it("holds the anchor while the scale is clamped at the maximum", () => {
    const { result } = renderHook(() => useCamera({ maxScale: 3 }));

    const startA = { x: 100, y: 500 };
    const startB = { x: 140, y: 500 };
    const grabbed = toWorld(result.current.cam, midpoint(startA, startB));

    act(() => result.current.onTouchStart(touches(startA, startB), stageRef, false));
    // 40 -> 400 would be 10x; the clamp pins it to 3, and the centre slides too.
    const endA = { x: 150, y: 520 };
    const endB = { x: 550, y: 520 };
    act(() => result.current.onTouchMove(touches(endA, endB), stageRef));

    const under = toWorld(result.current.cam, midpoint(endA, endB));
    expect(result.current.cam.scale).toBe(3);
    expect(under.x).toBeCloseTo(grabbed.x, 10);
    expect(under.y).toBeCloseTo(grabbed.y, 10);
  });

  /**
   * Every other case here starts from the identity camera, where the
   * translate-and-divide in `pointTo` is indistinguishable from a no-op. This
   * one starts panned and zoomed so the coordinate transform is actually
   * exercised.
   */
  it("holds the anchor from an already panned and zoomed camera", () => {
    const { result } = renderHook(() => useCamera());

    act(() => result.current.setCam({ x: -220, y: 96, scale: 2.5 }));

    const startA = { x: 320, y: 260 };
    const startB = { x: 420, y: 360 };
    const grabbed = toWorld(result.current.cam, midpoint(startA, startB));

    act(() => result.current.onTouchStart(touches(startA, startB), stageRef, false));
    const endA = { x: 300, y: 300 };
    const endB = { x: 500, y: 500 };
    act(() => result.current.onTouchMove(touches(endA, endB), stageRef));

    const under = toWorld(result.current.cam, midpoint(endA, endB));
    expect(result.current.cam.scale).toBeCloseTo(5, 10);
    expect(under.x).toBeCloseTo(grabbed.x, 10);
    expect(under.y).toBeCloseTo(grabbed.y, 10);
  });

  it("does not jump on the first move of a gesture that has not changed yet", () => {
    const { result } = renderHook(() => useCamera());
    const before = { ...result.current.cam };

    const a = { x: 180, y: 320 };
    const b = { x: 280, y: 320 };
    act(() => result.current.onTouchStart(touches(a, b), stageRef, false));
    act(() => result.current.onTouchMove(touches(a, b), stageRef));

    expect(result.current.cam.x).toBeCloseTo(before.x, 10);
    expect(result.current.cam.y).toBeCloseTo(before.y, 10);
    expect(result.current.cam.scale).toBeCloseTo(before.scale, 10);
  });
});
