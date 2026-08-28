/**
 * Which tool owns the finger.
 *
 * The three modes are mutually exclusive in production (all three derive from
 * one `activeTool` value), so these tests set them independently on purpose:
 * that is the only way to pin the precedence the hook actually encodes, rather
 * than the precedence the caller happens to make unreachable.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useArmedTouchTool, type UseArmedTouchToolProps } from "../useArmedTouchTool";

const stageRef = { current: null } as React.RefObject<Konva.Stage | null>;
const touchEvent = {} as KonvaEventObject<TouchEvent>;

function makeProps(overrides: Partial<UseArmedTouchToolProps> = {}): UseArmedTouchToolProps {
  return {
    drawMode: false,
    selectMode: false,
    mapEditTouchMode: false,
    handleDrawMouseDown: vi.fn(),
    handleDrawMouseMove: vi.fn(),
    handleDrawMouseUp: vi.fn(),
    handleDrawCancel: vi.fn(),
    handleMarqueePointerDown: vi.fn(),
    handleMarqueePointerMove: vi.fn(),
    handleMarqueePointerUp: vi.fn(),
    handleMarqueeCancel: vi.fn(),
    handleMapEditMouseDown: vi.fn(),
    handleMapEditMouseMove: vi.fn(),
    handleMapEditMouseUp: vi.fn(),
    handleMapEditCancel: vi.fn(),
    ...overrides,
  };
}

describe("useArmedTouchTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("arms nothing when no tool owns the pointer — the finger is the camera's", () => {
    const { result } = renderHook(() => useArmedTouchTool(makeProps()));
    expect(result.current).toBeNull();
  });

  it("map-edit's armed sub-tools take the finger: down, move, up all reach the tool", () => {
    const props = makeProps({ mapEditTouchMode: true });
    const { result } = renderHook(() => useArmedTouchTool(props));

    result.current!.start(touchEvent, stageRef);
    result.current!.move(stageRef);
    result.current!.commit();

    // The "touch" discriminator is the whole reason these handlers take one:
    // a click tool drops on PRESS for a mouse and on RELEASE for a finger, and
    // this hook is the only caller that knows which is happening. Passing the
    // stageRef alone would silently give a finger the mouse's gesture.
    expect(props.handleMapEditMouseDown).toHaveBeenCalledWith(stageRef, "touch");
    expect(props.handleMapEditMouseMove).toHaveBeenCalledWith(stageRef, "touch");
    expect(props.handleMapEditMouseUp).toHaveBeenCalledWith("touch");
    // Nothing else may be listening to the same finger.
    expect(props.handleDrawMouseDown).not.toHaveBeenCalled();
    expect(props.handleMarqueePointerDown).not.toHaveBeenCalled();
  });

  it("cancel is map-edit's OWN cancel — the second finger must discard, never commit", () => {
    const props = makeProps({ mapEditTouchMode: true });
    const { result } = renderHook(() => useArmedTouchTool(props));

    result.current!.cancel();

    expect(props.handleMapEditCancel).toHaveBeenCalledTimes(1);
    expect(props.handleMapEditMouseUp).not.toHaveBeenCalled();
    expect(props.handleDrawCancel).not.toHaveBeenCalled();
  });

  it("map-edit with SELECT arms nothing — it resolves on the compat mouse path", () => {
    // mapEditTouchMode is false for select alone now that M6 and M7 armed the
    // brush and click classes. Arming it here would run it TWICE: the compat
    // mouse pair already resolves it, and a claimed touchstart would suppress
    // that pair and change a working tool for no reason. Camera-only is the
    // correct answer, not a fallback.
    const { result } = renderHook(() => useArmedTouchTool(makeProps({ mapEditTouchMode: false })));
    expect(result.current).toBeNull();
  });

  it("still arms drawing and the marquee", () => {
    const draw = makeProps({ drawMode: true });
    const { result: drawResult } = renderHook(() => useArmedTouchTool(draw));
    drawResult.current!.start(touchEvent, stageRef);
    drawResult.current!.cancel();
    expect(draw.handleDrawMouseDown).toHaveBeenCalledWith(stageRef);
    expect(draw.handleDrawCancel).toHaveBeenCalledTimes(1);

    const select = makeProps({ selectMode: true });
    const { result: selectResult } = renderHook(() => useArmedTouchTool(select));
    selectResult.current!.start(touchEvent, stageRef);
    selectResult.current!.cancel();
    expect(select.handleMarqueePointerDown).toHaveBeenCalledWith(touchEvent);
    expect(select.handleMarqueeCancel).toHaveBeenCalledTimes(1);
  });

  it("re-arms when the mode changes — a pinned tool object is how M2 lost drawing", () => {
    const props = makeProps();
    const { result, rerender } = renderHook(
      (current: UseArmedTouchToolProps) => useArmedTouchTool(current),
      { initialProps: props },
    );

    rerender({ ...props, drawMode: true });
    const drawTool = result.current;
    rerender({ ...props, drawMode: false, mapEditTouchMode: true });

    expect(result.current).not.toBe(drawTool);
    result.current!.start(touchEvent, stageRef);
    expect(props.handleMapEditMouseDown).toHaveBeenCalledWith(stageRef, "touch");
    expect(props.handleDrawMouseDown).not.toHaveBeenCalled();
  });
});
