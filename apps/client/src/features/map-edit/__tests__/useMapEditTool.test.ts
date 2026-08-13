import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { MapDocument, MapGridSettings } from "@herobyte/shared";
import { useMapEditTool, effectiveGrid } from "../useMapEditTool";
import type { MapStudioController } from "../../map-studio/types";

describe("effectiveGrid", () => {
  const hexGrid: MapGridSettings = {
    type: "hex-row",
    size: 50,
    squareSize: 5,
    offsetX: 0,
    offsetY: 0,
    visible: true,
    snap: false,
  };

  it("forces a square, snapping grid for the room and hallway tools", () => {
    // These tools quantize floor onto the square terrain lattice; a hex-typed
    // document (from import/update-grid) must not snap the drag to hex centers.
    for (const subTool of ["room", "hallway"] as const) {
      expect(effectiveGrid(hexGrid, subTool)).toMatchObject({ type: "square", snap: true });
    }
  });

  it("leaves the document's grid type and snap untouched for other tools", () => {
    for (const subTool of ["wall", "door", "place", "terrain"] as const) {
      expect(effectiveGrid(hexGrid, subTool)).toBe(hexGrid);
    }
  });
});

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

// makeDocument plus an unlocked "objects" layer so the place/scatter tools have
// a matching-kind placement target.
function makeObjectsDocument(): MapDocument {
  const base = makeDocument();
  return {
    ...base,
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
      ...base.layers,
    ],
  };
}

