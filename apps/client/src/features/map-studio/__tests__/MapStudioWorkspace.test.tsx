import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMapDocument, paintTerrain as paintTerrainDocument } from "@herobyte/shared";
import type { MapStudioController } from "../types";
import { createRecordingContext, hasCallPair } from "../../render/__tests__/recordingContext";
import { MapStudioWorkspace } from "../components/MapStudioWorkspace";
import { AssetUploadError } from "../uploads/assetUpload";
import { rasterizeAndUploadMapBackground } from "../publishRaster";
import { createTileElement } from "../elementBuilders";

// rasterizeAndUploadMapBackground drives a real <canvas> + HTTP upload; stub it
// so the publish flow is exercised without a browser canvas or a live server.
vi.mock("../publishRaster", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../publishRaster")>()),
  rasterizeAndUploadMapBackground: vi.fn(),
}));

const PUBLISHED_URL = `http://localhost:8787/assets/${"a".repeat(64)}`;

function controller(overrides: Partial<MapStudioController> = {}): MapStudioController {
  return {
    documents: [],
    activeDocument: createMapDocument({ id: "map", name: "Keep", timestamp: 1 }),
    loading: false,
    saving: false,
    error: null,
    canUndo: false,
    canRedo: false,
    refresh: vi.fn(),
    createDocument: vi.fn(() => "new-map"),
    openDocument: vi.fn(),
    deleteDocument: vi.fn(),
    updateLayer: vi.fn(),
    moveLayer: vi.fn(),
    updateGrid: vi.fn(),
    addTile: vi.fn(() => "tile-id"),
    addTiles: vi.fn(() => ["tile-id"]),
    addStamp: vi.fn(() => "stamp-id"),
    addStamps: vi.fn(() => ["stamp-id"]),
    paintTerrain: vi.fn(),
    addShape: vi.fn(() => "shape-id"),
    addWall: vi.fn(() => "wall-id"),
    addDoor: vi.fn(() => "door-id"),
    updateDoor: vi.fn(),
    removeElement: vi.fn(),
    updateElement: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    publishDocument: vi.fn(() => true),
    uploadAsset: vi.fn(),
    importDocument: vi.fn(() => "imported-id"),
    handleServerMessage: vi.fn(),
    ...overrides,
  };
}

