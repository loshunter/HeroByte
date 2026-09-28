/**
 * Gesture frames that outrun React's re-render.
 *
 * Konva calls the handlers the LAST render bound, so in a heavy scene several
 * pointer moves (and the release) can run against one render's closure before
 * React re-renders. Each `act` below runs its frames through the handlers
 * captured from a single render — nothing re-renders in between — the load
 * under which a pan lost one move step per unrendered frame. The last test
 * covers the release's render, which showed the pan one move short: that is
 * what door-pan.spec.ts read when it aimed a press 5 px off its door on CI.
 *
 * The property is exact: a pan moves the camera by exactly the pointer's
 * travel, ends with the grabbed world point under the pointer, and leaves
 * nothing for the next gesture; an outside change mid-gesture still stands.
 */
import { act, renderHook } from "@testing-library/react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useLayoutEffect } from "react";
import { describe, expect, it } from "vitest";
import { useCamera, type Camera } from "../useCamera";

type Pt = { x: number; y: number };

function setup() {
  const pointer: Pt = { x: 100, y: 100 };
  const stage = {
    current: { getPointerPosition: () => ({ ...pointer }) } as unknown as Konva.Stage,
  } as React.RefObject<Konva.Stage | null>;
  const hook = renderHook(() => useCamera());
  const down = { evt: { buttons: 1 } } as unknown as KonvaEventObject<PointerEvent>;
  /** Everything in `frames` runs against the handlers of ONE render. */
  const oneRender = (frames: (h: ReturnType<typeof useCamera>) => void) => {
    const handlers = hook.result.current;
    act(() => frames(handlers));
  };
  /**
   * A press at `from`, then `steps` moves to `to` and the release, all before
   * one re-render. (A press is a discrete event: React renders it before the
   * next event, so the moves see `isPanning`. Moves are continuous and wait.)
   */
  const drag = (from: Pt, to: Pt, steps = 6) => {
    Object.assign(pointer, from);
    act(() => hook.result.current.onMouseDown(down, stage, true));
    oneRender((h) => {
      for (let i = 1; i <= steps; i++) {
        Object.assign(pointer, {
          x: from.x + ((to.x - from.x) * i) / steps,
          y: from.y + ((to.y - from.y) * i) / steps,
        });
        h.onMouseMove(stage);
      }
      h.onMouseUp();
    });
  };
  return { pointer, stage, hook, down, oneRender, drag };
}

function touches(...points: Pt[]): KonvaEventObject<TouchEvent> {
  return {
    evt: {
      touches: points.map((p) => ({ clientX: p.x, clientY: p.y })),
      preventDefault: () => {},
    },
  } as unknown as KonvaEventObject<TouchEvent>;
}

const noStage = { current: null } as React.RefObject<Konva.Stage | null>;

describe("useCamera — frames that outrun the re-render", () => {
  it("moves before a re-render: the pan still travels exactly with the pointer", () => {
    const { pointer, stage, hook, down, oneRender } = setup();
    act(() => hook.result.current.onMouseDown(down, stage, true));
    oneRender((h) => {
      for (const x of [110, 120, 130]) {
        pointer.x = x;
        h.onMouseMove(stage);
      }
    });
    expect(hook.result.current.cam).toEqual({ x: 30, y: 0, scale: 1 });
    // And from a fresh render onward it keeps accruing, nothing lost or doubled.
    pointer.x = 140;
    act(() => hook.result.current.onMouseMove(stage));
    expect(hook.result.current.cam).toEqual({ x: 40, y: 0, scale: 1 });
  });

  it("a pan ends exactly under the pointer and nothing carries into the next pan", () => {
    const { hook, drag } = setup();
    // The door-pan setup drag, then a purely horizontal pan.
    drag({ x: 300, y: 300 }, { x: 304, y: 250 });
    expect(hook.result.current.cam).toEqual({ x: 4, y: -50, scale: 1 });
    drag({ x: 320, y: 280 }, { x: 400, y: 280 });
    expect(hook.result.current.cam).toEqual({ x: 84, y: -50, scale: 1 });
  });

  it("an outside change between unrendered frames still stands, and the travel is kept in full", () => {
    const { pointer, stage, down, hook, oneRender } = setup();
    act(() => hook.result.current.onMouseDown(down, stage, true));
    oneRender((h) => {
      pointer.x = 110;
      h.onMouseMove(stage);
      // A move-pad follow glide frame writes through the functional setter.
      h.setCam((prev) => ({ ...prev, y: prev.y - 100 }));
      pointer.x = 120;
      h.onMouseMove(stage);
      pointer.x = 130;
      h.onMouseMove(stage);
    });
    expect(hook.result.current.cam).toEqual({ x: 30, y: -100, scale: 1 });
  });

  it("a wheel zoom between unrendered frames zooms the camera the pan has reached, and stands", () => {
    const { pointer, stage, down, hook, oneRender } = setup();
    act(() => hook.result.current.onMouseDown(down, stage, true));
    const wheel = {
      evt: { deltaY: -100, preventDefault: () => {} },
    } as unknown as KonvaEventObject<WheelEvent>;
    oneRender((h) => {
      pointer.x = 110;
      h.onMouseMove(stage);
      pointer.x = 120;
      h.onMouseMove(stage);
      h.onWheel(wheel, stage);
    });
    // Zoomed 1.08x about the pointer (120,100) from the camera at (20,0).
    const zoomed = { x: 120 - 100 * 1.08, y: 100 - 100 * 1.08, scale: 1.08 };
    const cam = hook.result.current.cam;
    expect(cam.scale).toBeCloseTo(zoomed.scale, 10);
    expect(cam.x).toBeCloseTo(zoomed.x, 10);
    expect(cam.y).toBeCloseTo(zoomed.y, 10);
    pointer.x = 130;
    act(() => hook.result.current.onMouseMove(stage));
    expect(hook.result.current.cam.x).toBeCloseTo(zoomed.x + 10, 10);
    expect(hook.result.current.cam.y).toBeCloseTo(zoomed.y, 10);
    expect(hook.result.current.cam.scale).toBeCloseTo(zoomed.scale, 10);
  });

  it("a one-finger pan: unrendered frames travel exactly with the finger", () => {
    const { hook, oneRender } = setup();
    act(() => hook.result.current.onTouchStart(touches({ x: 100, y: 100 }), noStage, true));
    oneRender((h) => {
      for (const y of [92, 84, 76, 68]) h.onTouchMove(touches({ x: 100, y }), noStage);
      h.onTouchEnd();
    });
    expect(hook.result.current.cam).toEqual({ x: 0, y: -32, scale: 1 });
  });

  it("a pinch: unrendered frames keep the grabbed point under the fingers at the right scale", () => {
    const { hook, oneRender } = setup();
    act(() =>
      hook.result.current.onTouchStart(
        touches({ x: 150, y: 400 }, { x: 250, y: 400 }),
        noStage,
        false,
      ),
    );
    // Centre (200,400) grabs world (200,400); spread 100 -> 150 -> 200 while
    // the centre slides to (260,400), all before one re-render.
    oneRender((h) => {
      h.onTouchMove(touches({ x: 155, y: 400 }, { x: 305, y: 400 }), noStage);
      h.onTouchMove(touches({ x: 160, y: 400 }, { x: 360, y: 400 }), noStage);
    });
    const cam = hook.result.current.cam;
    expect(cam.scale).toBeCloseTo(2, 10);
    expect((260 - cam.x) / cam.scale).toBeCloseTo(200, 10);
    expect((400 - cam.y) / cam.scale).toBeCloseTo(400, 10);
  });
});

