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

    render(<DMMenuContainer {...buildDMMenuProps(bag, { rollAllInitiative: vi.fn() })} />);
    fireEvent.click(screen.getByRole("button", { name: /DM MENU/i }));
    fireEvent.click(screen.getByRole("button", { name: "Map Setup" }));
    fireEvent.click(await screen.findByRole("button", { name: "PUBLISH TO LIVE MAP" }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0]?.[0]).toContain('"Repro Dungeon"');
    // Declined — the guard ran BEFORE the bake, so nothing was published.
    expect(publishDocument).not.toHaveBeenCalled();
  });
});
