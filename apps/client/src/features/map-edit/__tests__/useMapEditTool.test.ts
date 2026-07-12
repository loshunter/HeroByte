import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { MapDocument } from "@herobyte/shared";
import { useMapEditTool } from "../useMapEditTool";
import type { MapStudioController } from "../../map-studio/types";

// A document with a walls-kind layer and an 8192px canvas at grid size 50.
function makeDocument(): MapDocument {
  return {
    schemaVersion: 1,
    id: "live",
    name: "Live Map",
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
        id: "walls",
        name: "Walls",
        kind: "walls",
        visible: true,
        locked: false,
        opacity: 1,
        zIndex: 30,
      },
    ],
    elements: [],
    revision: 1,
    createdAt: 1,
    updatedAt: 1,
  };
}

function makeController(overrides: Partial<MapStudioController> = {}): MapStudioController {
  return {
    activeDocument: makeDocument(),
    saving: false,
    addWall: vi.fn(() => "wall-1"),
    addDoor: vi.fn(() => "door-1"),
    ...overrides,
  } as unknown as MapStudioController;
}

// stageRef whose pointer position we drive per event.
function makeStage(pointer: { x: number; y: number }) {
  const stage = { getPointerPosition: vi.fn(() => pointer) };
  return { ref: { current: stage as unknown as import("konva").default.Stage }, stage };
}

const identityToWorld = (sx: number, sy: number) => ({ x: sx, y: sy });

describe("useMapEditTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("places a grid-snapped wall on a two-point drag (identity transform)", () => {
    const controller = makeController();
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "wall",
        controller,
        liveDocumentId: "live",
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    // Drag from a point near (110,90) to (190,110): both snap to the 50-grid.
    const down = makeStage({ x: 110, y: 90 });
    act(() => result.current.onMouseDown(down.ref));
    const move = makeStage({ x: 190, y: 110 });
    act(() => result.current.onMouseMove(move.ref));
    act(() => result.current.onMouseUp());

    expect(controller.addWall).toHaveBeenCalledTimes(1);
    expect(controller.addWall).toHaveBeenCalledWith({
      layerId: "walls",
      x1: 100,
      y1: 100,
      x2: 200,
      y2: 100,
      blocksMovement: true,
      blocksVision: true,
    });
  });

  it("applies the inverse map transform before snapping (non-identity)", () => {
    const controller = makeController();
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "wall",
        controller,
        liveDocumentId: "live",
        toWorld: identityToWorld,
        // World is offset +10/+20 from document space, so world (110,120)→doc (100,100).
        mapTransform: { x: 10, y: 20, scaleX: 1, scaleY: 1, rotation: 0 },
      }),
    );

    act(() => result.current.onMouseDown(makeStage({ x: 110, y: 120 }).ref));
    act(() => result.current.onMouseMove(makeStage({ x: 210, y: 120 }).ref));
    act(() => result.current.onMouseUp());

    expect(controller.addWall).toHaveBeenCalledWith(
      expect.objectContaining({ x1: 100, y1: 100, x2: 200, y2: 100 }),
    );
  });

  it("does nothing while map-edit mode is inactive", () => {
    const controller = makeController();
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: false,
        activeSubTool: "wall",
        controller,
        liveDocumentId: "live",
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    act(() => result.current.onMouseDown(makeStage({ x: 100, y: 100 }).ref));
    act(() => result.current.onMouseMove(makeStage({ x: 200, y: 100 }).ref));
    act(() => result.current.onMouseUp());

    expect(controller.addWall).not.toHaveBeenCalled();
  });

  it("skips the commit while the controller is saving", () => {
    const controller = makeController({ saving: true });
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "wall",
        controller,
        liveDocumentId: "live",
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    act(() => result.current.onMouseDown(makeStage({ x: 100, y: 100 }).ref));
    act(() => result.current.onMouseMove(makeStage({ x: 200, y: 100 }).ref));
    act(() => result.current.onMouseUp());

    expect(controller.addWall).not.toHaveBeenCalled();
  });

  it("does not author into a non-live active document (e.g. a Studio doc)", () => {
    // activeDocument is "live", but the room's live binding points elsewhere —
    // a stray Studio doc must never receive a live-tool wall.
    const controller = makeController();
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "wall",
        controller,
        liveDocumentId: "some-other-doc",
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    act(() => result.current.onMouseDown(makeStage({ x: 100, y: 100 }).ref));
    act(() => result.current.onMouseMove(makeStage({ x: 200, y: 100 }).ref));
    act(() => result.current.onMouseUp());

    expect(controller.addWall).not.toHaveBeenCalled();
    expect(result.current.previewDrag).toBeNull();
  });

  it("does not start a drag without an active document", () => {
    const controller = makeController({ activeDocument: null });
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "wall",
        controller,
        liveDocumentId: "live",
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    act(() => result.current.onMouseDown(makeStage({ x: 100, y: 100 }).ref));
    act(() => result.current.onMouseUp());

    expect(controller.addWall).not.toHaveBeenCalled();
    expect(result.current.previewDrag).toBeNull();
  });

  it("cancels an in-progress drag on Escape without committing", () => {
    const controller = makeController();
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "wall",
        controller,
        liveDocumentId: "live",
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    act(() => result.current.onMouseDown(makeStage({ x: 100, y: 100 }).ref));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    act(() => result.current.onMouseUp());

    expect(controller.addWall).not.toHaveBeenCalled();
    expect(result.current.previewDrag).toBeNull();
  });
});
