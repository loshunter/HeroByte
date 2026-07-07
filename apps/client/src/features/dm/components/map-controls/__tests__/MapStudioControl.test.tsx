import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    addTile: vi.fn(() => "tile-id"),
    addTiles: vi.fn(() => ["tile-id"]),
    addStamp: vi.fn(() => "stamp-id"),
    addStamps: vi.fn(() => ["stamp-id"]),
    paintTerrain: vi.fn(),
    addShape: vi.fn(() => "shape-id"),
    addWall: vi.fn(() => "wall-id"),
    addDoor: vi.fn(() => "door-id"),
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

describe("MapStudioControl", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("loads documents, creates a map, and opens the full-canvas studio", () => {
    const mapStudio = controller();
    const onOpenStudio = vi.fn();
    render(<MapStudioControl controller={mapStudio} onOpenStudio={onOpenStudio} />);
    expect(mapStudio.refresh).toHaveBeenCalledOnce();

    fireEvent.change(screen.getByLabelText("New map name"), { target: { value: "Dungeon" } });
    fireEvent.change(screen.getByLabelText("Width in pixels"), { target: { value: "4096" } });
    fireEvent.change(screen.getByLabelText("Height in pixels"), { target: { value: "1024" } });
    fireEvent.click(screen.getByRole("button", { name: "CREATE EDITABLE MAP" }));

    expect(mapStudio.createDocument).toHaveBeenCalledWith("Dungeon", 4096, 1024);
    expect(onOpenStudio).toHaveBeenCalledOnce();
  });

  it("opens a selected document on the main canvas and can delete it", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const onOpenStudio = vi.fn();
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
    render(<MapStudioControl controller={mapStudio} onOpenStudio={onOpenStudio} />);

    fireEvent.change(screen.getByLabelText("Saved maps"), { target: { value: "map" } });
    fireEvent.click(screen.getByRole("button", { name: "OPEN ON CANVAS" }));
    expect(mapStudio.openDocument).toHaveBeenCalledWith("map");
    expect(onOpenStudio).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "DELETE" }));
    expect(window.confirm).toHaveBeenCalledWith('Delete map "Keep"? This cannot be undone.');
    expect(mapStudio.deleteDocument).toHaveBeenCalledWith("map");
  });

  it("shows active map status, exports, undo/redo, and a main-canvas edit button", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    const onOpenStudio = vi.fn();
    const mapStudio = controller({ activeDocument: document, canUndo: true, canRedo: true });
    render(<MapStudioControl controller={mapStudio} onOpenStudio={onOpenStudio} />);

    expect(screen.getByText(/Keep/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EXPORT SVG" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "BACKUP JSON" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "EXPORT PNG" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "EXPORT WEBP" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "↶ UNDO" }));
    fireEvent.click(screen.getByRole("button", { name: "↷ REDO" }));
    fireEvent.click(screen.getByRole("button", { name: "EDIT ON MAIN CANVAS" }));

    expect(mapStudio.undo).toHaveBeenCalledOnce();
    expect(mapStudio.redo).toHaveBeenCalledOnce();
    expect(onOpenStudio).toHaveBeenCalledOnce();
  });

  it("publishes the active document as a live map background with synced grid size", async () => {
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

    await waitFor(() =>
      expect(onPublishToLiveMap).toHaveBeenCalledWith(
        expect.objectContaining({
          backgroundUrl: expect.stringMatching(/^data:image\/svg\+xml;charset=utf-8,/),
          documentId: "map",
          documentName: "Keep",
          gridSize: 64,
          // DM-menu publish is now elements-only (parity with the studio button):
          // terrain rides the wire as data, not baked into the background.
          backgroundMode: "elements-only",
        }),
      ),
    );
    expect(screen.getByRole("status")).toHaveTextContent('Published "Keep" to the live map.');
  });

  it("clamps published live grid size to the server-supported range", async () => {
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

    await waitFor(() =>
      expect(onPublishToLiveMap).toHaveBeenCalledWith(expect.objectContaining({ gridSize: 500 })),
    );
  });

  it("does not render the old miniature editable map canvas", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    render(<MapStudioControl controller={controller({ activeDocument: document })} />);

    expect(screen.queryByRole("img", { name: /map preview/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ADD TO MAP" })).not.toBeInTheDocument();
  });

  it("surfaces command errors and disables actions while a save is pending", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    render(
      <MapStudioControl
        controller={controller({ activeDocument: document, saving: true, error: "Conflict" })}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Conflict");
    expect(screen.getByRole("button", { name: "CREATE EDITABLE MAP" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "EDIT ON MAIN CANVAS" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "PUBLISH TO LIVE MAP" })).toBeDisabled();
  });
});
