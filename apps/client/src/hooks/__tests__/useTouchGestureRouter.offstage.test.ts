import { act, cleanup, renderHook } from "@testing-library/react";
import { createElement, StrictMode, type PropsWithChildren } from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArmedTouchTool } from "../useArmedTouchTool";
import { useTouchGestureRouter } from "../useTouchGestureRouter";

const surfaces: HTMLElement[] = [];

afterEach(() => {
  cleanup();
  surfaces.splice(0).forEach((surface) => surface.remove());
});

function makeTool() {
  return { start: vi.fn(), move: vi.fn(), commit: vi.fn(), cancel: vi.fn() };
}

function touch(target: HTMLElement, type: string, fingers: number) {
  // Dispatch a real DOM TouchEvent: the off-stage event never calls a stage
  // handler, and document capture must see it before the target can stop it.
  const event = new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    touches: Array.from({ length: fingers }, (_, identifier) => ({
      identifier,
      target,
      clientX: 0,
      clientY: 0,
      pageX: 0,
      pageY: 0,
      screenX: 0,
      screenY: 0,
      radiusX: 1,
      radiusY: 1,
      rotationAngle: 0,
      force: 1,
    })),
  });
  act(() => target.dispatchEvent(event));
  return event;
}

function harness(options: { armed?: boolean; strict?: boolean } = {}) {
  const stageElement = document.createElement("div");
  const outside = document.createElement("aside");
  document.body.append(stageElement, outside);
  surfaces.push(stageElement, outside);
  const stage = { container: () => stageElement } as unknown as Konva.Stage;
  const stageRef = { current: stage };
  const tool = makeTool();
  const cameraStart = vi.fn();
  const cameraMove = vi.fn();
  const cameraEnd = vi.fn();
  const hook = renderHook(
    ({ currentTool }: { currentTool: ArmedTouchTool | null }) =>
      useTouchGestureRouter({
        tool: currentTool,
        shouldPan: currentTool === null,
        stageRef,
        onCameraStart: cameraStart,
        onCameraMove: cameraMove,
        onCameraEnd: cameraEnd,
      }),
    {
      initialProps: { currentTool: options.armed === false ? null : tool },
      wrapper: options.strict
        ? ({ children }: PropsWithChildren) => createElement(StrictMode, null, children)
        : undefined,
    },
  );
  stageElement.addEventListener("touchstart", (event) =>
    hook.result.current.onTouchStart({
      evt: event,
      target: stage,
    } as unknown as KonvaEventObject<TouchEvent>),
  );
  stageElement.addEventListener("touchmove", (event) =>
    hook.result.current.onTouchMove({
      evt: event,
      target: stage,
    } as unknown as KonvaEventObject<TouchEvent>),
  );
  stageElement.addEventListener("touchend", () => hook.result.current.onTouchEnd());
  return { ...hook, stageElement, outside, tool, cameraStart, cameraMove, cameraEnd };
}