function makeController(overrides: Partial<MapStudioController> = {}): MapStudioController {
  return {
    activeDocument: makeDocument(),
    saving: false,
    addWall: vi.fn(() => "wall-1"),
    addDoor: vi.fn(() => "door-1"),
    addTile: vi.fn(() => "tile-1"),
    addStamp: vi.fn(() => "stamp-1"),
    addStamps: vi.fn(() => ["stamp-1"]),
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

  // The skip is right — one command in flight at a time is the Studio's rule.
  // Doing it in total silence was not: clearDrag() removes the rubber band
  // either way and a skip never sets controller.error, so on a phone at real
  // latency the DM draws a wall and simply does not get one.
  it("skips the commit while the controller is saving, and SAYS it dropped the gesture", () => {
    const onGestureDropped = vi.fn();
    const controller = makeController({ saving: true });
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "wall",
        controller,
        liveDocumentId: "live",
        floorFamily: "grass",
        onGestureDropped,
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    act(() => result.current.onMouseDown(makeStage({ x: 100, y: 100 }).ref));
    act(() => result.current.onMouseMove(makeStage({ x: 200, y: 100 }).ref));
    act(() => result.current.onMouseUp());

    expect(controller.addWall).not.toHaveBeenCalled();
    expect(onGestureDropped).toHaveBeenCalledTimes(1);
  });

  it("stays quiet when the commit actually lands", () => {
    // Without this half, a notice wired to fire unconditionally passes the
    // test above and cries wolf on every successful wall in the app.
    const onGestureDropped = vi.fn();
    const controller = makeController();
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "wall",
        controller,
        liveDocumentId: "live",
        floorFamily: "grass",
        onGestureDropped,
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    act(() => result.current.onMouseDown(makeStage({ x: 100, y: 100 }).ref));
    act(() => result.current.onMouseMove(makeStage({ x: 200, y: 100 }).ref));
    act(() => result.current.onMouseUp());

    expect(controller.addWall).toHaveBeenCalledTimes(1);
    expect(onGestureDropped).not.toHaveBeenCalled();
  });

  it("stays SILENT when the document changed out from under the drag", () => {
    // A deliberate asymmetry, and the live-binding re-check is the only way to
    // reach it: onMouseDown already refuses to START on a non-live document,
    // so the release-time guard exists for the doc changing MID-drag. That
    // guard refusing a stray Map Studio document is the feature working, not
    // the DM's gesture going missing, so it must not toast.
    //
    // Both controllers are saving:true on purpose. If the release checked
    // `saving` before the document match, this would fire and the assertion
    // below would catch it.
    const onGestureDropped = vi.fn();
    const live = makeController({ saving: true });
    const stray = makeController({
      activeDocument: { ...makeDocument(), id: "studio-doc" },
      saving: true,
    });
    const { result, rerender } = renderHook(
      ({ controller }) =>
        useMapEditTool({
          mapEditMode: true,
          activeSubTool: "wall",
          controller,
          liveDocumentId: "live",
          floorFamily: "grass",
          onGestureDropped,
          toWorld: identityToWorld,
          mapTransform: undefined,
        }),
      { initialProps: { controller: live } },
    );

    act(() => result.current.onMouseDown(makeStage({ x: 100, y: 100 }).ref));
    act(() => result.current.onMouseMove(makeStage({ x: 200, y: 100 }).ref));
    rerender({ controller: stray });
    act(() => result.current.onMouseUp());

    expect(live.addWall).not.toHaveBeenCalled();
    expect(stray.addWall).not.toHaveBeenCalled();
    expect(onGestureDropped).not.toHaveBeenCalled();
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

  it("paints the wall ring around the room when roomWallFamily is armed", () => {
    // Pins the ring WIRING (roomWallFamily → commitDragTool → buildRoomCommand),
    // not just the pure builder: floor + ring must land in ONE placeRoom call
    // (one undo step), with the ring material from the armed family.
    const controller = makeController();
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "room",
        controller,
        liveDocumentId: "live",
        floorFamily: "wood-floor",
        roomWallFamily: "wall-brick",
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    // Same 3×2-cell drag as the ringless room test above.
    act(() => result.current.onMouseDown(makeStage({ x: 100, y: 100 }).ref));
    act(() => result.current.onMouseMove(makeStage({ x: 200, y: 150 }).ref));
    act(() => result.current.onMouseUp());

    expect(controller.placeRoom).toHaveBeenCalledTimes(1);
    const [cells] = (controller.placeRoom as ReturnType<typeof vi.fn>).mock.calls[0];
    const floors = cells.filter((c: { assetId: string }) => c.assetId === "terrain:wood-floor");
    const ring = cells.filter((c: { assetId: string }) => c.assetId === "terrain:wall-brick");
    expect(floors).toHaveLength(6); // 3×2 interior
    expect(ring).toHaveLength(14); // surrounding 5×4 band
    expect(cells).toHaveLength(20);
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

  it("places a hallway (floor band + two long walls) and reports its bounds", () => {
    const controller = makeController();
    const onRegionPlaced = vi.fn();
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "hallway",
        controller,
        liveDocumentId: "live",
        floorFamily: "path",
        hallwayWidth: 2,
        onRegionPlaced,
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    // Horizontal drag (100,100)→(300,100): 5 cells long × 2 wide.
    act(() => result.current.onMouseDown(makeStage({ x: 100, y: 100 }).ref));
    act(() => result.current.onMouseMove(makeStage({ x: 300, y: 100 }).ref));
    act(() => result.current.onMouseUp());

    expect(controller.placeRoom).toHaveBeenCalledTimes(1);
    const [cells, elements] = (controller.placeRoom as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(cells).toHaveLength(10);
    expect(elements).toHaveLength(2); // two long-side walls, open ends
    expect(onRegionPlaced).toHaveBeenCalledWith({ x: 100, y: 100, width: 250, height: 100 });
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

  it("places a grid-snapped tile on a click with the place tool", () => {
    const controller = makeController({ activeDocument: makeObjectsDocument() });
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "place",
        controller,
        liveDocumentId: "live",
        floorFamily: "grass",
        selectedAssetId: "objects:crate",
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    // Click near (110,90) snaps to the 50-grid cell origin (100,100).
    act(() => result.current.onMouseDown(makeStage({ x: 110, y: 90 }).ref));

    expect(controller.addTile).toHaveBeenCalledTimes(1);
    expect(controller.addTile).toHaveBeenCalledWith({
      layerId: "objects",
      assetId: "objects:crate",
      x: 100,
      y: 100,
      columns: 1,
      rows: 1,
    });
    expect(controller.addStamp).not.toHaveBeenCalled();
  });

  it("Alt+click free-places a rotated stamp (R steps 15°)", () => {
    const controller = makeController({ activeDocument: makeObjectsDocument() });
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "place",
        controller,
        liveDocumentId: "live",
        floorFamily: "grass",
        selectedAssetId: "objects:crate",
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" })));
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Alt" })));
    act(() => result.current.onMouseDown(makeStage({ x: 200, y: 200 }).ref));
    act(() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "Alt" })));

    expect(controller.addTile).not.toHaveBeenCalled();
    expect(controller.addStamp).toHaveBeenCalledWith({
      layerId: "objects",
      assetId: "objects:crate",
      x: 175, // 200 - 50/2
      y: 175,
      width: 50,
      height: 50,
      rotation: 15,
    });
  });

  it("scatters a seeded cluster as ONE add-elements command", () => {
    const controller = makeController({ activeDocument: makeObjectsDocument() });
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "scatter",
        controller,
        liveDocumentId: "live",
        floorFamily: "grass",
        selectedAssetId: "objects:crate",
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    act(() => result.current.onMouseDown(makeStage({ x: 300, y: 300 }).ref));

    expect(controller.addStamps).toHaveBeenCalledTimes(1);
    const drafts = (controller.addStamps as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(drafts.length).toBeGreaterThan(0);
    expect(controller.addTile).not.toHaveBeenCalled();
  });

  // The click tools drop through a SECOND gate (useMapEditPlacement's own
  // `saving` check), not the drag one — so covering the drag path leaves these
  // two silent. Worse than a drag: the ghost is still sitting under the cursor
  // afterwards, so the tool looks armed and willing.
  it.each(["place", "scatter"] as const)(
    "skips a %s while the controller is saving, and SAYS it dropped the gesture",
    (subTool) => {
      const onGestureDropped = vi.fn();
      const controller = makeController({ activeDocument: makeObjectsDocument(), saving: true });
      const { result } = renderHook(() =>
        useMapEditTool({
          mapEditMode: true,
          activeSubTool: subTool,
          controller,
          liveDocumentId: "live",
          floorFamily: "grass",
          selectedAssetId: "objects:crate",
          onGestureDropped,
          toWorld: identityToWorld,
          mapTransform: undefined,
        }),
      );

      act(() => result.current.onMouseDown(makeStage({ x: 100, y: 100 }).ref));

      expect(controller.addTile).not.toHaveBeenCalled();
      expect(controller.addStamps).not.toHaveBeenCalled();
      expect(onGestureDropped).toHaveBeenCalledTimes(1);
    },
  );

  it("stays quiet when a placement actually lands", () => {
    const onGestureDropped = vi.fn();
    const controller = makeController({ activeDocument: makeObjectsDocument() });
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "place",
        controller,
        liveDocumentId: "live",
        floorFamily: "grass",
        selectedAssetId: "objects:crate",
        onGestureDropped,
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    act(() => result.current.onMouseDown(makeStage({ x: 100, y: 100 }).ref));

    expect(controller.addTile).toHaveBeenCalledTimes(1);
    expect(onGestureDropped).not.toHaveBeenCalled();
  });

  it("stays SILENT when the click tool is pointed at a non-live document", () => {
    // Same asymmetry as the drag path: the ghost is already hidden there, so
    // nothing was promised and nothing was taken away.
    const onGestureDropped = vi.fn();
    const controller = makeController({ activeDocument: makeObjectsDocument(), saving: true });
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "place",
        controller,
        liveDocumentId: "some-other-doc",
        floorFamily: "grass",
        selectedAssetId: "objects:crate",
        onGestureDropped,
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    act(() => result.current.onMouseDown(makeStage({ x: 100, y: 100 }).ref));

    expect(controller.addTile).not.toHaveBeenCalled();
    expect(onGestureDropped).not.toHaveBeenCalled();
  });

  it("does not place into a non-live active document", () => {
    const controller = makeController({ activeDocument: makeObjectsDocument() });
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "place",
        controller,
        liveDocumentId: "some-other-doc",
        floorFamily: "grass",
        selectedAssetId: "objects:crate",
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    act(() => result.current.onMouseDown(makeStage({ x: 100, y: 100 }).ref));

    expect(controller.addTile).not.toHaveBeenCalled();
    expect(result.current.placementGhost).toBeNull();
  });

  it("select-tool click reports the element under the cursor and places nothing", () => {
    const base = makeObjectsDocument();
    const controller = makeController({
      activeDocument: {
        ...base,
        elements: [
          {
            id: "tile1",
            layerId: "objects",
            type: "tile",
            locked: false,
            hidden: false,
            transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0 },
            data: { assetId: "objects:crate", columns: 1, rows: 1 },
          },
        ],
      },
    });
    const onSelectElement = vi.fn();
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "select",
        controller,
        liveDocumentId: "live",
        floorFamily: "grass",
        onSelectElement,
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    act(() => result.current.onMouseDown(makeStage({ x: 120, y: 120 }).ref));

    expect(onSelectElement).toHaveBeenCalledWith("tile1");
    expect(controller.addTile).not.toHaveBeenCalled();
  });

  it("Ctrl+click with the place tool eyedrops instead of placing", () => {
    const base = makeObjectsDocument();
    const controller = makeController({
      activeDocument: {
        ...base,
        elements: [
          {
            id: "tile1",
            layerId: "objects",
            type: "tile",
            locked: false,
            hidden: false,
            transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0 },
            data: { assetId: "objects:table", columns: 2, rows: 1 },
          },
        ],
      },
    });
    const onSampleAsset = vi.fn();
    const { result } = renderHook(() =>
      useMapEditTool({
        mapEditMode: true,
        activeSubTool: "place",
        controller,
        liveDocumentId: "live",
        floorFamily: "grass",
        selectedAssetId: "objects:crate",
        onSampleAsset,
        toWorld: identityToWorld,
        mapTransform: undefined,
      }),
    );

    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" })));
    act(() => result.current.onMouseDown(makeStage({ x: 120, y: 120 }).ref));
    act(() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "Control" })));

    expect(onSampleAsset).toHaveBeenCalledWith("objects:table");
    expect(controller.addTile).not.toHaveBeenCalled();
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
    // The move is what makes this test able to fail at all. Without it the
    // drag is zero-length, wallDraftFromDrag returns null, and addWall is
    // uncalled whether Escape cancelled anything or not — measured: deleting
    // the Escape handler outright left this test GREEN.
    act(() => result.current.onMouseMove(makeStage({ x: 200, y: 100 }).ref));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    act(() => result.current.onMouseUp());

    expect(controller.addWall).not.toHaveBeenCalled();
    expect(result.current.previewDrag).toBeNull();
  });
});

