import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMapDocument } from "@herobyte/shared";
import type { MapStudioController } from "../../../../map-studio";
import { MapStudioControl } from "../MapStudioControl";

function controller(overrides: Partial<MapStudioController> = {}): MapStudioController {
  return {
    documents: [],
    activeDocument: null,
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
    addShape: vi.fn(() => "shape-id"),
    addWall: vi.fn(() => "wall-id"),
    addDoor: vi.fn(() => "door-id"),
    removeElement: vi.fn(),
    updateElement: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    handleServerMessage: vi.fn(),
    ...overrides,
  };
}

describe("MapStudioControl", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("loads documents and creates a map with configured dimensions", () => {
    const mapStudio = controller();
    render(<MapStudioControl controller={mapStudio} />);
    expect(mapStudio.refresh).toHaveBeenCalledOnce();

    fireEvent.change(screen.getByLabelText("New map name"), { target: { value: "Dungeon" } });
    fireEvent.change(screen.getByLabelText("Width in pixels"), { target: { value: "4096" } });
    fireEvent.change(screen.getByLabelText("Height in pixels"), { target: { value: "1024" } });
    fireEvent.click(screen.getByRole("button", { name: "CREATE EDITABLE MAP" }));

    expect(mapStudio.createDocument).toHaveBeenCalledWith("Dungeon", 4096, 1024);
  });

  it("opens and deletes a selected document", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const mapStudio = controller({
      documents: [
        {
          id: "map",
          name: "Keep",
          width: 2048,
          height: 2048,
          revision: 3,
          createdAt: 1,
          updatedAt: 2,
        },
      ],
    });
    render(<MapStudioControl controller={mapStudio} />);

    fireEvent.change(screen.getByLabelText("Saved maps"), { target: { value: "map" } });
    fireEvent.click(screen.getByRole("button", { name: "OPEN" }));
    expect(mapStudio.openDocument).toHaveBeenCalledWith("map");

    fireEvent.click(screen.getByRole("button", { name: "DELETE" }));
    expect(window.confirm).toHaveBeenCalledWith('Delete map "Keep"? This cannot be undone.');
    expect(mapStudio.deleteDocument).toHaveBeenCalledWith("map");
  });

  it("edits layer visibility, locking, opacity, and order", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioControl controller={mapStudio} />);

    fireEvent.click(screen.getByLabelText("Show Terrain"));
    expect(mapStudio.updateLayer).toHaveBeenCalledWith("terrain", { visible: false });

    fireEvent.click(screen.getByLabelText("Lock Terrain"));
    expect(mapStudio.updateLayer).toHaveBeenCalledWith("terrain", { locked: true });

    fireEvent.change(screen.getByLabelText("Terrain opacity"), { target: { value: "0.5" } });
    expect(mapStudio.updateLayer).toHaveBeenCalledWith("terrain", { opacity: 0.5 });

    fireEvent.click(screen.getByRole("button", { name: "Move Terrain up" }));
    expect(mapStudio.moveLayer).toHaveBeenCalledWith("terrain", 2);
  });

  it("shows progress and disables mutations while loading", () => {
    const mapStudio = controller({ loading: true });
    render(<MapStudioControl controller={mapStudio} />);
    expect(screen.getByRole("button", { name: "WORKING..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "↻" })).toBeDisabled();
  });

  it("adds a shape and renders editable elements in the preview", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    document.elements.push({
      id: "existing",
      type: "shape",
      layerId: "terrain",
      locked: false,
      hidden: false,
      transform: { x: 10, y: 20, scaleX: 1, scaleY: 1, rotation: 0 },
      data: {
        shape: "rectangle",
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 80 },
        ],
        fill: "#333333",
        stroke: "#ffffff",
        strokeWidth: 2,
        opacity: 1,
      },
    });
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioControl controller={mapStudio} />);

    expect(screen.getByRole("img", { name: "Keep map preview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EXPORT SVG" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "BACKUP JSON" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "EXPORT PNG" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "EXPORT WEBP" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Shape X"), { target: { value: "128" } });
    fireEvent.click(screen.getByRole("button", { name: "ADD TO MAP" }));
    expect(mapStudio.addShape).toHaveBeenCalledWith(
      expect.objectContaining({ layerId: "terrain", shape: "rectangle", x: 128 }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete shape 1" }));
    expect(mapStudio.removeElement).toHaveBeenCalledWith("existing");

    fireEvent.click(screen.getByRole("button", { name: "Edit shape 1" }));
    fireEvent.change(screen.getByLabelText("Element X"), { target: { value: "320" } });
    fireEvent.change(screen.getByLabelText("Element rotation"), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "APPLY ELEMENT" }));
    expect(mapStudio.updateElement).toHaveBeenCalledWith(
      "existing",
      expect.objectContaining({ transform: expect.objectContaining({ x: 320, rotation: 45 }) }),
    );
  });

  it("selects and nudges map elements directly on the preview", () => {
    const document = createDocumentWithShape({ width: 200, height: 200 });
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioControl controller={mapStudio} />);

    fireEvent.click(screen.getByRole("button", { name: "Select shape 1" }));
    fireEvent.keyDown(screen.getByRole("img", { name: "Keep map preview" }), {
      key: "ArrowRight",
    });

    expect(mapStudio.updateElement).toHaveBeenCalledWith("existing", {
      transform: { x: 60, y: 20, scaleX: 1, scaleY: 1, rotation: 0 },
    });
  });

  it("drags map elements on the preview and snaps the saved transform to the document grid", () => {
    const document = createDocumentWithShape({ width: 200, height: 200 });
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioControl controller={mapStudio} />);

    const preview = screen.getByRole("img", { name: "Keep map preview" });
    vi.spyOn(preview, "getBoundingClientRect").mockReturnValue({
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
    firePointer(screen.getByRole("button", { name: "Select shape 1" }), "pointerdown", {
      pointerId: 1,
      clientX: 10,
      clientY: 10,
    });
    firePointer(preview, "pointermove", { pointerId: 1, clientX: 67, clientY: 85 });
    firePointer(preview, "pointerup", { pointerId: 1, clientX: 67, clientY: 85 });

    expect(mapStudio.updateElement).toHaveBeenCalledWith("existing", {
      transform: { x: 50, y: 100, scaleX: 1, scaleY: 1, rotation: 0 },
    });
  });

  it("adds wall and door structures to the walls layer", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioControl controller={mapStudio} />);

    fireEvent.change(screen.getByLabelText("Wall start X"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Wall start Y"), { target: { value: "120" } });
    fireEvent.change(screen.getByLabelText("Wall end X"), { target: { value: "300" } });
    fireEvent.change(screen.getByLabelText("Wall end Y"), { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: "ADD WALL" }));
    expect(mapStudio.addWall).toHaveBeenCalledWith(
      expect.objectContaining({
        layerId: "walls",
        x1: 100,
        y1: 120,
        x2: 300,
        y2: 120,
        blocksMovement: true,
        blocksVision: true,
      }),
    );

    fireEvent.change(screen.getByLabelText("Structure type"), { target: { value: "door" } });
    fireEvent.change(screen.getByLabelText("Door X"), { target: { value: "160" } });
    fireEvent.change(screen.getByLabelText("Door Y"), { target: { value: "120" } });
    fireEvent.change(screen.getByLabelText("Door width"), { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText("Door rotation"), { target: { value: "90" } });
    fireEvent.change(screen.getByLabelText("Door state"), { target: { value: "locked" } });
    fireEvent.click(screen.getByRole("button", { name: "ADD DOOR" }));
    expect(mapStudio.addDoor).toHaveBeenCalledWith(
      expect.objectContaining({
        layerId: "walls",
        x: 160,
        y: 120,
        width: 50,
        rotation: 90,
        state: "locked",
      }),
    );
  });

  it("edits document-owned grid settings", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    const mapStudio = controller({ activeDocument: document });
    render(<MapStudioControl controller={mapStudio} />);

    fireEvent.change(screen.getByLabelText("Grid type"), { target: { value: "hex-row" } });
    fireEvent.change(screen.getByLabelText("Grid size"), { target: { value: "64" } });
    fireEvent.click(screen.getByLabelText("Show document grid"));
    fireEvent.click(screen.getByRole("button", { name: "APPLY GRID" }));

    expect(mapStudio.updateGrid).toHaveBeenCalledWith(
      expect.objectContaining({ type: "hex-row", size: 64, visible: false }),
    );
  });

  it("exposes server-backed undo and redo state", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    const mapStudio = controller({ activeDocument: document, canUndo: true, canRedo: true });
    render(<MapStudioControl controller={mapStudio} />);

    fireEvent.click(screen.getByRole("button", { name: "↶ UNDO" }));
    fireEvent.click(screen.getByRole("button", { name: "↷ REDO" }));
    expect(mapStudio.undo).toHaveBeenCalledOnce();
    expect(mapStudio.redo).toHaveBeenCalledOnce();
  });

  it("publishes the active document as a live map background with synced grid size", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    document.grid.size = 64;
    const onPublishToLiveMap = vi.fn();

    render(
      <MapStudioControl
        controller={controller({ activeDocument: document })}
        onPublishToLiveMap={onPublishToLiveMap}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "PUBLISH TO LIVE MAP" }));

    expect(onPublishToLiveMap).toHaveBeenCalledWith(
      expect.objectContaining({
        backgroundUrl: expect.stringMatching(/^data:image\/svg\+xml;charset=utf-8,/),
        documentId: "map",
        documentName: "Keep",
        gridSize: 64,
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent('Published "Keep" to the live map.');
  });

  it("clamps published live grid size to the server-supported range", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    document.grid.size = 900;
    const onPublishToLiveMap = vi.fn();

    render(
      <MapStudioControl
        controller={controller({ activeDocument: document })}
        onPublishToLiveMap={onPublishToLiveMap}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "PUBLISH TO LIVE MAP" }));

    expect(onPublishToLiveMap).toHaveBeenCalledWith(expect.objectContaining({ gridSize: 500 }));
  });

  it("surfaces command errors and disables editing while a save is pending", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    render(
      <MapStudioControl
        controller={controller({ activeDocument: document, saving: true, error: "Conflict" })}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Conflict");
    expect(screen.getByRole("button", { name: "ADD TO MAP" })).toBeDisabled();
    expect(screen.getByLabelText("Show Terrain")).toBeDisabled();
  });
});

function createDocumentWithShape({ width, height }: { width: number; height: number }) {
  const document = createMapDocument({ id: "map", name: "Keep", width, height, timestamp: 1 });
  document.elements.push({
    id: "existing",
    type: "shape",
    layerId: "terrain",
    locked: false,
    hidden: false,
    transform: { x: 10, y: 20, scaleX: 1, scaleY: 1, rotation: 0 },
    data: {
      shape: "rectangle",
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 80 },
      ],
      fill: "#333333",
      stroke: "#ffffff",
      strokeWidth: 2,
      opacity: 1,
    },
  });
  return document;
}

function firePointer(
  target: Element,
  type: "pointerdown" | "pointermove" | "pointerup",
  init: { pointerId: number; clientX: number; clientY: number },
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.clientX,
    clientY: init.clientY,
  });
  Object.defineProperty(event, "pointerId", { value: init.pointerId });
  fireEvent(target, event);
}