describe("useCamera — the release renders before a move still waiting", () => {
  type Handlers = ReturnType<typeof useCamera>;
  /**
   * No `act` here: each handler runs inside a real DOM event of its kind, so
   * React gives its update that event's priority. A move is continuous input,
   * rendered in a later task; a release is discrete, rendered in a microtask,
   * and that render leaves the waiting move out. The release must still show
   * the pan where the pointer let go: whatever reads the camera next (the spec
   * aiming its next press) was one move off.
   */
  async function rendersAroundRelease(
    start: (h: Handlers) => void,
    move: (h: Handlers) => void,
    release: (h: Handlers) => void,
    [moveType, releaseType]: [string, string],
  ) {
    const renders: Array<{ cam: Camera; isPanning: boolean }> = [];
    const hook = renderHook(() => {
      const camera = useCamera();
      useLayoutEffect(() => {
        renders.push({ cam: camera.cam, isPanning: camera.isPanning });
      });
      return camera;
    });
    act(() => start(hook.result.current));
    const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const previous = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      const during = (type: string, handler: () => void) => {
        document.body.addEventListener(type, handler, { once: true });
        document.body.dispatchEvent(new Event(type));
      };
      const handlers = hook.result.current;
      during(moveType, () => move(handlers));
      during(releaseType, () => release(handlers));
      await Promise.resolve();
      const atRelease = renders.at(-1);
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { atRelease, settled: renders.at(-1) };
    } finally {
      actEnvironment.IS_REACT_ACT_ENVIRONMENT = previous;
    }
  }

  it("a mouse release's own render shows the pan's last move", async () => {
    const pointer: Pt = { x: 100, y: 100 };
    const stage = {
      current: { getPointerPosition: () => ({ ...pointer }) } as unknown as Konva.Stage,
    } as React.RefObject<Konva.Stage | null>;
    const down = { evt: { buttons: 1 } } as unknown as KonvaEventObject<PointerEvent>;
    const { atRelease, settled } = await rendersAroundRelease(
      (h) => h.onMouseDown(down, stage, true),
      (h) => {
        pointer.x = 130;
        h.onMouseMove(stage);
      },
      (h) => h.onMouseUp(),
      ["mousemove", "mouseup"],
    );
    const ended = { cam: { x: 30, y: 0, scale: 1 }, isPanning: false };
    expect(atRelease).toEqual(ended);
    expect(settled).toEqual(ended);
  });

  it("so does a finger's lift", async () => {
    const { atRelease, settled } = await rendersAroundRelease(
      (h) => h.onTouchStart(touches({ x: 100, y: 100 }), noStage, true),
      (h) => h.onTouchMove(touches({ x: 100, y: 70 }), noStage),
      (h) => h.onTouchEnd(),
      ["touchmove", "touchend"],
    );
    const ended = { cam: { x: 0, y: -30, scale: 1 }, isPanning: false };
    expect(atRelease).toEqual(ended);
    expect(settled).toEqual(ended);
  });
});