describe("document-wide second-finger cancellation", () => {
  it.each(["canvas first", "outside first"])(
    "cancels before either finger lifts without a stage move (%s), then accepts a fresh gesture",
    (liftOrder) => {
      const h = harness();
      touch(h.stageElement, "touchstart", 1);
      expect(h.tool.start).toHaveBeenCalledOnce();

      const second = touch(h.outside, "touchstart", 2);
      expect(h.tool.cancel).toHaveBeenCalledOnce();
      expect(h.tool.move).not.toHaveBeenCalled();
      expect(h.tool.commit).not.toHaveBeenCalled();
      expect(second.defaultPrevented).toBe(false);
      // The external target never enters the camera or tool stage handlers.
      expect(h.cameraStart).toHaveBeenCalledOnce();

      const lifts =
        liftOrder === "canvas first" ? [h.stageElement, h.outside] : [h.outside, h.stageElement];
      touch(lifts[0]!, "touchend", 1);
      expect(h.tool.commit).not.toHaveBeenCalled();
      touch(lifts[1]!, "touchend", 0);
      expect(h.tool.commit).not.toHaveBeenCalled();
      expect(h.tool.cancel).toHaveBeenCalledOnce();

      touch(h.stageElement, "touchstart", 1);
      touch(h.stageElement, "touchend", 0);
      expect(h.tool.start).toHaveBeenCalledTimes(2);
      expect(h.tool.commit).toHaveBeenCalledOnce();
      expect(h.tool.cancel).toHaveBeenCalledOnce();
    },
  );

  it("cancels during capture even when the inert external target stops bubbling", () => {
    const h = harness();
    let cancelsAtTarget = 0;
    const targetHandler = vi.fn((event: Event) => {
      cancelsAtTarget = h.tool.cancel.mock.calls.length;
      event.stopPropagation();
    });
    h.outside.addEventListener("touchstart", targetHandler);
    touch(h.stageElement, "touchstart", 1);

    touch(h.outside, "touchstart", 2);
    expect(targetHandler).toHaveBeenCalledOnce();
    expect(cancelsAtTarget).toBe(1);
    expect(h.tool.cancel).toHaveBeenCalledOnce();
    touch(h.stageElement, "touchend", 1);
    touch(h.outside, "touchend", 0);
    expect(h.tool.commit).not.toHaveBeenCalled();
  });

  it("does nothing while idle or for an external single-finger event", () => {
    const h = harness();
    touch(h.outside, "touchstart", 2);
    touch(h.outside, "touchstart", 1);
    expect(h.tool.start).not.toHaveBeenCalled();
    expect(h.tool.cancel).not.toHaveBeenCalled();
    expect(h.cameraStart).not.toHaveBeenCalled();

    touch(h.stageElement, "touchstart", 1);
    touch(h.outside, "touchstart", 1);
    expect(h.tool.cancel).not.toHaveBeenCalled();
    touch(h.stageElement, "touchend", 0);
    expect(h.tool.commit).toHaveBeenCalledOnce();
  });

  it("does not cancel a camera-only gesture when an off-stage finger arrives", () => {
    const h = harness({ armed: false });
    touch(h.stageElement, "touchstart", 1);
    touch(h.outside, "touchstart", 2);
    touch(h.stageElement, "touchend", 1);
    expect(h.tool.start).not.toHaveBeenCalled();
    expect(h.tool.cancel).not.toHaveBeenCalled();
    expect(h.tool.commit).not.toHaveBeenCalled();
    expect(h.cameraStart).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      expect.anything(),
      true,
    );
    expect(h.cameraEnd).toHaveBeenCalledOnce();
  });

  it("cancels exactly once when the second start also reaches the stage and still routes pinch", () => {
    const h = harness();
    touch(h.stageElement, "touchstart", 1);
    touch(h.stageElement, "touchstart", 2);
    expect(h.tool.cancel).toHaveBeenCalledOnce();
    expect(h.tool.start).toHaveBeenCalledOnce();
    expect(h.cameraStart).toHaveBeenCalledTimes(2);

    touch(h.stageElement, "touchmove", 2);
    expect(h.tool.move).not.toHaveBeenCalled();
    expect(h.cameraMove).toHaveBeenCalledOnce();
    touch(h.stageElement, "touchend", 1);
    touch(h.stageElement, "touchend", 0);
    expect(h.cameraEnd).toHaveBeenCalledTimes(2);
    expect(h.tool.cancel).toHaveBeenCalledOnce();
    expect(h.tool.commit).not.toHaveBeenCalled();
  });

  it("uses the latest cancel handler after the tool rerenders mid-gesture", () => {
    const h = harness();
    touch(h.stageElement, "touchstart", 1);
    const freshTool = makeTool();
    h.rerender({ currentTool: freshTool });

    touch(h.outside, "touchstart", 2);
    expect(freshTool.cancel).toHaveBeenCalledOnce();
    expect(h.tool.cancel).not.toHaveBeenCalled();
    touch(h.stageElement, "touchend", 1);
    expect(freshTool.commit).not.toHaveBeenCalled();
    expect(h.tool.commit).not.toHaveBeenCalled();
  });

  it("removes the global listener on unmount and remains usable after StrictMode effect replay", () => {
    const retired = harness();
    touch(retired.stageElement, "touchstart", 1);
    retired.unmount();
    const cancelledAtUnmount = retired.tool.cancel.mock.calls.length;
    const current = harness({ strict: true });
    touch(current.stageElement, "touchstart", 1);

    touch(current.outside, "touchstart", 2);
    expect(retired.tool.cancel).toHaveBeenCalledTimes(cancelledAtUnmount);
    expect(current.tool.cancel).toHaveBeenCalledOnce();
    touch(current.stageElement, "touchend", 1);
    touch(current.outside, "touchend", 0);
    expect(current.tool.commit).not.toHaveBeenCalled();

    touch(current.stageElement, "touchstart", 1);
    touch(current.stageElement, "touchend", 0);
    expect(current.tool.commit).toHaveBeenCalledOnce();
  });
});
