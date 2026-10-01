// The Table tab through the REAL container: its reads come off the snapshot and the
// layout's props, and its sends are the container's own wiring (buildTableControls plus
// the two permission messages it sends inline). A container that dropped one — a no-op
// sender, a status it never passed on — compiles clean (eight of TableControls' fields
// may be undefined) and leaves a dead control; TableTab's own suite supplies the object
// itself, so only rendering through the container can see it.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MainLayoutProps } from "../../../layouts/props/MainLayoutProps";
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

const snapshot = {
  combatActive: false,
  players: [
    { uid: "dm", name: "The DM", isDM: true },
    { uid: "p2", name: "Bob", isDM: false },
  ],
  characters: [],
  tokens: [],
  sceneObjects: [{ id: "token:t-bob", type: "token", owner: "p2", locked: false, data: {} }],
  playerPropsEnabled: false,
} as unknown as MainLayoutProps["snapshot"];

function mountTableTab(overrides: Partial<MainLayoutProps> = {}) {
  const props = bag({ snapshot, ...overrides });
  render(
    <DMMenuContainer
      {...buildDMMenuProps(props, { initiative: initiativeSpies() })}
      launcherDock={document.body}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /DM MENU/i }));
  fireEvent.click(screen.getByRole("button", { name: "Table" }));
  return props;
}

afterEach(cleanup);

describe("DMMenuContainer — the Table tab's wiring", () => {
  it("sends each permission as its own message, with the new value", () => {
    const props = mountTableTab();
    fireEvent.click(screen.getByLabelText("Players can add props"));
    expect(props.sendMessage).toHaveBeenCalledWith({
      t: "set-player-props-enabled",
      enabled: true,
    });
    // Hand entry is ON at a table that has never turned it off; the click turns it off.
    fireEvent.click(screen.getByLabelText("Players can enter rolls by hand"));
    expect(props.sendMessage).toHaveBeenCalledWith({
      t: "set-initiative-manual-override",
      enabled: false,
    });
  });

  it("reads the permissions off the snapshot: a table that has props on shows them on, hand entry off shows off", () => {
    mountTableTab({
      snapshot: {
        ...snapshot,
        playerPropsEnabled: true,
        initiativeManualOverride: false,
      } as unknown as MainLayoutProps["snapshot"],
    });
    expect(screen.getByLabelText("Players can add props")).toBeChecked();
    expect(screen.getByLabelText("Players can enter rolls by hand")).not.toBeChecked();
  });

  it("Select All hands the layout's selector that player's uid", () => {
    const props = mountTableTab();
    fireEvent.click(screen.getAllByRole("button", { name: "Select All" })[1]!);
    expect(props.selectPlayerTokens).toHaveBeenCalledExactlyOnceWith("p2");
  });

  it("Leave DM mode goes through the layout's toggle, asking to leave", () => {
    const props = mountTableTab();
    fireEvent.click(screen.getByRole("button", { name: "Leave DM mode" }));
    expect(props.handleToggleDM).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("a password change goes to the layout's setter, trimmed, and its answer shows beside it", () => {
    const props = mountTableTab({
      roomPasswordStatus: { type: "success", message: "Table password updated." },
    });
    expect(screen.getByText("Table password updated.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("New table password"), {
      target: { value: " sunday-night " },
    });
    // Typing again dismisses the old answer, through the layout's own dismiss.
    expect(props.dismissRoomPasswordStatus).toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Confirm table password"), {
      target: { value: "sunday-night" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change table password" }));
    expect(props.handleSetRoomPassword).toHaveBeenCalledWith("sunday-night");
  });

  it("holds the password buttons while the layout says a change is pending", () => {
    mountTableTab({ roomPasswordPending: true });
    expect(screen.getByRole("button", { name: "Changing…" })).toBeDisabled();
  });
});
