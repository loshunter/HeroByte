import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createMapDocument } from "@herobyte/shared";
import type { MapStudioController } from "../types";
import { MapStudioWorkspace } from "../components/MapStudioWorkspace";
import { createTileElement } from "../elementBuilders";

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
    addShape: vi.fn(() => "shape-id"),
    addWall: vi.fn(() => "wall-id"),
    addDoor: vi.fn(() => "door-id"),
    removeElement: vi.fn(),
    updateElement: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    publishDocument: vi.fn(() => true),
    importDocument: vi.fn(() => "imported-id"),
    handleServerMessage: vi.fn(),
    ...overrides,
  };
}

describe("MapStudioWorkspace", () => {
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

  it("places the selected tile on the full canvas snapped to the document grid", () => {
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
    firePointer(canvas, "pointerup", { pointerId: 1, clientX: 74, clientY: 126 });

    expect(mapStudio.addTile).toHaveBeenCalledWith({
      layerId: "terrain",
      assetId: "terrain:stone-floor",
      x: 50,
      y: 150,
      columns: 1,
      rows: 1,
    });
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

  it("publishes the active map document through the controller", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    const publishDocument = vi.fn(() => true);
    render(
      <MapStudioWorkspace
        controller={controller({ activeDocument: document, publishDocument })}
        onExit={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    expect(publishDocument).toHaveBeenCalledWith(
      expect.stringMatching(/^data:image\/svg\+xml;charset=utf-8,/),
    );
    expect(screen.getByRole("status")).toHaveTextContent('Published "Keep" to the live map.');
  });

  it("shows no publish confirmation when the controller rejects the publish", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    const publishDocument = vi.fn(() => false);
    render(
      <MapStudioWorkspace
        controller={controller({ activeDocument: document, publishDocument })}
        onExit={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    expect(screen.queryByRole("status")).toBeNull();
  });
});

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
