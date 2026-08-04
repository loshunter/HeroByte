/**
 * Tests for usePointerTool's measurement broadcast (S6)
 *
 * The hook had no test at all before this, and MapBoard.test.tsx replaces it
 * with `() => ({})`, so nothing exercised the real click cycle.
 *
 * What matters here is traffic discipline as much as correctness: the rubber
 * band updates on every mouse move, and an unthrottled send would eat most of
 * the 100-messages-per-second per-uid budget on one gesture.
 *
 * Source: apps/client/src/hooks/usePointerTool.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ClientMessage } from "@herobyte/shared";
import { usePointerTool } from "../usePointerTool";

/** Konva stage stub: getPointerPosition is all the hook asks for. */
function stageRef(x: number, y: number) {
  return { current: { getPointerPosition: () => ({ x, y }) } } as never;
}

function clickEvent(x: number, y: number) {
  return {
    target: { getStage: () => ({ getPointerPosition: () => ({ x, y }) }) },
  } as never;
}

const toWorld = (x: number, y: number) => ({ x, y });

function measureFrames(send: ReturnType<typeof vi.fn>) {
  return send.mock.calls
    .map(([message]) => message as ClientMessage)
    .filter((message) => message.t === "measure");
}

describe("usePointerTool — broadcasting the measurement", () => {
  let sendMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    sendMessage = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mount(measureMode = true) {
    return renderHook(
      (props: { measureMode: boolean }) =>
        usePointerTool({
          pointerMode: false,
          measureMode: props.measureMode,
          toWorld,
          sendMessage,
        }),
      { initialProps: { measureMode } },
    );
  }

  it("says nothing until a measurement has an end point", () => {
    const { result } = mount();
    act(() => result.current.onStageClick(clickEvent(10, 10)));

    expect(measureFrames(sendMessage)).toHaveLength(0);
  });

  it("broadcasts the committing click immediately, unthrottled", () => {
    const { result } = mount();
    act(() => result.current.onStageClick(clickEvent(10, 10)));
    act(() => result.current.onStageClick(clickEvent(110, 10)));

    expect(measureFrames(sendMessage)).toEqual([
      { t: "measure", measure: { start: { x: 10, y: 10 }, end: { x: 110, y: 10 } } },
    ]);
  });

  it("throttles the drag: a burst of moves is not a burst of messages", () => {
    const { result } = mount();
    act(() => result.current.onStageClick(clickEvent(10, 10)));

    // Twenty frames inside one throttle window.
    act(() => {
      for (let i = 0; i < 20; i += 1) {
        result.current.onMouseMove(stageRef(20 + i, 10));
      }
    });

    // The leading edge went out at once; the rest are coalesced.
    expect(measureFrames(sendMessage).length).toBeLessThanOrEqual(2);
  });

  it("always publishes the LAST position, so no one is left looking at a stale line", () => {
    const { result } = mount();
    act(() => result.current.onStageClick(clickEvent(10, 10)));
    act(() => {
      result.current.onMouseMove(stageRef(20, 10));
      result.current.onMouseMove(stageRef(30, 10));
      result.current.onMouseMove(stageRef(999, 10));
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    const last = measureFrames(sendMessage).at(-1);
    expect(last).toEqual({
      t: "measure",
      measure: { start: { x: 10, y: 10 }, end: { x: 999, y: 10 } },
    });
  });

  it("clears everyone's copy when the tool is put away", () => {
    const { result, rerender } = mount();
    act(() => result.current.onStageClick(clickEvent(10, 10)));
    act(() => result.current.onStageClick(clickEvent(110, 10)));
    sendMessage.mockClear();

    rerender({ measureMode: false });

    expect(measureFrames(sendMessage)).toEqual([{ t: "measure", measure: null }]);
  });

  it("clears the finished line when a new measurement is anchored", () => {
    const { result } = mount();
    act(() => result.current.onStageClick(clickEvent(10, 10)));
    act(() => result.current.onStageClick(clickEvent(110, 10)));
    sendMessage.mockClear();

    act(() => result.current.onStageClick(clickEvent(200, 200)));

    expect(measureFrames(sendMessage)).toEqual([{ t: "measure", measure: null }]);
  });

  it("sends no clear at all when nothing was ever measured", () => {
    // Arming and disarming the tool must not cost the table a message.
    const { rerender } = mount();
    rerender({ measureMode: false });

    expect(measureFrames(sendMessage)).toHaveLength(0);
  });

  it("clears on unmount, so leaving the table strands no line", () => {
    const { result, unmount } = mount();
    act(() => result.current.onStageClick(clickEvent(10, 10)));
    act(() => result.current.onStageClick(clickEvent(110, 10)));
    sendMessage.mockClear();

    unmount();

    expect(measureFrames(sendMessage)).toEqual([{ t: "measure", measure: null }]);
  });

  it("never broadcasts while the pointer (ping) tool is the active one", () => {
    const { result } = renderHook(() =>
      usePointerTool({ pointerMode: true, measureMode: false, toWorld, sendMessage }),
    );
    act(() => result.current.onStageClick(clickEvent(10, 10)));
    act(() => result.current.onMouseMove(stageRef(50, 50)));

    expect(measureFrames(sendMessage)).toHaveLength(0);
    expect(sendMessage).toHaveBeenCalledWith({ t: "point", x: 10, y: 10 });
  });
});

describe("usePointerTool — the measure click cycle", () => {
  let sendMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    sendMessage = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mount() {
    return renderHook(() =>
      usePointerTool({ pointerMode: false, measureMode: true, toWorld, sendMessage }),
    );
  }

  it("anchors on the first click and rubber-bands with the mouse", () => {
    const { result } = mount();
    act(() => result.current.onStageClick(clickEvent(10, 10)));
    act(() => result.current.onMouseMove(stageRef(90, 10)));

    expect(result.current.measureStart).toEqual({ x: 10, y: 10 });
    expect(result.current.measureEnd).toEqual({ x: 90, y: 10 });
  });

  it("FREEZES on the second click instead of wiping the measurement", () => {
    // The pre-existing defect: the cycle keyed on measureEnd, which onMouseMove
    // had already set, so the second click took the "start over" branch and the
    // reading vanished. With the broadcast in place it also relayed a CLEAR to
    // the whole table, one frame after showing them the line.
    const { result } = mount();
    act(() => result.current.onStageClick(clickEvent(10, 10)));
    act(() => result.current.onMouseMove(stageRef(90, 10)));
    act(() => result.current.onStageClick(clickEvent(110, 10)));

    expect(result.current.measureStart).toEqual({ x: 10, y: 10 });
    expect(result.current.measureEnd).toEqual({ x: 110, y: 10 });
    expect(measureFrames(sendMessage).at(-1)).toEqual({
      t: "measure",
      measure: { start: { x: 10, y: 10 }, end: { x: 110, y: 10 } },
    });
  });

  it("holds the frozen reading while the mouse keeps moving", () => {
    const { result } = mount();
    act(() => result.current.onStageClick(clickEvent(10, 10)));
    act(() => result.current.onStageClick(clickEvent(110, 10)));
    sendMessage.mockClear();

    act(() => result.current.onMouseMove(stageRef(400, 400)));
    act(() => vi.advanceTimersByTime(200));

    expect(result.current.measureEnd).toEqual({ x: 110, y: 10 });
    expect(measureFrames(sendMessage)).toHaveLength(0);
  });

  it("ignores a second click that never left the anchor", () => {
    // REACHABLE ON TOUCH: a tap fires Konva's `tap` AND the browser's
    // compatibility click, so one finger would otherwise anchor and instantly
    // freeze a 0 ft reading — and broadcast it to the whole table.
    const { result } = mount();
    act(() => result.current.onStageClick(clickEvent(10, 10)));
    act(() => result.current.onStageClick(clickEvent(10, 10)));

    expect(result.current.measureEnd).toBeNull();
    expect(measureFrames(sendMessage)).toHaveLength(0);

    // ...and the tool is still armed, so the next tap elsewhere commits.
    act(() => result.current.onStageClick(clickEvent(110, 10)));
    expect(result.current.measureEnd).toEqual({ x: 110, y: 10 });
  });

  it("re-anchors on the third click", () => {
    const { result } = mount();
    act(() => result.current.onStageClick(clickEvent(10, 10)));
    act(() => result.current.onStageClick(clickEvent(110, 10)));
    act(() => result.current.onStageClick(clickEvent(300, 300)));

    expect(result.current.measureStart).toEqual({ x: 300, y: 300 });
    expect(result.current.measureEnd).toBeNull();
    expect(measureFrames(sendMessage).at(-1)).toEqual({ t: "measure", measure: null });
  });
});
