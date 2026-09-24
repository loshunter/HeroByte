import { act, renderHook } from "@testing-library/react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { vi } from "vitest";
import { useMarqueeSelection } from "../useMarqueeSelection";
import { useStageEventRouter } from "../useStageEventRouter";
import { useToolMode } from "../useToolMode";

export type MarqueeInput = "mouse" | "touch";

export function marqueeHarness() {
  let point = { x: 0, y: 0 };
  const stage = { getPointerPosition: () => point } as unknown as Konva.Stage;
  const stageRef = { current: stage };
  const node = {
    getClientRect: () => ({ x: 10, y: 10, width: 10, height: 10 }),
  } as unknown as Konva.Node;
  const onSelectObject = vi.fn();
  const onSelectObjects = vi.fn();
  const cameraStart = vi.fn();
  const cameraMove = vi.fn();
  const cameraEnd = vi.fn();
  const noop = () => undefined;
  const hook = renderHook(() => {
    const mode = useToolMode();
    const marquee = useMarqueeSelection({
      stageRef,
      selectMode: mode.selectMode,
      pointerMode: mode.pointerMode,
      measureMode: mode.measureMode,
      drawMode: mode.drawMode,
      getAllNodes: () => new Map([["token:inside", node]]),
      onSelectObject,
      onSelectObjects,
    });
    const router = useStageEventRouter({
      ...mode,
      mapEditTouchMode: false,
      linkAimMode: false,
      handleAlignmentClick: noop,
      handleLinkAimClick: noop,
      handlePointerClick: noop,
      handleCameraMouseDown: noop,
      handleDrawMouseDown: noop,
      handleMapEditMouseDown: noop,
      handleMarqueePointerDown: marquee.handlePointerDown,
      handleCameraMouseMove: noop,
      handlePointerMouseMove: noop,
      handleDrawMouseMove: noop,
      handleMapEditMouseMove: noop,
      handleMarqueePointerMove: marquee.handlePointerMove,
      handleCameraMouseUp: noop,
      handleDrawMouseUp: noop,
      handleMapEditMouseUp: noop,
      handleMarqueePointerUp: marquee.handlePointerUp,
      handleDrawCancel: noop,
      handleMarqueeCancel: marquee.cancelMarquee,
      handleMapEditCancel: noop,
      handleTouchStart: cameraStart,
      handleTouchMove: cameraMove,
      handleTouchEnd: cameraEnd,
      isMarqueeActive: marquee.isActive,
      onSelectObject,
      deselectIfEmpty: noop,
      stageRef,
    });
    return { mode, marquee, router };
  });
  act(() => hook.result.current.mode.setActiveTool("select"));
  const mouse = () =>
    ({ target: stage, evt: { button: 0 } }) as unknown as KonvaEventObject<PointerEvent>;
  const touch = (fingers = 1) =>
    ({
      target: stage,
      evt: { touches: { length: fingers }, cancelable: true, preventDefault: vi.fn() },
    }) as unknown as KonvaEventObject<TouchEvent>;
  return {
    ...hook,
    onSelectObject,
    onSelectObjects,
    cameraStart,
    cameraMove,
    cameraEnd,
    touch,
    start(input: MarqueeInput) {
      point = { x: 0, y: 0 };
      if (input === "mouse") hook.result.current.router.onMouseDown(mouse());
      else hook.result.current.router.onTouchStart(touch());
    },
    move(input: MarqueeInput, coordinate = 30) {
      point = { x: coordinate, y: coordinate };
      if (input === "mouse") hook.result.current.router.onMouseMove();
      else hook.result.current.router.onTouchMove(touch());
    },
    release(input: MarqueeInput) {
      if (input === "mouse") hook.result.current.router.onMouseUp();
      else hook.result.current.router.onTouchEnd();
    },
  };
}
