// Under an armed atlas-link aim the two input paths part ways on purpose: a
// finger may pan (the lift is guarded by useAimTouchGuard, so it cannot place),
// while a mouse must not (a mouse drag ends in a click Konva hands straight to
// the aim). The mobile lens's L3 — the aim used to freeze the phone camera.

import { renderHook } from "@testing-library/react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { describe, expect, it, vi } from "vitest";
import { useStageEventRouter } from "../useStageEventRouter";
import type { UseStageEventRouterProps } from "../useStageEventRouter.types";

const stageRef = { current: null } as React.RefObject<Konva.Stage | null>;

function props(overrides: Partial<UseStageEventRouterProps> = {}): UseStageEventRouterProps {
  return {
    alignmentMode: false,
    selectMode: false,
    pointerMode: false,
    measureMode: false,
    drawMode: false,
    mapEditMode: false,
    mapEditTouchMode: false,
    linkAimMode: false,
    handleAlignmentClick: vi.fn(),
    handleLinkAimClick: vi.fn(),
    handlePointerClick: vi.fn(),
    handleCameraMouseDown: vi.fn(),
    handleDrawMouseDown: vi.fn(),
    handleMapEditMouseDown: vi.fn(),
    handleMarqueePointerDown: vi.fn(),
    handleCameraMouseMove: vi.fn(),
    handlePointerMouseMove: vi.fn(),
    handleDrawMouseMove: vi.fn(),
    handleMapEditMouseMove: vi.fn(),
    handleMarqueePointerMove: vi.fn(),
    handleCameraMouseUp: vi.fn(),
    handleDrawMouseUp: vi.fn(),
    handleMapEditMouseUp: vi.fn(),
    handleMarqueePointerUp: vi.fn(),
    handleDrawCancel: vi.fn(),
    handleMarqueeCancel: vi.fn(),
    handleMapEditCancel: vi.fn(),
    handleTouchStart: vi.fn(),
    handleTouchMove: vi.fn(),
    handleTouchEnd: vi.fn(),
    isMarqueeActive: false,
    deselectIfEmpty: vi.fn(),
    stageRef,
    ...overrides,
  };
}

function mouseEvent(): KonvaEventObject<PointerEvent> {
  return { evt: { buttons: 1 } } as unknown as KonvaEventObject<PointerEvent>;
}

function oneFinger(): KonvaEventObject<TouchEvent> {
  return {
    evt: { touches: { length: 1 }, cancelable: true, preventDefault: vi.fn() },
  } as unknown as KonvaEventObject<TouchEvent>;
}

describe("useStageEventRouter — panning under the atlas-link aim", () => {
  it("a mouse never pans while the aim is armed (its drag would end in a placing click)", () => {
    const p = props({ linkAimMode: true });
    const { result } = renderHook(() => useStageEventRouter(p));
    result.current.onMouseDown(mouseEvent());
    expect(p.handleCameraMouseDown).toHaveBeenCalledWith(expect.anything(), stageRef, false);
  });

  it("one finger pans while the aim is armed — the lift is the guard's problem, not the camera's", () => {
    const p = props({ linkAimMode: true });
    const { result } = renderHook(() => useStageEventRouter(p));
    result.current.onTouchStart(oneFinger());
    expect(p.handleTouchStart).toHaveBeenCalledWith(expect.anything(), stageRef, true);
  });

  it("a drawing tool still owns the finger — the aim is the only click tool that lets go", () => {
    const p = props({ drawMode: true });
    const { result } = renderHook(() => useStageEventRouter(p));
    result.current.onTouchStart(oneFinger());
    expect(p.handleTouchStart).toHaveBeenCalledWith(expect.anything(), stageRef, false);
  });

  it("with nothing armed both paths pan, as before", () => {
    const p = props();
    const { result } = renderHook(() => useStageEventRouter(p));
    result.current.onMouseDown(mouseEvent());
    result.current.onTouchStart(oneFinger());
    expect(p.handleCameraMouseDown).toHaveBeenCalledWith(expect.anything(), stageRef, true);
    expect(p.handleTouchStart).toHaveBeenCalledWith(expect.anything(), stageRef, true);
  });
});
