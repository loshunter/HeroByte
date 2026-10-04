import { act, cleanup, renderHook } from "@testing-library/react";
import { createElement, StrictMode, type PropsWithChildren } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { afterEach, describe, expect, it } from "vitest";
import { useAimTouchGuard } from "../useAimTouchGuard";

afterEach(cleanup);

function touches(target: EventTarget, count: number) {
  return new TouchEvent("touchstart", {
    bubbles: true,
    cancelable: true,
    touches: Array.from({ length: count }, (_, identifier) => ({
      identifier,
      target,
      clientX: 20,
      clientY: 30,
      pageX: 20,
      pageY: 30,
      screenX: 20,
      screenY: 30,
      radiusX: 1,
      radiusY: 1,
      rotationAngle: 0,
      force: 1,
    })),
  });
}

function harness(strict = false) {
  const hook = renderHook(useAimTouchGuard, {
    wrapper: strict
      ? ({ children }: PropsWithChildren) => createElement(StrictMode, null, children)
      : undefined,
  });
  const stageStart = () =>
    act(() =>
      hook.result.current.onTouchStart({
        evt: touches(document.body, 1),
      } as KonvaEventObject<TouchEvent>),
    );
  const outsideStart = (count: number) => {
    const event = touches(document.body, count);
    act(() => document.body.dispatchEvent(event));
    return event;
  };
  return { ...hook, stageStart, outsideStart };
}

describe("Atlas aim with an offstage second finger", () => {
  it("rejects the stationary sequence without a stage move and accepts a fresh tap", () => {
    const h = harness();
    h.stageStart();
    expect(h.outsideStart(2).defaultPrevented).toBe(false);
    expect(h.result.current.consumeGesture()).toBe(true);
    h.stageStart();
    expect(h.result.current.consumeGesture()).toBe(false);
  });

  it("observes capture even if the external target stops bubbling", () => {
    const h = harness();
    const stop = (event: Event) => event.stopPropagation();
    document.body.addEventListener("touchstart", stop);
    try {
      h.stageStart();
      h.outsideStart(2);
      expect(h.result.current.consumeGesture()).toBe(true);
    } finally {
      document.body.removeEventListener("touchstart", stop);
    }
  });

  it("ignores idle multi-touch and external single-touch", () => {
    const h = harness();
    h.outsideStart(2);
    expect(h.result.current.consumeGesture()).toBe(false);
    h.stageStart();
    h.outsideStart(1);
    expect(h.result.current.consumeGesture()).toBe(false);
  });

  it("removes its listener on disposal and reinstalls it after effect replay", () => {
    const retired = harness();
    retired.stageStart();
    retired.unmount();
    const current = harness(true);
    current.stageStart();
    current.outsideStart(2);
    expect(retired.result.current.consumeGesture()).toBe(false);
    expect(current.result.current.consumeGesture()).toBe(true);
  });
});
