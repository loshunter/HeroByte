import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMapDocument } from "@herobyte/shared";
import type { MapStudioController } from "../../../../map-studio";
import { rasterizeAndUploadMapBackground } from "../../../../map-studio";
import { MapStudioControl } from "../MapStudioControl";

// rasterizeAndUploadMapBackground drives a real <canvas> + HTTP upload — stub it
// so the publish flow is exercised without a browser canvas or a live server.
vi.mock("../../../../map-studio", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../map-studio")>()),
  rasterizeAndUploadMapBackground: vi.fn(),
}));

const PUBLISHED_URL = `http://localhost:8787/assets/${"c".repeat(64)}`;

function controller(overrides: Partial<MapStudioController> = {}): MapStudioController {
  return {
    documents: [],
    activeDocument: null,
    loading: false,
    saving: false,
    error: null,
    missingDocumentId: null,
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
    placeRoom: vi.fn(),
    addShape: vi.fn(() => "shape-id"),
    addWall: vi.fn(() => "wall-id"),
    addDoor: vi.fn(() => "door-id"),
    addLight: vi.fn(() => "light-id"),
    updateDoor: vi.fn(),
    removeElement: vi.fn(),
    updateElement: vi.fn(),
    generate: vi.fn(),
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
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(rasterizeAndUploadMapBackground).mockResolvedValue(PUBLISHED_URL);
  });

  it("loads documents and creates a map document", () => {
    const mapStudio = controller();
    render(<MapStudioControl controller={mapStudio} />);
    expect(mapStudio.refresh).toHaveBeenCalledOnce();

    fireEvent.change(screen.getByLabelText("New map name"), { target: { value: "Dungeon" } });
    fireEvent.change(screen.getByLabelText("Width in pixels"), { target: { value: "4096" } });
    fireEvent.change(screen.getByLabelText("Height in pixels"), { target: { value: "1024" } });
    fireEvent.click(screen.getByRole("button", { name: "CREATE EDITABLE MAP" }));

    expect(mapStudio.createDocument).toHaveBeenCalledWith("Dungeon", 4096, 1024);
  });

  it("opens a selected document as active and can delete it", () => {
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

  it("shows active map status, exports, and undo/redo", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    const mapStudio = controller({ activeDocument: document, canUndo: true, canRedo: true });
    render(<MapStudioControl controller={mapStudio} />);

    expect(screen.getByText(/Keep/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EXPORT SVG" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "BACKUP JSON" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "EXPORT PNG" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "EXPORT WEBP" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "↶ UNDO" }));
    fireEvent.click(screen.getByRole("button", { name: "↷ REDO" }));

    expect(mapStudio.undo).toHaveBeenCalledOnce();
    expect(mapStudio.redo).toHaveBeenCalledOnce();
  });

  it("publishes the active document as an uploaded raster background in full mode", async () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    document.grid.size = 64;
    const mapStudio = controller({ activeDocument: document });
    const onPublishToLiveMap = vi.fn();

    render(<MapStudioControl controller={mapStudio} onPublishToLiveMap={onPublishToLiveMap} />);

    fireEvent.click(screen.getByRole("button", { name: "PUBLISH TO LIVE MAP" }));

    await waitFor(() =>
      expect(onPublishToLiveMap).toHaveBeenCalledWith(
        expect.objectContaining({
          // The baked PNG is uploaded and referenced by its /assets URL — the
          // full raster supersedes the elements-only + live-terrain publish.
          backgroundUrl: PUBLISHED_URL,
          documentId: "map",
          documentName: "Keep",
          gridSize: 64,
          backgroundMode: "full",
        }),
      ),
    );
    // The raster is baked + uploaded through the controller's authenticated uploader.
    expect(rasterizeAndUploadMapBackground).toHaveBeenCalledWith(document, mapStudio.uploadAsset);
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

  const fileInput = (container: HTMLElement) =>
    container.querySelector('input[type="file"]') as HTMLInputElement;

  const importFile = (container: HTMLElement, text: string) => {
    const file = new File([text], "backup.json", { type: "application/json" });
    // jsdom's File.text() isn't guaranteed; shadow it with the known content.
    Object.defineProperty(file, "text", { value: () => Promise.resolve(text) });
    fireEvent.change(fileInput(container), { target: { files: [file] } });
  };

  it("imports a valid JSON backup and shows an in-progress status", async () => {
    const mapStudio = controller();
    const { container } = render(<MapStudioControl controller={mapStudio} />);

    const backup = { schemaVersion: 1, id: "orig", name: "Restored", elements: [] };
    importFile(container, JSON.stringify(backup));

    await waitFor(() =>
      expect(mapStudio.importDocument).toHaveBeenCalledWith(expect.objectContaining(backup)),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Importing map backup…");
  });

  it("resolves the status to a completion once the imported document activates", async () => {
    const mapStudio = controller({ importDocument: vi.fn(() => "imported-id") });
    const { container, rerender } = render(<MapStudioControl controller={mapStudio} />);

    importFile(container, JSON.stringify({ schemaVersion: 1, id: "orig", name: "Restored" }));
    await waitFor(() => expect(mapStudio.importDocument).toHaveBeenCalled());

    const activeDocument = createMapDocument({ id: "imported-id", name: "Restored", timestamp: 1 });
    rerender(<MapStudioControl controller={controller({ ...mapStudio, activeDocument })} />);

    expect(screen.getByRole("status")).toHaveTextContent('Imported "Restored".');
  });

  it("rejects a file that isn't a HeroByte backup, without calling importDocument", async () => {
    const mapStudio = controller();
    const { container } = render(<MapStudioControl controller={mapStudio} />);

    importFile(container, JSON.stringify({ schemaVersion: 2, id: "x" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/not a HeroByte map JSON backup/i),
    );
    expect(mapStudio.importDocument).not.toHaveBeenCalled();
    // The error shows even with no active document (the restore-from-backup case).
    expect(screen.queryByText(/Restored/)).not.toBeInTheDocument();
  });

  it("rejects an oversized backup before sending it into the 1MB WebSocket cap", async () => {
    const mapStudio = controller();
    const { container } = render(<MapStudioControl controller={mapStudio} />);

    // Valid schemaVersion but well over ~1MB once serialized.
    const huge = { schemaVersion: 1, id: "x", filler: "A".repeat(1_100_000) };
    importFile(container, JSON.stringify(huge));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/too large to send/i));
    expect(mapStudio.importDocument).not.toHaveBeenCalled();
  });

  it("surfaces the watchdog failure and clears the stuck 'Importing…' status on a fresh session", async () => {
    const mapStudio = controller();
    const { container, rerender } = render(<MapStudioControl controller={mapStudio} />);

    importFile(container, JSON.stringify({ schemaVersion: 1, id: "orig", name: "Restored" }));
    await waitFor(() => expect(mapStudio.importDocument).toHaveBeenCalled());
    expect(screen.getByRole("status")).toHaveTextContent("Importing map backup…");

    // The useMapStudio watchdog fires (server silently dropped the import): error
    // is set with STILL no active document. The error must be visible and the
    // now-misleading "Importing…" status cleared — no invisible wedge.
    rerender(
      <MapStudioControl
        controller={controller({
          ...mapStudio,
          error: "The map server didn't respond. Please try again.",
        })}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/didn't respond/i);
    expect(screen.queryByText("Importing map backup…")).not.toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "PUBLISH TO LIVE MAP" })).toBeDisabled();
  });
});
