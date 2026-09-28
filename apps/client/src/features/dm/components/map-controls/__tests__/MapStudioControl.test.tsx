import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMapDocument } from "@herobyte/shared";
import type { MapStudioController } from "../../../../map-studio";
import { downloadMapDocument, rasterizeAndUploadMapBackground } from "../../../../map-studio";
import { MapStudioControl } from "../MapStudioControl";

// rasterizeAndUploadMapBackground drives a real <canvas> + HTTP upload — stub it
// so the publish flow is exercised without a browser canvas or a live server.
vi.mock("../../../../map-studio", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../map-studio")>()),
  rasterizeAndUploadMapBackground: vi.fn(),
  downloadMapDocument: vi.fn(),
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
    bindRefusal: null,
    listed: true,
    exportBytes: null,
    canUndo: false,
    canRedo: false,
    refresh: vi.fn(),
    listQuietly: vi.fn(),
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
    addSpline: vi.fn(() => "spline-id"),
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
  it("shows the campaign's weight beside the map list, and warns past the mint ceiling", () => {
    const { rerender } = render(
      <MapStudioControl controller={controller({ exportBytes: 640_000, documents: [] })} />,
    );
    expect(screen.getByTestId("campaign-weight").textContent).toMatch(
      /^Campaign 0\.61 MB of 0\.75 MB · 0 maps — a new map also costs the scene it installs/,
    );

    rerender(<MapStudioControl controller={controller({ exportBytes: 900_000 })} />);
    expect(screen.getByTestId("campaign-weight").textContent).toContain("past the mint ceiling");

    rerender(<MapStudioControl controller={controller({ exportBytes: 1_100_000 })} />);
    expect(screen.getByTestId("campaign-weight").textContent).toContain("NOT load back");

    // Nothing until a server has said: no number that means nothing.
    rerender(<MapStudioControl controller={controller({ exportBytes: null })} />);
    expect(screen.queryByTestId("campaign-weight")).toBeNull();
  });

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
    fireEvent.click(screen.getByRole("button", { name: "＋ Create map in library" }));

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
    fireEvent.click(screen.getByRole("button", { name: "View saved map" }));
    expect(mapStudio.openDocument).toHaveBeenCalledWith("map");

    fireEvent.click(screen.getByRole("button", { name: "DELETE" }));
    expect(window.confirm).toHaveBeenCalledWith(
      'Delete map "Keep"? This cannot be undone.\n\nIf the party left a scene on this map, that ' +
        "saved scene (its NPCs, props, drawings, background and combat) is deleted with it.",
    );
    expect(mapStudio.deleteDocument).toHaveBeenCalledWith("map");
  });

  it("shows active map status, exports, and undo/redo", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    const mapStudio = controller({ activeDocument: document, canUndo: true, canRedo: true });
    render(<MapStudioControl controller={mapStudio} />);

    expect(screen.getByText(/Keep/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export map image (SVG)" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export editable map (.json)" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export map image (PNG)" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export map image (WebP)" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "↶ Undo edit" }));
    fireEvent.click(screen.getByRole("button", { name: "↷ Redo edit" }));

    expect(mapStudio.undo).toHaveBeenCalledOnce();
    expect(mapStudio.redo).toHaveBeenCalledOnce();
  });

  it("publishes the active document as an uploaded raster background in full mode", async () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    document.grid.size = 64;
    const mapStudio = controller({ activeDocument: document });
    const onPublishToLiveMap = vi.fn();

    render(<MapStudioControl controller={mapStudio} onPublishToLiveMap={onPublishToLiveMap} />);

    fireEvent.click(screen.getByRole("button", { name: "Publish map background" }));

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
    expect(screen.getByRole("status")).toHaveTextContent(
      'Published "Keep" as the table\x27s map background.',
    );
  });

  it("asks before publishing a document that is NOT the live scene, naming both maps", async () => {
    // The Studio's active document is the map the DM last looked at — after a
    // kicked-in door, the map they LEFT. Publishing it silently replaced the
    // table with a blank raster of the wrong map. Now it asks, and says what
    // it would replace.
    const keep = createMapDocument({ id: "keep", name: "Keep", timestamp: 1 });
    const mapStudio = controller({
      activeDocument: keep,
      documents: [
        { id: "keep", name: "Keep" },
        { id: "dungeon", name: "Repro Dungeon" },
      ] as never,
    });
    const onPublishToLiveMap = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <MapStudioControl
        controller={mapStudio}
        liveSceneDocumentId="dungeon"
        onPublishToLiveMap={onPublishToLiveMap}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Publish map background" }));

    expect(confirm).toHaveBeenCalledTimes(1);
    const prompt = confirm.mock.calls[0]?.[0] ?? "";
    expect(prompt).toContain('"Keep"');
    expect(prompt).toContain('"Repro Dungeon"');
    await waitFor(() => expect(onPublishToLiveMap).toHaveBeenCalledTimes(1));
  });

  it("a declined confirm publishes nothing, bakes nothing, and says so", async () => {
    const keep = createMapDocument({ id: "keep", name: "Keep", timestamp: 1 });
    const mapStudio = controller({
      activeDocument: keep,
      documents: [
        { id: "keep", name: "Keep" },
        { id: "dungeon", name: "Repro Dungeon" },
      ] as never,
    });
    const onPublishToLiveMap = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <MapStudioControl
        controller={mapStudio}
        liveSceneDocumentId="dungeon"
        onPublishToLiveMap={onPublishToLiveMap}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Publish map background" }));

    expect(screen.getByRole("status")).toHaveTextContent('the table stays on "Repro Dungeon"');
    // Declining costs no bake and no upload — the check is BEFORE the raster.
    expect(rasterizeAndUploadMapBackground).not.toHaveBeenCalled();
    expect(onPublishToLiveMap).not.toHaveBeenCalled();
  });

  it("publishing the map the table is already on is a bake, and asks nothing", async () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    const mapStudio = controller({ activeDocument: document });
    const onPublishToLiveMap = vi.fn();
    const confirm = vi.spyOn(window, "confirm");

    render(
      <MapStudioControl
        controller={mapStudio}
        liveSceneDocumentId="map"
        onPublishToLiveMap={onPublishToLiveMap}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Publish map background" }));

    expect(confirm).not.toHaveBeenCalled();
    await waitFor(() => expect(onPublishToLiveMap).toHaveBeenCalledTimes(1));
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

    fireEvent.click(screen.getByRole("button", { name: "Publish map background" }));

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

  it("says something when the FILE ITSELF cannot be read", async () => {
    // The other half of the message. `importFile` shadows File.text with a
    // resolved promise, so no other test ever exercises a rejected read — the
    // failure the string is literally named after.
    const mapStudio = controller();
    const { container } = render(<MapStudioControl controller={mapStudio} />);
    const file = new File(["{}"], "backup.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: () => Promise.reject(new Error("EIO")) });
    fireEvent.change(fileInput(container), { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Import failed: that file could not be read or applied.",
      ),
    );
    expect(mapStudio.importDocument).not.toHaveBeenCalled();
  });

  it("says something when the import handler itself throws", async () => {
    // THE SILENCE GUARD. The picker used to be `.then(fn, onRejected)`, whose
    // second function catches a failed READ and not a throw from the first — so
    // a crash inside the handler became an unhandled rejection and the panel
    // said nothing at all. `.then(fn).catch(...)` is what makes it speak, and
    // without this test reverting that leaves the whole suite green.
    const mapStudio = controller({
      importDocument: vi.fn(() => {
        throw new Error("boom");
      }),
    });
    const { container } = render(<MapStudioControl controller={mapStudio} />);

    importFile(container, JSON.stringify({ schemaVersion: 1, id: "orig", name: "Restored" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Import failed: that file could not be read or applied.",
      ),
    );
  });

  it("imports a valid JSON backup and shows an in-progress status", async () => {
    const mapStudio = controller();
    const { container } = render(<MapStudioControl controller={mapStudio} />);

    const backup = { schemaVersion: 1, id: "orig", name: "Restored", elements: [] };
    importFile(container, JSON.stringify(backup));

    await waitFor(() =>
      expect(mapStudio.importDocument).toHaveBeenCalledWith(expect.objectContaining(backup)),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Importing editable map…");
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
      expect(screen.getByRole("status")).toHaveTextContent(/not a HeroByte editable map/i),
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
    expect(screen.getByRole("status")).toHaveTextContent("Importing editable map…");

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
    expect(screen.queryByText("Importing editable map…")).not.toBeInTheDocument();
  });

  it("surfaces command errors and disables actions while a save is pending", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 1 });
    render(
      <MapStudioControl
        controller={controller({ activeDocument: document, saving: true, error: "Conflict" })}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Conflict");
    expect(screen.getByRole("button", { name: "＋ Create map in library" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Publish map background" })).toBeDisabled();
  });
});

// U6: the library inspects saved maps; only an explicit, confirmed action
// changes what the party sees. Viewing a map never moves the table.
describe("MapStudioControl — the Map library is not the table (U6)", () => {
  const summaries = [
    {
      id: "crypt",
      name: "Crypt",
      width: 2048,
      height: 2048,
      revision: 4,
      createdAt: 1,
      updatedAt: 2,
    },
    {
      id: "tavern",
      name: "Tavern",
      width: 2048,
      height: 2048,
      revision: 2,
      createdAt: 1,
      updatedAt: 2,
    },
  ];
  const library = (overrides: Partial<MapStudioController> = {}) =>
    controller({ documents: summaries, ...overrides });

  beforeEach(() => vi.restoreAllMocks());

  it("is titled Map library and marks the map that is on the table", () => {
    render(<MapStudioControl controller={library()} tableMapDocumentId="crypt" />);

    expect(screen.getByText("Map library")).toBeInTheDocument();
    const options = Array.from(
      (screen.getByLabelText("Saved maps") as HTMLSelectElement).options,
    ).map((option) => option.textContent);
    expect(options.find((text) => text?.startsWith("● Crypt"))).toMatch(/on table$/);
    expect(options.find((text) => text?.startsWith("Tavern"))).not.toMatch(/on table/);
  });

  it("View saved map opens the selected map for inspection and nothing else", () => {
    // Confirm answers yes: a stray Use at table behind View would bind.
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const mapStudio = library();
    const onUseAtTable = vi.fn();
    render(
      <MapStudioControl
        controller={mapStudio}
        tableMapDocumentId="crypt"
        onUseAtTable={onUseAtTable}
      />,
    );

    fireEvent.change(screen.getByLabelText("Saved maps"), { target: { value: "tavern" } });
    fireEvent.click(screen.getByRole("button", { name: "View saved map" }));
    expect(mapStudio.openDocument).toHaveBeenCalledWith("tavern");
    expect(confirm).not.toHaveBeenCalled();
    expect(onUseAtTable).not.toHaveBeenCalled();
  });

  it("Use at table asks first, naming both maps, then binds through the one existing path", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onUseAtTable = vi.fn();
    render(
      <MapStudioControl
        controller={library()}
        tableMapDocumentId="crypt"
        liveSceneDocumentId="crypt"
        onUseAtTable={onUseAtTable}
      />,
    );

    fireEvent.change(screen.getByLabelText("Saved maps"), { target: { value: "tavern" } });
    fireEvent.click(screen.getByRole("button", { name: "Use at table" }));

    expect(confirm).toHaveBeenCalledTimes(1);
    const prompt = confirm.mock.calls[0]?.[0] ?? "";
    expect(prompt).toContain('Put "Tavern" on the table for everyone?');
    expect(prompt).toContain('"Crypt"');
    expect(onUseAtTable).toHaveBeenCalledWith("tavern");
    expect(screen.getByRole("status")).toHaveTextContent('Putting "Tavern" on the table');
  });

  it("a declined Use at table changes nothing and says the table stays put", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const onUseAtTable = vi.fn();
    render(
      <MapStudioControl
        controller={library()}
        tableMapDocumentId="crypt"
        liveSceneDocumentId="crypt"
        onUseAtTable={onUseAtTable}
      />,
    );

    fireEvent.change(screen.getByLabelText("Saved maps"), { target: { value: "tavern" } });
    fireEvent.click(screen.getByRole("button", { name: "Use at table" }));
    expect(onUseAtTable).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent('The table stays on "Crypt"');
  });

  it("Use at table is disabled for the map already on the table", () => {
    render(
      <MapStudioControl controller={library()} tableMapDocumentId="crypt" onUseAtTable={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText("Saved maps"), { target: { value: "crypt" } });
    expect(screen.getByRole("button", { name: "Use at table" })).toBeDisabled();
  });

  it("reports the switch once the table confirms it", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const mapStudio = library();
    const { rerender } = render(
      <MapStudioControl
        controller={mapStudio}
        tableMapDocumentId="crypt"
        liveSceneDocumentId="crypt"
        onUseAtTable={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Saved maps"), { target: { value: "tavern" } });
    fireEvent.click(screen.getByRole("button", { name: "Use at table" }));
    rerender(
      <MapStudioControl
        controller={mapStudio}
        tableMapDocumentId="tavern"
        liveSceneDocumentId="tavern"
        onUseAtTable={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent('"Tavern" is on the table.');
  });

  it("a refusal ends the wait for THAT map only, and a repeat of the same refusal still lands", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const props = {
      tableMapDocumentId: "crypt",
      liveSceneDocumentId: "crypt",
      onUseAtTable: vi.fn(),
    };
    const refused = (seq: number, documentId = "tavern") => ({
      documentId,
      reason: "Map document not found",
      seq,
    });
    const { rerender } = render(<MapStudioControl controller={library()} {...props} />);
    const use = () => {
      fireEvent.change(screen.getByLabelText("Saved maps"), { target: { value: "tavern" } });
      fireEvent.click(screen.getByRole("button", { name: "Use at table" }));
      expect(screen.getByText(/Putting "Tavern" on the table/)).toBeInTheDocument();
    };
    use();

    // An unrelated error is not this map's refusal.
    rerender(<MapStudioControl controller={library({ error: "Revision conflict" })} {...props} />);
    expect(screen.getByText(/Putting "Tavern" on the table/)).toBeInTheDocument();
    // Nor is a refusal of some other map.
    rerender(
      <MapStudioControl controller={library({ bindRefusal: refused(1, "other") })} {...props} />,
    );
    expect(screen.getByText(/Putting "Tavern" on the table/)).toBeInTheDocument();

    const refusal = refused(2);
    rerender(
      <MapStudioControl
        controller={library({ error: refusal.reason, bindRefusal: refusal })}
        {...props}
      />,
    );
    expect(screen.getByText('"Tavern" is not on the table.')).toBeInTheDocument();

    // The same reason again, a second time: still a new refusal.
    use();
    const again = refused(3);
    rerender(
      <MapStudioControl
        controller={library({ error: again.reason, bindRefusal: again })}
        {...props}
      />,
    );
    expect(screen.getByText('"Tavern" is not on the table.')).toBeInTheDocument();
  });

  it("warns that a scene with no saved map is lost for good, and never promises it back", () => {
    // The table's own map was deleted: the scene still plays, but the server
    // has nowhere to save it, so the next map erases its NPCs, props and more.
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <MapStudioControl
        controller={library()}
        liveSceneDocumentId="deleted-map"
        onUseAtTable={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Saved maps"), { target: { value: "tavern" } });
    fireEvent.click(screen.getByRole("button", { name: "Use at table" }));
    const prompt = confirm.mock.calls[0]?.[0] ?? "";
    expect(prompt).toContain("removed for good");
    expect(prompt).not.toContain("saved exactly as it stands");
    expect(screen.getByRole("status")).toHaveTextContent("The table is unchanged.");
  });

  it("a binding to a map the server reported gone is not promised back either", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <MapStudioControl
        controller={library({ missingDocumentId: "crypt" })}
        tableMapDocumentId="crypt"
        liveSceneDocumentId="crypt"
        onUseAtTable={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Saved maps"), { target: { value: "tavern" } });
    fireEvent.click(screen.getByRole("button", { name: "Use at table" }));
    expect(confirm.mock.calls[0]?.[0]).not.toContain("saved exactly as it stands");
    expect(confirm.mock.calls[0]?.[0]).toContain("removed for good");
  });

  it("a World location's map says what Travel here would do instead", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <MapStudioControl
        controller={library()}
        tableMapDocumentId="crypt"
        liveSceneDocumentId="crypt"
        atlasNodes={[{ name: "The Rusty Tankard", mapDocumentId: "tavern" }]}
        onUseAtTable={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Saved maps"), { target: { value: "tavern" } });
    fireEvent.click(screen.getByRole("button", { name: "Use at table" }));
    const prompt = confirm.mock.calls[0]?.[0] ?? "";
    expect(prompt).toContain('the World location "The Rusty Tankard"');
    expect(prompt).toContain("Use at table does neither");
  });

  it("a background-only table is told its image stays under the map", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<MapStudioControl controller={library()} hasBackground onUseAtTable={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Saved maps"), { target: { value: "tavern" } });
    fireEvent.click(screen.getByRole("button", { name: "Use at table" }));
    expect(confirm.mock.calls[0]?.[0]).toContain("background image stays underneath");
  });

  it("DELETE says what deleting the table's map, or a location's map, really costs", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <MapStudioControl
        controller={library()}
        tableMapDocumentId="crypt"
        liveSceneDocumentId="crypt"
        atlasNodes={[{ name: "Crypt Below", mapDocumentId: "crypt" }]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Saved maps"), { target: { value: "crypt" } });
    fireEvent.click(screen.getByRole("button", { name: "DELETE" }));
    const prompt = confirm.mock.calls[0]?.[0] ?? "";
    expect(prompt).toContain('Delete map "Crypt"? This cannot be undone.');
    expect(prompt).toContain("can no longer be edited, and it is not kept when another map");
    expect(prompt).not.toContain("or saved"); // SAVE GAME STATE still saves it
    expect(prompt).toContain('The World location "Crypt Below" uses it');
  });

  it("DELETE of any other map says the scene the party left on it goes too", () => {
    // Use at table promised that scene "comes back"; the server deletes it
    // with its map, so the confirm has to say so.
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <MapStudioControl
        controller={library()}
        tableMapDocumentId="crypt"
        liveSceneDocumentId="crypt"
      />,
    );
    fireEvent.change(screen.getByLabelText("Saved maps"), { target: { value: "tavern" } });
    fireEvent.click(screen.getByRole("button", { name: "DELETE" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0]?.[0]).toContain(
      "If the party left a scene on this map, that saved scene",
    );
    expect(confirm.mock.calls[0]?.[0]).not.toContain("It is the map on the table");
  });

  it("deleting the picked map never leaves it (or a stale first entry) picked", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const mapStudio = library();
    render(<MapStudioControl controller={mapStudio} />);
    // The list is newest-first; the deleted map is still in it until the server replies.
    fireEvent.change(screen.getByLabelText("Saved maps"), { target: { value: "crypt" } });
    fireEvent.click(screen.getByRole("button", { name: "DELETE" }));
    expect(mapStudio.deleteDocument).toHaveBeenCalledWith("crypt");
    expect(screen.getByLabelText("Saved maps")).toHaveValue("tavern");
  });

  it("a pick that is not in the list (a refused create) has nothing to view, use or delete", () => {
    const mapStudio = library({ createDocument: vi.fn(() => "never-created") });
    render(<MapStudioControl controller={mapStudio} onUseAtTable={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "＋ Create map in library" }));
    for (const name of ["View saved map", "Use at table", "DELETE"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });

  it("View saved map never publishes or binds anything", () => {
    // A map is open and on the table, and confirm answers yes: a stray publish
    // or Use at table behind View would bake or bind, and these would see it.
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(rasterizeAndUploadMapBackground).mockClear();
    const onPublishToLiveMap = vi.fn();
    const onUseAtTable = vi.fn();
    const mapStudio = library({
      activeDocument: createMapDocument({ id: "crypt", name: "Crypt", timestamp: 1 }),
    });
    render(
      <MapStudioControl
        controller={mapStudio}
        tableMapDocumentId="crypt"
        liveSceneDocumentId="crypt"
        onPublishToLiveMap={onPublishToLiveMap}
        onUseAtTable={onUseAtTable}
      />,
    );
    fireEvent.change(screen.getByLabelText("Saved maps"), { target: { value: "tavern" } });
    fireEvent.click(screen.getByRole("button", { name: "View saved map" }));
    expect(mapStudio.openDocument).toHaveBeenCalledWith("tavern");
    expect(confirm).not.toHaveBeenCalled();
    expect(rasterizeAndUploadMapBackground).not.toHaveBeenCalled();
    expect(onPublishToLiveMap).not.toHaveBeenCalled();
    expect(mapStudio.publishDocument).not.toHaveBeenCalled();
    expect(onUseAtTable).not.toHaveBeenCalled();
  });

  it("the new-map note quotes only a real map name", () => {
    render(<MapStudioControl controller={library()} />);
    expect(
      screen.getByText(/Nothing on the table changes until you choose Use at table/),
    ).toHaveTextContent("(or Advanced → Publish map background).");
  });

  it("names exports and imports by what the file contains", () => {
    const document = createMapDocument({ id: "tavern", name: "Tavern", timestamp: 1 });
    render(<MapStudioControl controller={library({ activeDocument: document })} />);

    for (const name of [
      "Export map image (PNG)",
      "Export map image (WebP)",
      "Export map image (SVG)",
      "Export editable map (.json)",
      "Import editable map (.json)",
    ]) {
      expect(screen.getByRole("button", { name })).toBeEnabled();
    }
  });

  it("keeps the raster publish under Advanced, named for what it does", () => {
    const document = createMapDocument({ id: "tavern", name: "Tavern", timestamp: 1 });
    render(
      <MapStudioControl
        controller={library({ activeDocument: document })}
        onPublishToLiveMap={vi.fn()}
      />,
    );
    const publish = screen.getByRole("button", { name: "Publish map background" });
    expect(publish.closest("details")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "PUBLISH TO LIVE MAP" })).toBeNull();
  });

  it("a picked map stays picked while another map is open (it used to snap back)", () => {
    // The picker followed the open document on EVERY render, so with any map
    // open a DM could not pick another: the choice reverted at once, Use at
    // table read the open map, and DELETE confirmed the open map instead.
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const open = createMapDocument({ id: "crypt", name: "Crypt", timestamp: 1 });
    const mapStudio = library({ activeDocument: open });
    render(
      <MapStudioControl controller={mapStudio} tableMapDocumentId="crypt" onUseAtTable={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText("Saved maps"), { target: { value: "tavern" } });
    expect(screen.getByLabelText("Saved maps")).toHaveValue("tavern");
    expect(screen.getByRole("button", { name: "Use at table" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "View saved map" }));
    expect(mapStudio.openDocument).toHaveBeenCalledWith("tavern");
    fireEvent.click(screen.getByRole("button", { name: "DELETE" }));
    expect(confirm.mock.calls[0]?.[0]).toContain('"Tavern"');
  });

  it("follows the open document when a different one is opened", () => {
    const mapStudio = library({
      activeDocument: createMapDocument({ id: "crypt", name: "Crypt", timestamp: 1 }),
    });
    const { rerender } = render(<MapStudioControl controller={mapStudio} />);
    expect(screen.getByLabelText("Saved maps")).toHaveValue("crypt");
    rerender(
      <MapStudioControl
        controller={library({
          activeDocument: createMapDocument({ id: "tavern", name: "Tavern", timestamp: 1 }),
        })}
      />,
    );
    expect(screen.getByLabelText("Saved maps")).toHaveValue("tavern");
  });

  it("says a new map stays in the library, not on the table", () => {
    const mapStudio = library();
    render(<MapStudioControl controller={mapStudio} tableMapDocumentId="crypt" />);
    expect(screen.getByText(/The table stays on "Crypt"/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "＋ Create map in library" }));
    expect(mapStudio.createDocument).toHaveBeenCalledWith("New Battlemap", 2048, 2048);
  });

  it("warns that Use at table keeps fog OFF on a generated location's map", () => {
    // Travel here turns fog on for a generated location's first visit; Use at
    // table keeps the table's fog, which would show players the whole plan.
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const generated = {
      name: "The Rusty Tankard",
      mapDocumentId: "tavern",
      recipe: { recipeId: "tavern", seed: 7, theme: "wood", density: "medium" },
    } as never;
    const { rerender } = render(
      <MapStudioControl controller={library()} atlasNodes={[generated]} onUseAtTable={vi.fn()} />,
    );
    const ask = () => {
      fireEvent.change(screen.getByLabelText("Saved maps"), { target: { value: "tavern" } });
      fireEvent.click(screen.getByRole("button", { name: "Use at table" }));
      return String(confirm.mock.calls.at(-1)?.[0]);
    };
    expect(ask()).toContain("Fog is OFF at this table.");
    rerender(
      <MapStudioControl
        controller={library()}
        atlasNodes={[generated]}
        fogEnabled
        onUseAtTable={vi.fn()}
      />,
    );
    expect(ask()).not.toContain("Fog is OFF");
    // A hand-linked location (no recipe) has no generated first visit to lose.
    rerender(
      <MapStudioControl
        controller={library()}
        atlasNodes={[{ name: "The Rusty Tankard", mapDocumentId: "tavern" }]}
        onUseAtTable={vi.fn()}
      />,
    );
    expect(ask()).not.toContain("Fog is OFF");
  });

  it("an unbound table whose scene comes from the picked map re-attaches it, and says nothing moves", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onUseAtTable = vi.fn();
    render(
      <MapStudioControl
        controller={library()}
        liveSceneDocumentId="tavern"
        onUseAtTable={onUseAtTable}
      />,
    );
    fireEvent.change(screen.getByLabelText("Saved maps"), { target: { value: "tavern" } });
    fireEvent.click(screen.getByRole("button", { name: "Use at table" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    const prompt = String(confirm.mock.calls[0]?.[0]);
    expect(prompt).toContain("already comes from it; nothing moves");
    expect(prompt).not.toContain("saved exactly as it stands");
    expect(onUseAtTable).toHaveBeenCalledWith("tavern");
  });

  it("the viewed map's line names same-named copies apart and marks the table's map", () => {
    const copies = [
      { ...summaries[0], id: "doc-1a2b", name: "Live Map" },
      { ...summaries[1], id: "doc-9f8e", name: "Live Map" },
    ];
    const open = createMapDocument({ id: "doc-1a2b", name: "Live Map", timestamp: 1 });
    render(
      <MapStudioControl
        controller={controller({ documents: copies, activeDocument: open })}
        tableMapDocumentId="doc-1a2b"
      />,
    );
    const line = screen.getByText(/^Viewing:/);
    expect(line).toHaveTextContent("Viewing: Live Map #1a2b");
    expect(line).toHaveTextContent("· on table");
  });

  it("before the library answers, Use at table and Publish call the loss possible, not certain", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const open = createMapDocument({ id: "tavern", name: "Tavern", timestamp: 1 });
    render(
      <MapStudioControl
        controller={library({ listed: false, activeDocument: open })}
        liveSceneDocumentId="not-yet-listed"
        onUseAtTable={vi.fn()}
        onPublishToLiveMap={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Saved maps"), { target: { value: "tavern" } });
    fireEvent.click(screen.getByRole("button", { name: "Use at table" }));
    fireEvent.click(screen.getByRole("button", { name: "Publish map background" }));
    expect(confirm).toHaveBeenCalledTimes(2);
    for (const [prompt] of confirm.mock.calls) {
      expect(prompt).toContain("has not loaded yet");
      expect(prompt).not.toContain("has no saved map, so it cannot be kept");
    }
  });

  describe("same-named copies read apart in every prompt and status (round 3)", () => {
    const copy = (id: string) => ({ ...summaries[0], id, name: "Live Map" });
    const copies = [copy("doc-1a2b"), copy("doc-9f8e")];
    const open = createMapDocument({ id: "doc-9f8e", name: "Live Map", timestamp: 1 });
    const pick = () =>
      fireEvent.change(screen.getByLabelText("Saved maps"), { target: { value: "doc-9f8e" } });

    it("Use at table and DELETE", () => {
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
      render(
        <MapStudioControl
          controller={controller({ documents: copies })}
          tableMapDocumentId="doc-1a2b"
          liveSceneDocumentId="doc-1a2b"
          onUseAtTable={vi.fn()}
        />,
      );
      pick();
      fireEvent.click(screen.getByRole("button", { name: "Use at table" }));
      expect(confirm.mock.calls[0]?.[0]).toContain(
        'Put "Live Map #9f8e" on the table for everyone?',
      );
      expect(confirm.mock.calls[0]?.[0]).toContain('"Live Map #1a2b"');
      fireEvent.click(screen.getByRole("button", { name: "DELETE" }));
      expect(confirm.mock.calls[1]?.[0]).toContain('Delete map "Live Map #9f8e"?');
    });

    it("Publish map background: prompt and status", async () => {
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
      vi.mocked(rasterizeAndUploadMapBackground).mockResolvedValue(PUBLISHED_URL);
      render(
        <MapStudioControl
          controller={controller({ documents: copies, activeDocument: open })}
          liveSceneDocumentId="doc-1a2b"
          onPublishToLiveMap={() => true}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Publish map background" }));
      expect(confirm.mock.calls[0]?.[0]).toContain('Publish "Live Map #9f8e" to the table?');
      expect(confirm.mock.calls[0]?.[0]).toContain('currently on "Live Map #1a2b"');
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          'Published "Live Map #9f8e" as the table\x27s map background.',
        ),
      );
    });

    it("the import status", async () => {
      const mapStudio = controller({ documents: copies, importDocument: vi.fn(() => "doc-9f8e") });
      const { container, rerender } = render(<MapStudioControl controller={mapStudio} />);
      const text = JSON.stringify({ schemaVersion: 1, id: "orig", name: "Live Map" });
      const file = new File([text], "backup.json", { type: "application/json" });
      Object.defineProperty(file, "text", { value: () => Promise.resolve(text) });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [file] } });
      await waitFor(() => expect(mapStudio.importDocument).toHaveBeenCalled());
      rerender(
        <MapStudioControl controller={controller({ ...mapStudio, activeDocument: open })} />,
      );
      expect(screen.getByRole("status")).toHaveTextContent('Imported "Live Map #9f8e".');
    });
  });

  it("Publish warns about fog on a generated location's map — even as a bake with nothing to replace", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const tavern = createMapDocument({ id: "tavern", name: "Tavern", timestamp: 1 });
    const generated = [
      { name: "The Rusty Tankard", mapDocumentId: "tavern", recipe: { recipeId: "tavern" } },
    ] as never;
    const onPublishToLiveMap = vi.fn();
    const { rerender } = render(
      <MapStudioControl
        controller={library({ activeDocument: tavern })}
        atlasNodes={generated}
        onPublishToLiveMap={onPublishToLiveMap}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Publish map background" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0]?.[0]).toContain("Fog is OFF at this table.");
    expect(confirm.mock.calls[0]?.[0]).toContain("Publishing does not");
    expect(onPublishToLiveMap).not.toHaveBeenCalled();
    // Fog on: nothing to warn about, and a bake asks nothing.
    rerender(
      <MapStudioControl
        controller={library({ activeDocument: tavern })}
        atlasNodes={generated}
        fogEnabled
        onPublishToLiveMap={onPublishToLiveMap}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Publish map background" }));
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("an older unbound save marks the scene's own map as the one on the table", () => {
    const crypt = createMapDocument({ id: "crypt", name: "Crypt", timestamp: 1 });
    render(
      <MapStudioControl
        controller={library({ activeDocument: crypt })}
        liveSceneDocumentId="crypt"
        onUseAtTable={vi.fn()}
      />,
    );
    const options = Array.from(
      (screen.getByLabelText("Saved maps") as HTMLSelectElement).options,
    ).map((option) => option.textContent);
    expect(options.find((text) => text?.startsWith("● Crypt"))).toMatch(/on table$/);
    expect(screen.getByText(/^Viewing:/)).toHaveTextContent("· on table");
    // Putting it back on the table (re-attaching it) stays available.
    expect(screen.getByRole("button", { name: "Use at table" })).toBeEnabled();
  });

  it("each export button downloads the format it names", () => {
    const tavern = createMapDocument({ id: "tavern", name: "Tavern", timestamp: 1 });
    render(<MapStudioControl controller={library({ activeDocument: tavern })} />);
    for (const [name, format] of [
      ["Export map image (PNG)", "png"],
      ["Export map image (WebP)", "webp"],
      ["Export map image (SVG)", "svg"],
      ["Export editable map (.json)", "json"],
    ] as const) {
      fireEvent.click(screen.getByRole("button", { name }));
      expect(downloadMapDocument).toHaveBeenLastCalledWith(tavern, format);
    }
  });

  describe("Publish map background is honest about the scene it replaces", () => {
    const keep = createMapDocument({ id: "keep", name: "Keep", timestamp: 1 });
    const withKeep = () =>
      controller({ activeDocument: keep, documents: [{ id: "keep", name: "Keep" }] as never });

    it("a scene whose map was deleted is lost, never 'stays in your Map library'", () => {
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
      render(
        <MapStudioControl
          controller={withKeep()}
          liveSceneDocumentId="deleted-map"
          onPublishToLiveMap={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Publish map background" }));
      const prompt = String(confirm.mock.calls[0]?.[0]);
      expect(prompt).toContain("removed for good");
      expect(prompt).not.toContain("stays in your Map library");
      expect(prompt).not.toContain('"the current map"');
      expect(screen.getByRole("status")).toHaveTextContent(
        "Publish cancelled — the table is unchanged.",
      );
    });

    it("says so when nothing was sent (another map opened mid-bake)", async () => {
      vi.mocked(rasterizeAndUploadMapBackground).mockResolvedValue(PUBLISHED_URL);
      render(<MapStudioControl controller={withKeep()} onPublishToLiveMap={() => false} />);
      fireEvent.click(screen.getByRole("button", { name: "Publish map background" }));
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          '"Keep" was not published: the map open in the library changed while it was baking.',
        ),
      );
    });
  });
});
