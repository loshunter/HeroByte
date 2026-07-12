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
    placeRoom: vi.fn(),
    paintTerrain: vi.fn(),
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
        floorFamily: "grass",
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

  it("places a door with width + rotation from a diagonal drag", () => {
    const controller = makeController();
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "door",
        controller,
        liveDocumentId: "live",
        floorFamily: "grass",
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    // (100,100) snaps to (100,100); (140,130) snaps to (150,150) on the 50-grid.
    act(() => result.current.onMouseDown(makeStage({ x: 100, y: 100 }).ref));
    act(() => result.current.onMouseMove(makeStage({ x: 140, y: 130 }).ref));
    act(() => result.current.onMouseUp());

    expect(controller.addWall).not.toHaveBeenCalled();
    expect(controller.addDoor).toHaveBeenCalledTimes(1);
    const draft = (controller.addDoor as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(draft).toMatchObject({
      layerId: "walls",
      x: 100,
      y: 100,
      rotation: 45, // atan2(50,50) = 45°
      state: "closed", // authored closed on purpose
      blocksMovement: true,
      blocksVision: true,
    });
    expect(draft.width).toBeCloseTo(Math.hypot(50, 50), 5);
  });

  it("applies the inverse map transform before snapping (non-identity)", () => {
    const controller = makeController();
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "wall",
        controller,
        liveDocumentId: "live",
        floorFamily: "grass",
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
        floorFamily: "grass",
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
        floorFamily: "grass",
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    act(() => result.current.onMouseDown(makeStage({ x: 100, y: 100 }).ref));
    act(() => result.current.onMouseMove(makeStage({ x: 200, y: 100 }).ref));
    act(() => result.current.onMouseUp());

    expect(controller.addWall).not.toHaveBeenCalled();
  });

  it("places a room (floor cells + perimeter) via a rect drag", () => {
    const controller = makeController();
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "room",
        controller,
        liveDocumentId: "live",
        floorFamily: "wood-floor",
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    // Drag (100,100)→(200,150): bounds x100 y100 w150 h100 → 3×2 cells.
    act(() => result.current.onMouseDown(makeStage({ x: 100, y: 100 }).ref));
    act(() => result.current.onMouseMove(makeStage({ x: 200, y: 150 }).ref));
    act(() => result.current.onMouseUp());

    expect(controller.placeRoom).toHaveBeenCalledTimes(1);
    const [cells, elements] = (controller.placeRoom as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(cells).toHaveLength(6);
    expect(cells[0]).toEqual({ x: 2, y: 2, assetId: "terrain:wood-floor" });
    expect(elements[0].data.points).toEqual([
      { x: 100, y: 100 },
      { x: 250, y: 100 },
      { x: 250, y: 200 },
      { x: 100, y: 200 },
      { x: 100, y: 100 },
    ]);
    expect(controller.addWall).not.toHaveBeenCalled();
  });

  it("force-snaps a room even when the document grid snap is off", () => {
    // Rooms are cell-quantized; the perimeter must land on cell edges regardless
    // of the doc's snap setting, or floor spills outside the walls.
    const base = makeDocument();
    const controller = makeController({
      activeDocument: { ...base, grid: { ...base.grid, snap: false } },
    });
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "room",
        controller,
        liveDocumentId: "live",
        floorFamily: "grass",
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    // Non-cell-aligned pointers (110,90)→(190,130) snap to (100,100)→(200,150).
    act(() => result.current.onMouseDown(makeStage({ x: 110, y: 90 }).ref));
    act(() => result.current.onMouseMove(makeStage({ x: 190, y: 130 }).ref));
    act(() => result.current.onMouseUp());

    const [cells, elements] = (controller.placeRoom as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(cells[0]).toEqual({ x: 2, y: 2, assetId: "terrain:grass" });
    // Perimeter is on cell edges (multiples of 50), not the raw pointer bounds.
    expect(elements[0].data.points[0]).toEqual({ x: 100, y: 100 });
    expect(elements[0].data.points[2]).toEqual({ x: 250, y: 200 });
  });

  it("paints a terrain stroke as ONE deduped paint-terrain command", () => {
    const controller = makeController();
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "terrain",
        controller,
        liveDocumentId: "live",
        floorFamily: "dirt",
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    // Brush is a pointer stream: down + moves accumulate cells (deduped), up flushes.
    act(() => result.current.onMouseDown(makeStage({ x: 100, y: 100 }).ref)); // cell (2,2)
    act(() => result.current.onMouseMove(makeStage({ x: 110, y: 110 }).ref)); // still (2,2) — dedup
    act(() => result.current.onMouseMove(makeStage({ x: 160, y: 160 }).ref)); // cell (3,3)
    expect(controller.paintTerrain).not.toHaveBeenCalled(); // not until release
    act(() => result.current.onMouseUp());

    expect(controller.paintTerrain).toHaveBeenCalledTimes(1);
    expect(controller.paintTerrain).toHaveBeenCalledWith([
      { x: 2, y: 2, assetId: "terrain:dirt" },
      { x: 3, y: 3, assetId: "terrain:dirt" },
    ]);
  });

  it("erases with assetId null", () => {
    const controller = makeController();
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "erase",
        controller,
        liveDocumentId: "live",
        floorFamily: "grass",
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    act(() => result.current.onMouseDown(makeStage({ x: 100, y: 100 }).ref));
    act(() => result.current.onMouseUp());

    expect(controller.paintTerrain).toHaveBeenCalledWith([{ x: 2, y: 2, assetId: null }]);
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
        floorFamily: "grass",
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
        floorFamily: "grass",
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
        floorFamily: "grass",
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