// A finger has no Escape key, and on touch RELEASING is what commits — so the
// abort has to arrive from outside the canvas while the gesture is still live.
describe("useMapEditTool — cancelling from outside the canvas", () => {
  beforeEach(() => vi.clearAllMocks());

  function renderWithSignal(subTool: "wall" | "terrain", controller: MapStudioController) {
    return renderHook(
      ({ cancelSignal }: { cancelSignal: number }) =>
        useMapEditTool({
          mapEditMode: true,
          activeSubTool: subTool,
          controller,
          liveDocumentId: "live",
          floorFamily: "grass",
          cancelSignal,
          toWorld: identityToWorld,
          mapTransform: undefined,
        }),
      { initialProps: { cancelSignal: 0 } },
    );
  }

  it("a bumped signal mid-drag makes the RELEASE commit nothing", () => {
    const controller = makeController();
    const { result, rerender } = renderWithSignal("wall", controller);

    act(() => result.current.onMouseDown(makeStage({ x: 100, y: 100 }).ref));
    act(() => result.current.onMouseMove(makeStage({ x: 200, y: 100 }).ref));

    // The finger is still down. This is the whole point: the dock button is a
    // SECOND touch, so the first finger's lift still arrives afterwards.
    act(() => rerender({ cancelSignal: 1 }));
    act(() => result.current.onMouseUp());

    expect(controller.addWall).not.toHaveBeenCalled();
    expect(result.current.previewDrag).toBeNull();
  });

  it("a cancel is not sticky — the NEXT drag still commits", () => {
    const controller = makeController();
    const { result, rerender } = renderWithSignal("wall", controller);

    act(() => result.current.onMouseDown(makeStage({ x: 100, y: 100 }).ref));
    act(() => result.current.onMouseMove(makeStage({ x: 200, y: 100 }).ref));
    act(() => rerender({ cancelSignal: 1 }));
    act(() => result.current.onMouseUp());
    expect(controller.addWall).not.toHaveBeenCalled();

    act(() => result.current.onMouseDown(makeStage({ x: 300, y: 300 }).ref));
    act(() => result.current.onMouseMove(makeStage({ x: 400, y: 300 }).ref));
    act(() => result.current.onMouseUp());

    expect(controller.addWall).toHaveBeenCalledTimes(1);
    expect(controller.addWall).toHaveBeenCalledWith(
      expect.objectContaining({ x1: 300, y1: 300, x2: 400, y2: 300 }),
    );
  });

  it("onCancel THROWS AWAY an accumulating terrain stroke rather than painting it", () => {
    const controller = makeController();
    const { result } = renderWithSignal("terrain", controller);

    act(() => result.current.onMouseDown(makeStage({ x: 20, y: 20 }).ref));
    act(() => result.current.onMouseMove(makeStage({ x: 70, y: 20 }).ref));
    expect(result.current.strokeCells.length).toBeGreaterThan(0);

    act(() => result.current.onCancel());
    expect(result.current.strokeCells).toEqual([]);

    // The release must not paint, AND the abandoned cells must not ride along
    // on the next stroke's flush.
    act(() => result.current.onMouseUp());
    expect(controller.paintTerrain).not.toHaveBeenCalled();

    act(() => result.current.onMouseDown(makeStage({ x: 320, y: 320 }).ref));
    act(() => result.current.onMouseUp());
    expect(controller.paintTerrain).toHaveBeenCalledTimes(1);
    expect(controller.paintTerrain).toHaveBeenCalledWith([
      { x: 6, y: 6, assetId: "terrain:grass" },
    ]);
  });

  it("the signal cancels a terrain stroke too, not just a drag", () => {
    const controller = makeController();
    const { result, rerender } = renderWithSignal("terrain", controller);

    act(() => result.current.onMouseDown(makeStage({ x: 20, y: 20 }).ref));
    act(() => rerender({ cancelSignal: 1 }));
    act(() => result.current.onMouseUp());

    expect(controller.paintTerrain).not.toHaveBeenCalled();
  });
});
