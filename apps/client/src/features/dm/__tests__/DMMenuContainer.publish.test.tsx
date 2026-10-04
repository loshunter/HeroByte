/**
 * PUBLISH TO LIVE MAP knows which map is live — through the REAL container.
 *
 * `liveSceneDocumentId` rides bag.snapshot → DMMenuContainer (derives it) →
 * DMMenu → MapTab → MapStudioControl. Every hop is an OPTIONAL prop, so
 * deleting any forwarding line compiles, passes every other suite, and
 * silently turns the confirm back into the 2026-09-08 blank table: the
 * Studio publishes the map the DM LEFT, and nothing asks. Both layout suites
 * stub the lazy DM chunk, so neither can see this chain — this renders it.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createMapDocument } from "@herobyte/shared";
import type { MainLayoutProps } from "../../../layouts/props/MainLayoutProps";
import { buildDMMenuProps } from "../buildDMMenuProps";
import type { InitiativeSetting } from "../../../hooks/useInitiativeSetting";
import { DMMenuContainer } from "../components/DMMenuContainer";

// The same bag shape buildDMMenuProps.test.ts builds — the container's whole
// prop surface comes from this one mapping.
const createBag = (overrides: Partial<MainLayoutProps> = {}): MainLayoutProps =>
  ({
    isDM: true,
    gridSize: 50,
    gridSquareSize: 5,
    gridLocked: false,
    camera: { x: 1, y: 2, scale: 3 },
    snapshot: null,
    mapSceneObject: null,
    stagingZoneSceneObject: null,
    alignmentMode: false,
    alignmentPoints: [],
    alignmentSuggestion: null,
    alignmentError: null,
    roomPasswordStatus: null,
    roomPasswordPending: false,
    handleToggleDM: vi.fn(),
    setGridLocked: vi.fn(),
    setGridSize: vi.fn(),
    setGridSquareSize: vi.fn(),
    sendMessage: vi.fn(),
    handleClearDrawings: vi.fn(),
    setMapBackgroundURL: vi.fn(),
    toggleSceneObjectLock: vi.fn(),
    transformSceneObject: vi.fn(),
    playerActions: { setPlayerStagingZone: vi.fn() } as unknown as MainLayoutProps["playerActions"],
    handleAlignmentStart: vi.fn(),
    handleAlignmentReset: vi.fn(),
    handleAlignmentCancel: vi.fn(),
    handleAlignmentApply: vi.fn(),
    handleSetRoomPassword: vi.fn(),
    onSaveAsPrivateTable: vi.fn(),
    dismissRoomPasswordStatus: vi.fn(),
    selectPlayerTokens: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
    ...overrides,
  }) as unknown as MainLayoutProps;

describe("DMMenuContainer — publish knows the live map", () => {
  it("asks before publishing the map the DM left, naming the one the table is on", async () => {
    const keep = createMapDocument({ id: "keep", name: "Keep", timestamp: 1 });
    const dungeon = createMapDocument({ id: "dungeon", name: "Repro Dungeon", timestamp: 1 });
    const publishDocument = vi.fn(() => true);
    const bag = createBag({
      snapshot: {
        combatActive: false,
        compiledScene: { sourceDocumentId: "dungeon" },
      } as unknown as MainLayoutProps["snapshot"],
      mapStudio: {
        documents: [keep, dungeon],
        activeDocument: keep, // the Studio is still on the map the DM LEFT
        loading: false,
        saving: false,
        error: null,
        missingDocumentId: null,
        exportBytes: null,
        canUndo: false,
        canRedo: false,
        refresh: vi.fn(),
        createDocument: vi.fn(),
        openDocument: vi.fn(),
        deleteDocument: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        uploadAsset: vi.fn(),
        importDocument: vi.fn(),
        publishDocument,
      } as unknown as MainLayoutProps["mapStudio"],
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <DMMenuContainer
        {...buildDMMenuProps(bag, { initiative: {} as InitiativeSetting })}
        launcherDock={document.body}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /DM MENU/i }));
    fireEvent.click(screen.getByRole("button", { name: "Maps" }));
    fireEvent.click(await screen.findByRole("button", { name: "Publish map background" }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0]?.[0]).toContain('"Repro Dungeon"');
    // Declined — the guard ran BEFORE the bake, so nothing was published.
    expect(publishDocument).not.toHaveBeenCalled();
  });

  it("Use at table reaches the table through the one existing set-live message", async () => {
    // U6: the Maps tab names the table map from the room binding and binds a
    // library map only on an explicit, confirmed action. Every hop here is an
    // optional prop, so this renders the real chain rather than trusting it.
    const crypt = createMapDocument({ id: "crypt", name: "Crypt", timestamp: 1 });
    const tavern = createMapDocument({ id: "tavern", name: "Tavern", timestamp: 1 });
    const sendMessage = vi.fn();
    const bag = createBag({
      sendMessage,
      snapshot: {
        combatActive: false,
        liveMapDocumentId: "crypt",
        compiledScene: { sourceDocumentId: "crypt" },
        // A World location on the picked map: its note must survive every hop.
        atlasNodes: [
          {
            id: "n-tavern",
            kind: "building",
            name: "The Rusty Tankard",
            discovered: true,
            mapDocumentId: "tavern",
          },
        ],
      } as unknown as MainLayoutProps["snapshot"],
      mapStudio: {
        documents: [crypt, tavern],
        activeDocument: tavern,
        loading: false,
        saving: false,
        error: null,
        exportBytes: null,
        canUndo: false,
        canRedo: false,
        refresh: vi.fn(),
        openDocument: vi.fn(),
        uploadAsset: vi.fn(),
        importDocument: vi.fn(),
        publishDocument: vi.fn(),
      } as unknown as MainLayoutProps["mapStudio"],
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <DMMenuContainer
        {...buildDMMenuProps(bag, { initiative: {} as InitiativeSetting })}
        launcherDock={document.body}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /DM MENU/i }));
    fireEvent.click(screen.getByRole("button", { name: "Maps" }));

    expect(screen.getByText(/^On table:/)).toHaveTextContent("On table: Crypt");
    expect(screen.getByText(/^Viewing in library:/)).toHaveTextContent(
      "Viewing in library: Tavern",
    );
    fireEvent.click(screen.getByRole("button", { name: "Use at table" }));
    const mapMessages = sendMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => String(message.t).startsWith("map-studio-"));
    expect(mapMessages).toEqual([{ t: "map-studio-set-live", documentId: "tavern" }]);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0]?.[0]).toContain('the World location "The Rusty Tankard"');
  });

  it("World learns the table's scene and background through the real chain", () => {
    // hasCompiledScene and hasBackground ride optional props from the
    // container to the World tab: a scene that is not a location, and a
    // background-only table whose pieces travel with the party.
    const tavern = createMapDocument({ id: "tavern", name: "Tavern", timestamp: 1 });
    const studio = {
      documents: [tavern],
      activeDocument: null,
      loading: false,
      saving: false,
      error: null,
      missingDocumentId: null,
      listed: true,
      exportBytes: null,
      canUndo: false,
      canRedo: false,
      refresh: vi.fn(),
      openDocument: vi.fn(),
      uploadAsset: vi.fn(),
      importDocument: vi.fn(),
      publishDocument: vi.fn(),
    } as unknown as MainLayoutProps["mapStudio"];
    const nodes = [
      {
        id: "n-tavern",
        kind: "building",
        name: "Tavern",
        discovered: true,
        mapDocumentId: "tavern",
      },
    ];
    const open = (snapshot: object) => {
      const bag = createBag({
        snapshot: {
          combatActive: false,
          atlasNodes: nodes,
          ...snapshot,
        } as unknown as MainLayoutProps["snapshot"],
        mapStudio: studio,
      });
      const view = render(
        <DMMenuContainer
          {...buildDMMenuProps(bag, { initiative: {} as InitiativeSetting })}
          launcherDock={document.body}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /DM MENU/i }));
      fireEvent.click(screen.getByRole("button", { name: "World" }));
      return view;
    };

    const first = open({ compiledScene: { sourceDocumentId: "keep-map" } });
    expect(screen.getByText(/^Party is at:/)).toHaveTextContent(
      "Party is at: a map that is not a World location",
    );
    first.unmount();

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    open({ mapBackground: "https://example.test/town.png" });
    fireEvent.click(screen.getByRole("button", { name: "🚩 Travel here" }));
    expect(confirm.mock.calls[0]?.[0]).toContain(
      "its background image, NPCs, props and drawings stay",
    );
  });

  it("World's Travel here learns the scene's fate through the real chain", () => {
    // The scene's map was deleted: Travel here must warn, not promise to
    // suspend it. The scene id, the library and the background each ride an
    // optional prop from the container to the row.
    const crypt = createMapDocument({ id: "crypt", name: "Crypt", timestamp: 1 });
    const bag = createBag({
      snapshot: {
        combatActive: false,
        compiledScene: { sourceDocumentId: "deleted-map" },
        atlasNodes: [
          { id: "n-here", kind: "dungeon", name: "Here", discovered: true },
          {
            id: "n-crypt",
            kind: "dungeon",
            name: "Crypt Below",
            discovered: true,
            mapDocumentId: "crypt",
          },
        ],
      } as unknown as MainLayoutProps["snapshot"],
      mapStudio: {
        documents: [crypt],
        activeDocument: null,
        loading: false,
        saving: false,
        error: null,
        missingDocumentId: null,
        exportBytes: null,
        canUndo: false,
        canRedo: false,
        refresh: vi.fn(),
        openDocument: vi.fn(),
        uploadAsset: vi.fn(),
        importDocument: vi.fn(),
        publishDocument: vi.fn(),
      } as unknown as MainLayoutProps["mapStudio"],
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <DMMenuContainer
        {...buildDMMenuProps(bag, { initiative: {} as InitiativeSetting })}
        launcherDock={document.body}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /DM MENU/i }));
    fireEvent.click(screen.getByRole("button", { name: "World" }));
    fireEvent.click(screen.getByRole("button", { name: "🚩 Travel here" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0]?.[0]).toContain("removed for good");
    expect(confirm.mock.calls[0]?.[0]).not.toContain("suspended exactly");
  });

  it("names the scene, not a stale binding, when the table's map is gone", () => {
    // Deleting the table's map clears the binding while the scene keeps playing:
    // the two ids part, and the tab must say so rather than name a dead map.
    const crypt = createMapDocument({ id: "crypt", name: "Crypt", timestamp: 1 });
    const bag = createBag({
      snapshot: {
        combatActive: false,
        compiledScene: { sourceDocumentId: "deleted-map" },
      } as unknown as MainLayoutProps["snapshot"],
      mapStudio: {
        documents: [crypt],
        activeDocument: null,
        loading: false,
        saving: false,
        error: null,
        exportBytes: null,
        canUndo: false,
        canRedo: false,
        refresh: vi.fn(),
        openDocument: vi.fn(),
        uploadAsset: vi.fn(),
        importDocument: vi.fn(),
        publishDocument: vi.fn(),
      } as unknown as MainLayoutProps["mapStudio"],
    });
    render(
      <DMMenuContainer
        {...buildDMMenuProps(bag, { initiative: {} as InitiativeSetting })}
        launcherDock={document.body}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /DM MENU/i }));
    fireEvent.click(screen.getByRole("button", { name: "Maps" }));
    expect(screen.getByText(/^On table:/)).toHaveTextContent(
      "On table: a scene with no editable map",
    );
  });
});
