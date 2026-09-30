// Encounter through the REAL container: its reads come off the snapshot and its
// sends are the container's own wiring (buildEncounterControls). A container
// that dropped a piece — the tokens on the map, the layout's camera focus, the
// initiative instance — compiles clean and leaves a dead control; only
// rendering through it shows that.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MainLayoutProps } from "../../../layouts/props/MainLayoutProps";
import type { InitiativeSetting } from "../../../hooks/useInitiativeSetting";
import { buildDMMenuProps } from "../buildDMMenuProps";
import { DMMenuContainer } from "../components/DMMenuContainer";
import { initiativeSpies } from "../../encounter/__tests__/encounterFixtures";

const bag = (overrides: Partial<MainLayoutProps>): MainLayoutProps =>
  ({
    isDM: true,
    uid: "dm",
    gridSize: 50,
    gridSquareSize: 5,
    gridLocked: false,
    camera: { x: 0, y: 0, scale: 1 },
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
    dismissRoomPasswordStatus: vi.fn(),
    selectPlayerTokens: vi.fn(),
    handleFocusToken: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
    ...overrides,
  }) as unknown as MainLayoutProps;

describe("DMMenuContainer — Encounter's wiring", () => {
  it("🎯 shows for a token on the map and centres the layout's camera on it; Roll goes through the layout's instance", () => {
    const initiative: InitiativeSetting = initiativeSpies();
    const props = bag({
      snapshot: {
        combatActive: false,
        players: [{ uid: "dm", name: "The DM", isDM: true }],
        characters: [
          { id: "gob", name: "Goblin", type: "npc", hp: 7, maxHp: 7, tokenId: "t-gob" },
          { id: "rat", name: "Rat", type: "npc", hp: 2, maxHp: 2, tokenId: "t-gone" },
        ],
        tokens: [{ id: "t-gob", x: 1, y: 1, owner: "dm", color: "red" }],
      } as unknown as MainLayoutProps["snapshot"],
    });
    render(
      <DMMenuContainer {...buildDMMenuProps(props, { initiative })} launcherDock={document.body} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /DM MENU/i }));
    fireEvent.click(screen.getByRole("button", { name: "Encounter" }));

    // The Rat's token is on another map (not in this frame's tokens): no 🎯.
    expect(screen.queryByRole("button", { name: "Focus Rat" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Focus Goblin" }));
    expect(props.handleFocusToken).toHaveBeenCalledWith("t-gob");

    fireEvent.click(screen.getByRole("button", { name: "Roll d20 now for Goblin" }));
    expect(initiative.rollInitiative).toHaveBeenCalledWith("gob");
  });
});