describe("MapStudioWorkspace", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("requests saved maps once when the document list is empty", () => {
    const refresh = vi.fn();
    const { rerender } = render(
      <MapStudioWorkspace
        controller={controller({ activeDocument: null, loading: false, refresh })}
        onExit={vi.fn()}
      />,
    );

    expect(refresh).toHaveBeenCalledTimes(1);

    rerender(
      <MapStudioWorkspace
        controller={controller({ activeDocument: null, loading: true, refresh })}
        onExit={vi.fn()}
      />,
    );
    rerender(
      <MapStudioWorkspace
        controller={controller({ activeDocument: null, loading: false, refresh })}
        onExit={vi.fn()}
      />,
    );

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("paints the terrain cell under the cursor as one stroke command", () => {
    const document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);

    const canvas = screen.getByRole("img", { name: "Keep studio canvas" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
      toJSON: () => ({}),
    });

    firePointer(canvas, "pointerdown", { pointerId: 1, clientX: 74, clientY: 126 });
    // Nothing commits mid-stroke.
    expect(mapStudio.paintTerrain).not.toHaveBeenCalled();
    firePointer(canvas, "pointerup", { pointerId: 1, clientX: 74, clientY: 126 });

    // floor(74/50)=1, floor(126/50)=2: the cell containing the cursor.
    expect(mapStudio.paintTerrain).toHaveBeenCalledWith([
      { x: 1, y: 2, assetId: "terrain:stone-floor" },
    ]);
    expect(mapStudio.addTile).not.toHaveBeenCalled();
  });

  it("places hex-snapped tile elements instead of terrain on hex grids", () => {
    const document = createMapDocument({ id: "map", name: "Keep", width: 400, height: 400 });
    document.grid.type = "hex-row";
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);

    const canvas = screen.getByRole("img", { name: "Keep studio canvas" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: 400,
      width: 400,
      height: 400,
      toJSON: () => ({}),
    });

    firePointer(canvas, "pointerdown", { pointerId: 1, clientX: 55, clientY: 40 });
    firePointer(canvas, "pointerup", { pointerId: 1, clientX: 55, clientY: 40 });

    expect(mapStudio.paintTerrain).not.toHaveBeenCalled();
    // Snapped to the first flat-top hex center (50, sqrt(3)*25).
    expect(mapStudio.addTile).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: "terrain:stone-floor",
        x: 50,
        y: expect.closeTo(Math.sqrt(3) * 25, 5) as number,
      }),
    );
  });

  it("accumulates a drag into one deduped terrain stroke", () => {
    const document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);

    const canvas = screen.getByRole("img", { name: "Keep studio canvas" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
      toJSON: () => ({}),
    });

    firePointer(canvas, "pointerdown", { pointerId: 1, clientX: 10, clientY: 10 });
    firePointer(canvas, "pointermove", { pointerId: 1, clientX: 30, clientY: 10 }); // same cell
    firePointer(canvas, "pointermove", { pointerId: 1, clientX: 60, clientY: 10 });
    firePointer(canvas, "pointermove", { pointerId: 1, clientX: 60, clientY: 60 });
    firePointer(canvas, "pointerup", { pointerId: 1, clientX: 60, clientY: 60 });

    expect(mapStudio.paintTerrain).toHaveBeenCalledTimes(1);
    expect(mapStudio.paintTerrain).toHaveBeenCalledWith([
      { x: 0, y: 0, assetId: "terrain:stone-floor" },
      { x: 1, y: 0, assetId: "terrain:stone-floor" },
      { x: 1, y: 1, assetId: "terrain:stone-floor" },
    ]);
  });

  it("erases painted terrain cells when no element sits on top", () => {
    let document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    document = paintTerrainDocument(document, [{ x: 1, y: 1, assetId: "terrain:stone-floor" }]);
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);

    const canvas = screen.getByRole("img", { name: "Keep studio canvas" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
      toJSON: () => ({}),
    });

    fireEvent.click(screen.getByRole("button", { name: "Erase" }));
    firePointer(canvas, "pointerdown", { pointerId: 1, clientX: 60, clientY: 60 });
    firePointer(canvas, "pointerup", { pointerId: 1, clientX: 60, clientY: 60 });

    expect(mapStudio.paintTerrain).toHaveBeenCalledWith([{ x: 1, y: 1, assetId: null }]);
    expect(mapStudio.removeElement).not.toHaveBeenCalled();
  });

  it("eyedrops the terrain under the cursor with Ctrl+click and selects it", () => {
    let document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    document = paintTerrainDocument(document, [{ x: 1, y: 1, assetId: "terrain:water" }]);
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);

    const canvas = screen.getByRole("img", { name: "Keep studio canvas" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
      toJSON: () => ({}),
    });

    // Stone floor is selected by default; Ctrl+click over the water cell samples it.
    firePointer(canvas, "pointerdown", { pointerId: 1, clientX: 60, clientY: 60, ctrlKey: true });
    firePointer(canvas, "pointerup", { pointerId: 1, clientX: 60, clientY: 60, ctrlKey: true });

    // Sampling never paints…
    expect(mapStudio.paintTerrain).not.toHaveBeenCalled();
    // …and the sampled asset becomes the active brush: painting elsewhere now lays water.
    firePointer(canvas, "pointerdown", { pointerId: 1, clientX: 110, clientY: 10 });
    firePointer(canvas, "pointerup", { pointerId: 1, clientX: 110, clientY: 10 });
    expect(mapStudio.paintTerrain).toHaveBeenCalledWith([{ x: 2, y: 0, assetId: "terrain:water" }]);
  });

  it("keeps terrain strokes accumulating while a save is in flight", () => {
    let document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    document = paintTerrainDocument(document, [{ x: 2, y: 2, assetId: "terrain:stone-floor" }]);
    // saving: true simulates the window between a dispatched command and its
    // ack — local stroke accumulation must not freeze.
    const mapStudio = controller({ activeDocument: document, saving: true });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);

    const canvas = screen.getByRole("img", { name: "Keep studio canvas" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
      toJSON: () => ({}),
    });

    firePointer(canvas, "pointerdown", { pointerId: 1, clientX: 10, clientY: 10 });
    firePointer(canvas, "pointermove", { pointerId: 1, clientX: 60, clientY: 10 });
    firePointer(canvas, "pointerup", { pointerId: 1, clientX: 60, clientY: 10 });
    expect(mapStudio.paintTerrain).toHaveBeenCalledWith([
      { x: 0, y: 0, assetId: "terrain:stone-floor" },
      { x: 1, y: 0, assetId: "terrain:stone-floor" },
    ]);

    // Erase accumulation over painted terrain also survives the in-flight
    // window, while element removal stays gated.
    fireEvent.click(screen.getByRole("button", { name: "Erase" }));
    firePointer(canvas, "pointerdown", { pointerId: 1, clientX: 110, clientY: 110 });
    firePointer(canvas, "pointerup", { pointerId: 1, clientX: 110, clientY: 110 });
    expect(mapStudio.paintTerrain).toHaveBeenLastCalledWith([{ x: 2, y: 2, assetId: null }]);
  });

  it("renders painted terrain on the canvas underlay beneath the SVG, with fused boundaries", () => {
    let document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    // Water is a flat-core terrain family: floors now bake as the procedural
    // field (crisp edges, no core boundary stroke), so water is the stand-in
    // that still exercises the underlay's flat fill + fused-boundary core path.
    document = paintTerrainDocument(document, [
      { x: 0, y: 0, assetId: "terrain:water" },
      { x: 1, y: 0, assetId: "terrain:water" },
    ]);
    // Hide the grid: its lattice line at x=50 shares coordinates with the
    // fused seam this test asserts is never stroked.
    document = { ...document, grid: { ...document.grid, visible: false } };
    const recording = createRecordingContext();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      recording.context as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
      toJSON: () => ({}),
    } as DOMRect);

    const { container } = render(
      <MapStudioWorkspace controller={controller({ activeDocument: document })} onExit={vi.fn()} />,
    );

    // The canvas precedes the SVG in document order — terrain paints beneath.
    const underlay = container.querySelector("canvas")!;
    expect(underlay).not.toBeNull();
    const svg = screen.getByRole("img", { name: "Keep studio canvas" });
    expect(underlay.compareDocumentPosition(svg) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Both stone cells fill, but the fused interior seam is never stroked.
    expect(recording.calls).toContainEqual(["fillRect", 0, 0, 50, 50]);
    expect(recording.calls).toContainEqual(["fillRect", 50, 0, 50, 50]);
    expect(hasCallPair(recording.calls, ["moveTo", 50, 0], ["lineTo", 50, 50])).toBe(false);
    // The border against empty canvas is: the left edge of the first cell.
    expect(hasCallPair(recording.calls, ["moveTo", 0, 0], ["lineTo", 0, 50])).toBe(true);
  });

  it("Alt-click with the tile tool places a free stamp centered on the cursor", () => {
    const document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);

    const canvas = screen.getByRole("img", { name: "Keep studio canvas" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
      toJSON: () => ({}),
    });

    firePointer(canvas, "pointerdown", { pointerId: 1, clientX: 73, clientY: 61, altKey: true });
    firePointer(canvas, "pointerup", { pointerId: 1, clientX: 73, clientY: 61, altKey: true });

    // 1x1 stone-floor asset is 50px square: centered on (73,61) at 1px precision.
    expect(mapStudio.addStamp).toHaveBeenCalledWith({
      layerId: "terrain",
      assetId: "terrain:stone-floor",
      x: 48,
      y: 36,
      width: 50,
      height: 50,
    });
    expect(mapStudio.addTile).not.toHaveBeenCalled();
  });

  it("clamps Alt-placed stamps inside the document at 1px precision", () => {
    const document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);

    const canvas = screen.getByRole("img", { name: "Keep studio canvas" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
      toJSON: () => ({}),
    });

    firePointer(canvas, "pointerdown", { pointerId: 1, clientX: 197, clientY: 3, altKey: true });
    firePointer(canvas, "pointerup", { pointerId: 1, clientX: 197, clientY: 3, altKey: true });

    expect(mapStudio.addStamp).toHaveBeenCalledWith(
      expect.objectContaining({ x: 150, y: 0, width: 50, height: 50 }),
    );
  });

  it("rotates a selected stamp in 15-degree steps with R and back with Shift+R", () => {
    const document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    document.elements = [
      {
        id: "crate-stamp",
        type: "stamp",
        layerId: "objects",
        locked: false,
        hidden: false,
        transform: { x: 40, y: 40, scaleX: 1, scaleY: 1, rotation: 0 },
        data: { assetId: "objects:crate", width: 50, height: 50 },
      },
    ];
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    firePointer(screen.getByRole("button", { name: "Select stamp 1" }), "pointerdown", {
      pointerId: 1,
      clientX: 50,
      clientY: 50,
    });

    const canvas = screen.getByRole("img", { name: "Keep studio canvas" });
    fireEvent.keyDown(canvas, { key: "r" });
    expect(mapStudio.updateElement).toHaveBeenCalledWith("crate-stamp", {
      transform: { x: 40, y: 40, scaleX: 1, scaleY: 1, rotation: 15 },
    });

    fireEvent.keyDown(canvas, { key: "R", shiftKey: true });
    expect(mapStudio.updateElement).toHaveBeenLastCalledWith("crate-stamp", {
      transform: { x: 40, y: 40, scaleX: 1, scaleY: 1, rotation: 345 },
    });
  });

  it("leaves Ctrl+R and walls alone, and ignores non-primary buttons", () => {
    const document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    document.elements = [
      {
        id: "crate-stamp",
        type: "stamp",
        layerId: "objects",
        locked: false,
        hidden: false,
        transform: { x: 40, y: 40, scaleX: 1, scaleY: 1, rotation: 0 },
        data: { assetId: "objects:crate", width: 50, height: 50 },
      },
      {
        id: "north-wall",
        type: "wall",
        layerId: "walls",
        locked: false,
        hidden: false,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        data: {
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
          ],
          blocksMovement: true,
          blocksVision: true,
        },
      },
    ];
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);
    const canvas = screen.getByRole("img", { name: "Keep studio canvas" });

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    firePointer(screen.getByRole("button", { name: "Select stamp 1" }), "pointerdown", {
      pointerId: 1,
      clientX: 50,
      clientY: 50,
    });
    fireEvent.keyDown(canvas, { key: "r", ctrlKey: true }); // browser reload
    expect(mapStudio.updateElement).not.toHaveBeenCalled();

    firePointer(screen.getByRole("button", { name: "Select wall 2" }), "pointerdown", {
      pointerId: 1,
      clientX: 10,
      clientY: 2,
    });
    fireEvent.keyDown(canvas, { key: "r" }); // walls don't rotate
    expect(mapStudio.updateElement).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Tile" }));
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
      toJSON: () => ({}),
    });
    firePointer(canvas, "pointerdown", { pointerId: 1, clientX: 60, clientY: 60, button: 2 });
    firePointer(canvas, "pointerdown", {
      pointerId: 1,
      clientX: 60,
      clientY: 60,
      button: 2,
      altKey: true,
    });
    expect(mapStudio.addTile).not.toHaveBeenCalled();
    expect(mapStudio.addStamp).not.toHaveBeenCalled();
  });

  it("scatters a seeded batch of stamps in one click", () => {
    const document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);

    const canvas = screen.getByRole("img", { name: "Keep studio canvas" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
      toJSON: () => ({}),
    });

    fireEvent.click(screen.getByRole("button", { name: "Scatter" }));
    firePointer(canvas, "pointerdown", { pointerId: 1, clientX: 100, clientY: 100 });
    firePointer(canvas, "pointerup", { pointerId: 1, clientX: 100, clientY: 100 });

    expect(mapStudio.addStamps).toHaveBeenCalledTimes(1);
    const drafts = vi.mocked(mapStudio.addStamps).mock.calls[0]?.[0] ?? [];
    expect(drafts).toHaveLength(7);
    for (const draft of drafts) {
      expect(draft).toMatchObject({ assetId: "terrain:stone-floor", width: 50, height: 50 });
      expect(draft.rotation).toBeGreaterThanOrEqual(0);
      expect(draft.rotation).toBeLessThan(360);
    }
    expect(mapStudio.addTile).not.toHaveBeenCalled();
  });

  it("shows the free-placement ghost as soon as Alt goes down, without mouse movement", () => {
    const document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    const mapStudio = controller({ activeDocument: document });
    const { container } = render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);

    const canvas = screen.getByRole("img", { name: "Keep studio canvas" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
      toJSON: () => ({}),
    });

    firePointer(canvas, "pointermove", { pointerId: 1, clientX: 100, clientY: 100 });
    expect(container.querySelector('rect[stroke="#ffd97f"]')).toBeNull();

    fireEvent.keyDown(window, { key: "Alt" });
    expect(container.querySelector('rect[stroke="#ffd97f"]')).not.toBeNull();

    fireEvent.keyUp(window, { key: "Alt" });
    expect(container.querySelector('rect[stroke="#ffd97f"]')).toBeNull();
  });

  it("edits the selected element through the right-rail inspector", () => {
    const document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    document.elements = [
      {
        id: "crate-stamp",
        type: "stamp",
        layerId: "objects",
        locked: false,
        hidden: false,
        transform: { x: 40, y: 40, scaleX: 1, scaleY: 1, rotation: 0 },
        data: { assetId: "objects:crate", width: 50, height: 50 },
      },
    ];
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);

    // No selection: the inspector stays out of the rail.
    expect(screen.queryByRole("button", { name: "APPLY ELEMENT" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    firePointer(screen.getByRole("button", { name: "Select stamp 1" }), "pointerdown", {
      pointerId: 1,
      clientX: 50,
      clientY: 50,
    });

    fireEvent.change(screen.getByLabelText("Element rotation"), { target: { value: "45" } });
    fireEvent.change(screen.getByLabelText("Element scale X"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "APPLY ELEMENT" }));

    expect(mapStudio.updateElement).toHaveBeenCalledWith("crate-stamp", {
      transform: { x: 40, y: 40, scaleX: 2, scaleY: 1, rotation: 45 },
      layerId: "objects",
      hidden: false,
      locked: false,
    });
  });

  it("authors a placed door's state and width via the inspector's door section", () => {
    const document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    document.elements = [
      {
        id: "front-door",
        type: "door",
        layerId: "walls",
        locked: false,
        hidden: false,
        transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0 },
        data: { width: 50, state: "closed", blocksMovement: true, blocksVision: true },
      },
    ];
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    firePointer(screen.getByRole("button", { name: "Select door 1" }), "pointerdown", {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });

    // The door section is a dedicated authoring control (separate from the
    // transform APPLY ELEMENT); rotation stays on the transform inspector.
    fireEvent.change(screen.getByLabelText("Door state"), { target: { value: "secret" } });
    fireEvent.change(screen.getByLabelText("Door width"), { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: "APPLY DOOR" }));

    expect(mapStudio.updateDoor).toHaveBeenCalledWith("front-door", { state: "secret", width: 80 });
    // Authoring door state does NOT ride the generic update-element path.
    expect(mapStudio.updateElement).not.toHaveBeenCalled();
  });

  it("shows no door section for a non-door element", () => {
    const document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    document.elements = [
      {
        id: "crate-stamp",
        type: "stamp",
        layerId: "objects",
        locked: false,
        hidden: false,
        transform: { x: 40, y: 40, scaleX: 1, scaleY: 1, rotation: 0 },
        data: { assetId: "objects:crate", width: 50, height: 50 },
      },
    ];
    render(
      <MapStudioWorkspace controller={controller({ activeDocument: document })} onExit={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    firePointer(screen.getByRole("button", { name: "Select stamp 1" }), "pointerdown", {
      pointerId: 1,
      clientX: 50,
      clientY: 50,
    });

    expect(screen.queryByLabelText("Door state")).toBeNull();
    expect(screen.queryByRole("button", { name: "APPLY DOOR" })).toBeNull();
  });

  it("binds undo, redo, and delete to canvas hotkeys", () => {
    const document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    document.elements = [
      {
        id: "crate-stamp",
        type: "stamp",
        layerId: "objects",
        locked: false,
        hidden: false,
        transform: { x: 40, y: 40, scaleX: 1, scaleY: 1, rotation: 0 },
        data: { assetId: "objects:crate", width: 50, height: 50 },
      },
    ];
    const mapStudio = controller({ activeDocument: document, canUndo: true, canRedo: true });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);
    const canvas = screen.getByRole("img", { name: "Keep studio canvas" });

    fireEvent.keyDown(canvas, { key: "z", ctrlKey: true });
    expect(mapStudio.undo).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(canvas, { key: "z", ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(canvas, { key: "y", ctrlKey: true });
    expect(mapStudio.redo).toHaveBeenCalledTimes(2);

    // Delete does nothing without a selection…
    fireEvent.keyDown(canvas, { key: "Delete" });
    expect(mapStudio.removeElement).not.toHaveBeenCalled();

    // …and removes the selected element once one is picked.
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    firePointer(screen.getByRole("button", { name: "Select stamp 1" }), "pointerdown", {
      pointerId: 1,
      clientX: 50,
      clientY: 50,
    });
    fireEvent.keyDown(canvas, { key: "Delete" });
    expect(mapStudio.removeElement).toHaveBeenCalledWith("crate-stamp");
  });

  it("refuses hotkey undo/redo when history is empty and delete on locked elements", () => {
    const document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    document.elements = [
      {
        id: "locked-stamp",
        type: "stamp",
        layerId: "objects",
        locked: true,
        hidden: false,
        transform: { x: 40, y: 40, scaleX: 1, scaleY: 1, rotation: 0 },
        data: { assetId: "objects:crate", width: 50, height: 50 },
      },
    ];
    const mapStudio = controller({ activeDocument: document, canUndo: false, canRedo: false });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);
    const canvas = screen.getByRole("img", { name: "Keep studio canvas" });

    fireEvent.keyDown(canvas, { key: "z", ctrlKey: true });
    fireEvent.keyDown(canvas, { key: "y", ctrlKey: true });
    expect(mapStudio.undo).not.toHaveBeenCalled();
    expect(mapStudio.redo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    firePointer(screen.getByRole("button", { name: "Select stamp 1" }), "pointerdown", {
      pointerId: 1,
      clientX: 50,
      clientY: 50,
    });
    fireEvent.keyDown(canvas, { key: "Delete" });
    expect(mapStudio.removeElement).not.toHaveBeenCalled();
  });

  it("rotates a selected tile in 90-degree steps with R", () => {
    const document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    document.elements = [
      createTileElement("floor-tile", {
        layerId: "terrain",
        assetId: "terrain:stone-floor",
        x: 50,
        y: 50,
        columns: 1,
        rows: 1,
      }),
    ];
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    firePointer(screen.getByRole("button", { name: "Select tile 1" }), "pointerdown", {
      pointerId: 1,
      clientX: 60,
      clientY: 60,
    });
    fireEvent.keyDown(screen.getByRole("img", { name: "Keep studio canvas" }), { key: "r" });

    expect(mapStudio.updateElement).toHaveBeenCalledWith(
      "floor-tile",
      expect.objectContaining({ transform: expect.objectContaining({ rotation: 90 }) }),
    );
  });

  it("zooms the studio canvas with the mouse wheel and pans with the pan tool", () => {
    const document = createMapDocument({ id: "map", name: "Keep", width: 400, height: 400 });
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);

    const canvas = screen.getByRole("img", { name: "Keep studio canvas" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: 400,
      width: 400,
      height: 400,
      toJSON: () => ({}),
    });

    fireEvent.wheel(canvas, { deltaY: -100, clientX: 200, clientY: 200 });
    expect(canvas.getAttribute("viewBox")).toBe("36 36 328 328");

    fireEvent.click(screen.getByRole("button", { name: "Pan" }));
    firePointer(canvas, "pointerdown", { pointerId: 1, clientX: 200, clientY: 200 });
    firePointer(canvas, "pointermove", { pointerId: 1, clientX: 160, clientY: 160 });
    firePointer(canvas, "pointerup", { pointerId: 1, clientX: 160, clientY: 160 });

    expect(canvas.getAttribute("viewBox")).not.toBe("36 36 328 328");
  });

  it("draws a room rectangle as one batch of floor and wall tiles", () => {
    const document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);

    const canvas = screen.getByRole("img", { name: "Keep studio canvas" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
      toJSON: () => ({}),
    });

    fireEvent.click(screen.getByRole("button", { name: "Room" }));
    firePointer(canvas, "pointerdown", { pointerId: 1, clientX: 10, clientY: 10 });
    firePointer(canvas, "pointermove", { pointerId: 1, clientX: 60, clientY: 60 });
    firePointer(canvas, "pointerup", { pointerId: 1, clientX: 60, clientY: 60 });

    expect(mapStudio.addTiles).toHaveBeenCalledTimes(1);
    const drafts = vi.mocked(mapStudio.addTiles).mock.calls[0]?.[0] ?? [];
    expect(drafts).toHaveLength(8);
    expect(drafts.filter((draft) => draft.assetId === "terrain:stone-floor")).toHaveLength(4);
    expect(drafts.filter((draft) => draft.assetId === "structures:stone-wall")).toHaveLength(4);
    expect(drafts).toContainEqual(expect.objectContaining({ layerId: "terrain", x: 0, y: 0 }));
    expect(drafts).toContainEqual(expect.objectContaining({ layerId: "walls", x: 50, y: 50 }));
  });

  it("can draw room floors without wall tiles", () => {
    const document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);

    const canvas = screen.getByRole("img", { name: "Keep studio canvas" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
      toJSON: () => ({}),
    });

    fireEvent.change(screen.getByLabelText("Room wall tile"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Room" }));
    firePointer(canvas, "pointerdown", { pointerId: 1, clientX: 10, clientY: 10 });
    firePointer(canvas, "pointermove", { pointerId: 1, clientX: 60, clientY: 60 });
    firePointer(canvas, "pointerup", { pointerId: 1, clientX: 60, clientY: 60 });

    const drafts = vi.mocked(mapStudio.addTiles).mock.calls[0]?.[0] ?? [];
    expect(drafts).toHaveLength(4);
    expect(drafts.every((draft) => draft.assetId === "terrain:stone-floor")).toBe(true);
  });

  it("places a wall as a two-point drag on the walls layer", () => {
    const document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);

    const canvas = screen.getByRole("img", { name: "Keep studio canvas" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
      toJSON: () => ({}),
    });

    fireEvent.click(screen.getByRole("button", { name: "Wall" }));
    firePointer(canvas, "pointerdown", { pointerId: 1, clientX: 10, clientY: 10 }); // snaps (0,0)
    firePointer(canvas, "pointermove", { pointerId: 1, clientX: 160, clientY: 10 }); // snaps (150,0)
    firePointer(canvas, "pointerup", { pointerId: 1, clientX: 160, clientY: 10 });

    expect(mapStudio.addWall).toHaveBeenCalledWith({
      layerId: "walls",
      x1: 0,
      y1: 0,
      x2: 150,
      y2: 0,
      blocksMovement: true,
      blocksVision: true,
    });
    expect(mapStudio.addDoor).not.toHaveBeenCalled();
  });

  it("places a door as a two-point drag, angled along the drag and closed by default", () => {
    const document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);

    const canvas = screen.getByRole("img", { name: "Keep studio canvas" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
      toJSON: () => ({}),
    });

    fireEvent.click(screen.getByRole("button", { name: "Door" }));
    firePointer(canvas, "pointerdown", { pointerId: 1, clientX: 10, clientY: 10 }); // snaps (0,0)
    firePointer(canvas, "pointermove", { pointerId: 1, clientX: 110, clientY: 10 }); // snaps (100,0)
    firePointer(canvas, "pointerup", { pointerId: 1, clientX: 110, clientY: 10 });

    expect(mapStudio.addDoor).toHaveBeenCalledWith({
      layerId: "walls",
      x: 0,
      y: 0,
      width: 100,
      rotation: 0,
      state: "closed",
      blocksMovement: true,
      blocksVision: true,
    });
    expect(mapStudio.addWall).not.toHaveBeenCalled();
  });

  it("does not place a wall while a save is in flight (command-queue drop guard)", () => {
    const document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    const mapStudio = controller({ activeDocument: document, saving: true });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);

    const canvas = screen.getByRole("img", { name: "Keep studio canvas" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
      toJSON: () => ({}),
    });

    fireEvent.click(screen.getByRole("button", { name: "Wall" }));
    firePointer(canvas, "pointerdown", { pointerId: 1, clientX: 10, clientY: 10 });
    firePointer(canvas, "pointermove", { pointerId: 1, clientX: 160, clientY: 10 });
    firePointer(canvas, "pointerup", { pointerId: 1, clientX: 160, clientY: 10 });

    expect(mapStudio.addWall).not.toHaveBeenCalled();
  });

  it("erases the topmost overlapping tile on the same layer", () => {
    const document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    document.elements = [
      createTileElement("bottom-tile", {
        layerId: "terrain",
        assetId: "terrain:stone-floor",
        x: 50,
        y: 50,
        columns: 1,
        rows: 1,
      }),
      createTileElement("top-tile", {
        layerId: "terrain",
        assetId: "terrain:wood-floor",
        x: 50,
        y: 50,
        columns: 1,
        rows: 1,
      }),
    ];
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);

    const canvas = screen.getByRole("img", { name: "Keep studio canvas" });
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 200,
      width: 200,
      height: 200,
      toJSON: () => ({}),
    });

    fireEvent.click(screen.getByRole("button", { name: "Erase" }));
    firePointer(canvas, "pointerdown", { pointerId: 1, clientX: 60, clientY: 60 });
    firePointer(canvas, "pointerup", { pointerId: 1, clientX: 60, clientY: 60 });

    expect(mapStudio.removeElement).toHaveBeenCalledWith("top-tile");
  });

  it("fuses adjacent same-terrain tiles on the live canvas", () => {
    const document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    document.elements = [
      createTileElement("left-tile", {
        layerId: "terrain",
        assetId: "terrain:stone-floor",
        x: 0,
        y: 0,
        columns: 1,
        rows: 1,
      }),
      createTileElement("right-tile", {
        layerId: "terrain",
        assetId: "terrain:stone-floor",
        x: 50,
        y: 0,
        columns: 1,
        rows: 1,
      }),
    ];
    render(
      <MapStudioWorkspace controller={controller({ activeDocument: document })} onExit={vi.fn()} />,
    );

    const leftGroup = screen.getByRole("button", { name: "Select tile 1" });
    const rect = leftGroup.querySelector("rect");
    expect(rect?.getAttribute("stroke")).toBeNull();
    const boundary = leftGroup.querySelector("path");
    expect(boundary).not.toBeNull();
    expect(boundary!.getAttribute("d")).toContain("M 0 0 H 50"); // top border kept
    expect(boundary!.getAttribute("d")).not.toContain("M 50 0 V 50"); // shared edge fused
  });

  it("publishes the active map document through the controller", async () => {
    vi.mocked(rasterizeAndUploadMapBackground).mockResolvedValue(PUBLISHED_URL);
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    const publishDocument = vi.fn(() => true);
    render(
      <MapStudioWorkspace
        controller={controller({ activeDocument: document, publishDocument })}
        onExit={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(publishDocument).toHaveBeenCalledWith(PUBLISHED_URL, "map", "full"));
    expect(screen.getByRole("status")).toHaveTextContent('Published "Keep" to the live map.');
  });

  it("publishes a baked raster by reference in full mode (supersedes R5b live terrain)", async () => {
    // Slice 4: the whole map (terrain composited) is baked to a PNG and uploaded;
    // only the /assets URL rides the wire, in "full" mode, so the table renders it
    // as the map image instead of streaming + drawing live terrain.
    vi.mocked(rasterizeAndUploadMapBackground).mockResolvedValue(PUBLISHED_URL);
    let document = createMapDocument({ id: "map", name: "Keep", width: 200, height: 200 });
    document = paintTerrainDocument(document, [{ x: 1, y: 1, assetId: "terrain:water" }]);
    const publishDocument = vi.fn(() => true);
    const mapStudio = controller({ activeDocument: document, publishDocument });
    render(<MapStudioWorkspace controller={mapStudio} onExit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(publishDocument).toHaveBeenCalled());
    const [publishedBackground, , backgroundMode] = publishDocument.mock.calls[0] as unknown as [
      string,
      string | undefined,
      string | undefined,
    ];
    expect(backgroundMode).toBe("full");
    expect(publishedBackground).toBe(PUBLISHED_URL);
    expect(publishedBackground).not.toMatch(/^data:/);
    // Baked from the document, uploaded through the controller's authenticated uploader.
    expect(rasterizeAndUploadMapBackground).toHaveBeenCalledWith(document, mapStudio.uploadAsset);
  });

  it("shows the uploader and the stored shelf under the My Stuff tab", () => {
    const hash = "e".repeat(64);
    const backing = new Map<string, string>([
      [
        "herobyte-my-stuff",
        JSON.stringify([{ hash, name: "Pixel Torch", mime: "image/png", size: 64, addedAt: 5 }]),
      ],
    ]);
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (key: string) => backing.get(key) ?? null,
        setItem: (key: string, value: string) => void backing.set(key, value),
        removeItem: (key: string) => void backing.delete(key),
        clear: () => backing.clear(),
      },
      writable: true,
      configurable: true,
    });

    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    render(
      <MapStudioWorkspace controller={controller({ activeDocument: document })} onExit={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "My Stuff" }));

    expect(screen.getByLabelText("Upload images to My Stuff")).toBeInTheDocument();
    const assetButton = screen.getByRole("button", { name: "Choose Pixel Torch" });
    const thumbnail = assetButton.querySelector("img");
    expect(thumbnail?.getAttribute("src")).toBe(`http://localhost:8787/assets/${hash}`);

    fireEvent.click(assetButton);
    // Selection highlight confirms the uploaded asset armed for placement.
    expect(assetButton).toHaveStyle({ border: "2px solid #7fd6ff" });
  });

  it("refuses to publish and reports why when the baked raster is too large to upload", async () => {
    // Upload-by-reference replaces the old inline 1MB cap with the /assets 5MB
    // ceiling; an oversize bake surfaces as an AssetUploadError, not a silent drop.
    vi.mocked(rasterizeAndUploadMapBackground).mockRejectedValue(
      new AssetUploadError("too-large", "That image is over the 5MB upload limit."),
    );
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    const publishDocument = vi.fn(() => true);
    render(
      <MapStudioWorkspace
        controller={controller({ activeDocument: document, publishDocument })}
        onExit={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/over the 5MB upload limit/i),
    );
    expect(publishDocument).not.toHaveBeenCalled();
  });

  it("drops to the Select tool when opening an empty My Stuff shelf", () => {
    const backing = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: (key: string) => backing.get(key) ?? null,
        setItem: (key: string, value: string) => void backing.set(key, value),
        removeItem: (key: string) => void backing.delete(key),
        clear: () => backing.clear(),
      },
      writable: true,
      configurable: true,
    });
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    render(
      <MapStudioWorkspace controller={controller({ activeDocument: document })} onExit={vi.fn()} />,
    );

    // Tile is the default armed tool (primary variant).
    expect(screen.getByRole("button", { name: "Tile" })).toHaveClass("jrpg-button-primary");
    fireEvent.click(screen.getByRole("button", { name: "My Stuff" }));
    // Nothing to paint, so the canvas must not stay armed on a hidden asset.
    expect(screen.getByRole("button", { name: "Select" })).toHaveClass("jrpg-button-primary");
    expect(screen.getByRole("button", { name: "Tile" })).not.toHaveClass("jrpg-button-primary");
  });

  it("shows no publish confirmation when the controller rejects the publish", async () => {
    vi.mocked(rasterizeAndUploadMapBackground).mockResolvedValue(PUBLISHED_URL);
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    const publishDocument = vi.fn(() => false);
    render(
      <MapStudioWorkspace
        controller={controller({ activeDocument: document, publishDocument })}
        onExit={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    // The background renders asynchronously; wait for the rejected publish
    // call before asserting that no confirmation appeared.
    await waitFor(() => expect(publishDocument).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
  });
});

function firePointer(
  target: Element,
  type: "pointerdown" | "pointermove" | "pointerup",
  init: {
    pointerId: number;
    clientX: number;
    clientY: number;
    altKey?: boolean;
    ctrlKey?: boolean;
    button?: number;
  },
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.clientX,
    clientY: init.clientY,
    altKey: init.altKey ?? false,
    ctrlKey: init.ctrlKey ?? false,
    button: init.button ?? 0,
  });
  Object.defineProperty(event, "pointerId", { value: init.pointerId });
  fireEvent(target, event);
}
