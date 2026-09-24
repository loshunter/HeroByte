import { act, renderHook } from "@testing-library/react";
import type { MapDocument } from "@herobyte/shared";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { describe, expect, it, vi } from "vitest";
import { useMapEditTool } from "../../features/map-edit/useMapEditTool";
import type { MapStudioController } from "../../features/map-studio/types";
import { useCamera } from "../useCamera";
import { useStageEventRouter } from "../useStageEventRouter";
import type { UseStageEventRouterProps } from "../useStageEventRouter.types";

const document: MapDocument = {
  schemaVersion: 1,
  id: "live",
  name: "Secondary mouse regression",
  width: 8192,
  height: 8192,
  grid: {
    type: "square",
    size: 50,
    squareSize: 5,
    offsetX: 0,
    offsetY: 0,
    visible: true,
    snap: true,
  },
  layers: [
    {
      id: "objects",
      name: "Objects",
      kind: "objects",
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: 20,
    },
  ],
  elements: [],
  revision: 1,
  createdAt: 1,
  updatedAt: 1,
};

function mouse(button: number, buttons: number): KonvaEventObject<PointerEvent> {
  return {
    evt: new MouseEvent("mouseup", { button, buttons }),
  } as unknown as KonvaEventObject<PointerEvent>;
}

function harness(subTool: "place" | "terrain" | "erase") {
  let point = { x: 100, y: 100 };
  const stageRef = {
    current: { getPointerPosition: () => point } as unknown as Konva.Stage,
  };
  const controller = {
    activeDocument: document,
    saving: false,
    addTile: vi.fn(() => "tile-1"),
    paintTerrain: vi.fn(),
  } as unknown as MapStudioController;
  const drawDown = vi.fn();
  const drawUp = vi.fn();
  const marqueeDown = vi.fn();
  const marqueeUp = vi.fn();
  const hook = renderHook(() => {
    const camera = useCamera();
    const tool = useMapEditTool({
      mapEditMode: true,
      activeSubTool: subTool,
      controller,
      liveDocumentId: "live",
      floorFamily: "grass",
      toWorld: camera.toWorld,
      mapTransform: undefined,
    });
    const props: UseStageEventRouterProps = {
      alignmentMode: false,
      selectMode: false,
      pointerMode: false,
      measureMode: false,
      drawMode: false,
      mapEditMode: true,
      mapEditTouchMode: subTool !== "place",
      linkAimMode: false,
      handleAlignmentClick: vi.fn(),
      handleLinkAimClick: vi.fn(),
      handlePointerClick: vi.fn(),
      handleCameraMouseDown: camera.onMouseDown,
      handleDrawMouseDown: drawDown,
      handleMapEditMouseDown: tool.onMouseDown,
      handleMarqueePointerDown: marqueeDown,
      handleCameraMouseMove: camera.onMouseMove,
      handlePointerMouseMove: vi.fn(),
      handleDrawMouseMove: vi.fn(),
      handleMapEditMouseMove: tool.onMouseMove,
      handleMarqueePointerMove: vi.fn(),
      handleCameraMouseUp: camera.onMouseUp,
      handleDrawMouseUp: drawUp,
      handleMapEditMouseUp: tool.onMouseUp,
      handleMarqueePointerUp: marqueeUp,
      handleDrawCancel: vi.fn(),
      handleMarqueeCancel: vi.fn(),
      handleMapEditCancel: tool.onCancel,
      handleTouchStart: camera.onTouchStart,
      handleTouchMove: camera.onTouchMove,
      handleTouchEnd: camera.onTouchEnd,
      isMarqueeActive: true,
      deselectIfEmpty: vi.fn(),
      stageRef,
    };
    return { router: useStageEventRouter(props), camera, tool };
  });
  return {
    ...hook,
    controller,
    drawDown,
    drawUp,
    marqueeDown,
    marqueeUp,
    down: (button: number, buttons = [1, 4, 2][button]!) =>
      act(() => hook.result.current.router.onMouseDown(mouse(button, buttons))),
    up: (button: number, buttons = 0) =>
      act(() => {
        // Pass the real release event even against the pre-repair no-arg signature.
        const release = hook.result.current.router.onMouseUp as (
          event: KonvaEventObject<PointerEvent>,
        ) => void;
        release(mouse(button, buttons));
      }),
    move: (x: number, y: number) =>
      act(() => {
        point = { x, y };
        hook.result.current.router.onMouseMove();
      }),
  };
}

describe("stage router primary-only mouse authoring", () => {
  for (const subTool of ["place", "terrain", "erase"] as const) {
    it.each([1, 2])(`button %i cannot author ${subTool}`, (button) => {
      const h = harness(subTool);
      h.down(button);
      h.move(150, 100);
      h.up(button);
      expect(h.controller.addTile).not.toHaveBeenCalled();
      expect(h.controller.paintTerrain).not.toHaveBeenCalled();
      expect(h.drawDown).not.toHaveBeenCalled();
      expect(h.drawUp).not.toHaveBeenCalled();
      expect(h.marqueeDown).not.toHaveBeenCalled();
      expect(h.marqueeUp).not.toHaveBeenCalled();
    });
  }

  it("primary Place still commits exactly once on press", () => {
    const h = harness("place");
    h.down(0);
    expect(h.controller.addTile).toHaveBeenCalledTimes(1);
    h.move(150, 100);
    h.up(0);
    expect(h.controller.addTile).toHaveBeenCalledTimes(1);
    expect(h.controller.paintTerrain).not.toHaveBeenCalled();
  });

  it.each([1, 2])("button %i release cannot complete a held primary stroke", (button) => {
    const h = harness("terrain");
    h.down(0);
    h.move(150, 100);
    h.up(button, 1);
    expect(h.controller.paintTerrain).not.toHaveBeenCalled();
    expect(h.drawUp).not.toHaveBeenCalled();
    expect(h.marqueeUp).not.toHaveBeenCalled();
    h.move(200, 100);
    h.up(0);
    expect(h.controller.paintTerrain).toHaveBeenCalledExactlyOnceWith([
      { x: 2, y: 2, assetId: "terrain:grass" },
      { x: 3, y: 2, assetId: "terrain:grass" },
      { x: 4, y: 2, assetId: "terrain:grass" },
    ]);
    expect(h.drawUp).toHaveBeenCalledTimes(1);
    expect(h.marqueeUp).toHaveBeenCalledTimes(1);
  });

  it("middle drag still pans the real camera with a map tool armed", () => {
    const h = harness("place");
    h.down(1);
    expect(h.result.current.camera.isPanning).toBe(true);
    h.move(150, 125);
    expect(h.result.current.camera.cam).toEqual({ x: 50, y: 25, scale: 1 });
    h.up(1);
    expect(h.result.current.camera.isPanning).toBe(false);
    expect(h.controller.addTile).not.toHaveBeenCalled();
  });

  it("the independent touch brush path still commits normally", () => {
    const h = harness("terrain");
    const event = {
      evt: { touches: { length: 1 }, cancelable: true, preventDefault: vi.fn() },
    } as unknown as KonvaEventObject<TouchEvent>;
    act(() => h.result.current.router.onTouchStart(event));
    expect(h.controller.paintTerrain).not.toHaveBeenCalled();
    act(() => h.result.current.router.onTouchEnd());
    expect(h.controller.paintTerrain).toHaveBeenCalledExactlyOnceWith([
      { x: 2, y: 2, assetId: "terrain:grass" },
    ]);
  });
});
