// The DM menu's Table tab (U9): five headed sections and the role, composed from
// the controls the Session and Players tabs held. These use the REAL controls —
// the SessionTab characterization this replaces mocked every child, so it could
// only say a prop was handed down, never that the control a DM sees does its job.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Player } from "@herobyte/shared";
import TableTab from "../TableTab";
import type { TableControls } from "../tableControls";

const player = (uid: string, name: string): Player => ({ uid, name, isDM: false }) as Player;

function makeControls(overrides: Partial<TableControls> = {}): TableControls {
  return {
    onToggleDM: vi.fn(),
    tableName: "Sunday Game",
    isPublicTable: false,
    players: [player("p1", "Alice"), player("p2", "Bob")],
    sceneObjects: [],
    characters: [],
    connectedUids: ["p1", "p2"],
    onSelectPlayerTokens: vi.fn(),
    onRemovePlayer: vi.fn(),
    playerPropsEnabled: false,
    onPlayerPropsEnabledChange: vi.fn(),
    initiativeManualOverride: true,
    onInitiativeManualOverrideChange: vi.fn(),
    onRequestSaveSession: vi.fn(),
    onRequestLoadSession: vi.fn(),
    onSetRoomPassword: vi.fn(),
    roomPasswordStatus: null,
    roomPasswordPending: false,
    onDismissRoomPasswordStatus: vi.fn(),
    onSaveAsPrivateTable: undefined,
    ...overrides,
  };
}

function renderTab(overrides: Partial<TableControls> = {}, tab: { name?: string } = {}) {
  const controls = makeControls(overrides);
  const setSessionName = vi.fn();
  const utils = render(
    <TableTab
      controls={controls}
      sessionName={tab.name ?? "table-backup"}
      setSessionName={setSessionName}
    />,
  );
  return { controls, setSessionName, ...utils };
}

const section = (name: string) => screen.getByRole("region", { name });

beforeEach(() => {
  window.history.replaceState(null, "", "/?room=table-abc123");
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("TableTab — sections", () => {
  it("has the plan's five sections, in order, after your role", () => {
    renderTab();
    const headings = screen
      .getAllByRole("heading", { level: 4 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Your role",
      "Invite",
      "Players at this table",
      "Permissions",
      "Backups",
      "Security",
    ]);
  });

  it("holds no combat and no NPC controls: combat is Encounter's and NPCs are NPCs & Monsters'", () => {
    renderTab();
    expect(screen.queryByRole("button", { name: /combat|initiative|npc|monster/i })).toBeNull();
  });

  it("carries none of the old names for what it replaced", () => {
    renderTab();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/Game State/);
    expect(text).not.toMatch(/Session Save\/Load/);
    expect(text).not.toMatch(/Player State/);
  });
});

describe("TableTab — role", () => {
  it("tells the DM they are the DM and Leave DM mode asks to step down", () => {
    const { controls } = renderTab();
    const role = within(section("Your role"));
    expect(role.getByText("You are the Dungeon Master.")).toBeInTheDocument();
    fireEvent.click(role.getByRole("button", { name: "Leave DM mode" }));
    expect(controls.onToggleDM).toHaveBeenCalledExactlyOnceWith(false);
  });
});

describe("TableTab — Invite", () => {
  it("names the table by the snapshot's name with its code, and shows the link", () => {
    renderTab();
    const invite = within(section("Invite"));
    expect(invite.getByText("Sunday Game (table-abc123)")).toBeInTheDocument();
    expect(invite.getByText(/room=table-abc123/)).toBeInTheDocument();
  });

  it("copies the link and says it never carries the password", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderTab();
    const invite = within(section("Invite"));
    fireEvent.click(invite.getByRole("button", { name: "Copy invite link" }));
    expect(await invite.findByRole("button", { name: "✓ Copied" })).toBeInTheDocument();
    expect(writeText.mock.calls[0]![0]).toContain("room=table-abc123");
    expect(invite.getByText(/never carries the password/i)).toBeInTheDocument();
  });
});

describe("TableTab — Players at this table", () => {
  it("lists every player", () => {
    renderTab();
    const players = within(section("Players at this table"));
    expect(players.getByText("Alice")).toBeInTheDocument();
    expect(players.getByText("Bob")).toBeInTheDocument();
  });

  it("selects a player's tokens by uid, through an enabled Select All", () => {
    // A row with no tokens has its Select All disabled, so a click there proves nothing
    // (the first version asserted "not called" on one). Give Bob a token of his own.
    const { controls } = renderTab({
      sceneObjects: [
        {
          id: "token:t-bob",
          type: "token",
          owner: "p2",
          locked: false,
          data: {},
        } as unknown as TableControls["sceneObjects"][number],
      ],
    });
    const players = within(section("Players at this table"));
    const buttons = players.getAllByRole("button", { name: "Select All" });
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).toBeEnabled();
    fireEvent.click(buttons[1]!);
    expect(controls.onSelectPlayerTokens).toHaveBeenCalledExactlyOnceWith("p2");
  });

  it("offers Remove only for a seat outside the connected roster", () => {
    renderTab({ connectedUids: ["p1"] });
    const players = within(section("Players at this table"));
    expect(players.getAllByRole("button", { name: "Remove" })).toHaveLength(1);
  });
});

describe("TableTab — Permissions as the table has them", () => {
  it("shows hand-entered rolls OFF when the table has turned them off (not just the default ON)", () => {
    // The fixture's default equals the section's own default, so a tab that dropped this
    // value would still look right: only a false can tell.
    renderTab({ initiativeManualOverride: false });
    expect(
      within(section("Permissions")).getByLabelText("Players can enter rolls by hand"),
    ).not.toBeChecked();
  });

  it("shows props ON when the table has them on", () => {
    renderTab({ playerPropsEnabled: true });
    expect(within(section("Permissions")).getByLabelText("Players can add props")).toBeChecked();
  });
});

describe("TableTab — Permissions", () => {
  it("reports each new value when a DM changes a permission", () => {
    const { controls } = renderTab();
    const permissions = within(section("Permissions"));
    fireEvent.click(permissions.getByLabelText("Players can add props"));
    expect(controls.onPlayerPropsEnabledChange).toHaveBeenCalledExactlyOnceWith(true);
    fireEvent.click(permissions.getByLabelText("Players can enter rolls by hand"));
    expect(controls.onInitiativeManualOverrideChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("shows the two defaults as they are: props off, hand-entered rolls on", () => {
    renderTab();
    const permissions = within(section("Permissions"));
    expect(permissions.getByLabelText("Players can add props")).not.toBeChecked();
    expect(permissions.getByLabelText("Players can enter rolls by hand")).toBeChecked();
  });
});

describe("TableTab — Backups", () => {
  it("names the scope on each button before a file is chosen", () => {
    renderTab();
    const backups = within(section("Backups"));
    expect(backups.getByRole("button", { name: "Download table backup" })).toBeEnabled();
    expect(backups.getByRole("button", { name: "Restore table backup…" })).toBeEnabled();
    expect(backups.getByText(/whole table/i, { selector: "span" })).toBeInTheDocument();
  });

  it("explains automatic saving separately from the file backup", () => {
    renderTab();
    const backups = within(section("Backups"));
    expect(
      backups.getByText(/keeps this table saved between visits on its own/i),
    ).toBeInTheDocument();
    // ...and on the public test table, where that would be false, says so instead.
    cleanup();
    renderTab({ isPublicTable: true });
    const publicBackups = within(section("Backups"));
    expect(publicBackups.queryByText(/saved between visits on its own/i)).toBeNull();
    expect(
      publicBackups.getByText(
        /By default this public test table clears once it has sat empty for an hour/,
      ),
    ).toBeInTheDocument();
  });

  it("says what restoring replaces and what it keeps, and that it cannot be undone", () => {
    renderTab();
    expect(
      within(section("Backups")).getByText(
        /replaces the map, NPCs, props and drawings for everyone connected/i,
      ),
    ).toBeInTheDocument();
    expect(
      within(section("Backups")).getByText(
        /everyone with a seat here keeps their characters and tokens/i,
      ),
    ).toBeInTheDocument();
    expect(within(section("Backups")).getByText(/nobody.s DM status changes/i)).toBeInTheDocument();
    expect(within(section("Backups")).getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it("points at the other two files by name, so a character or a map is not sought here", () => {
    renderTab();
    const note = within(section("Backups")).getByText(/Save character/);
    expect(note).toHaveTextContent(/Export editable map/);
  });

  it("downloads under the typed file name, or a default when it is blank", () => {
    const { controls } = renderTab({}, { name: "  Friday  " });
    fireEvent.click(screen.getByRole("button", { name: "Download table backup" }));
    expect(controls.onRequestSaveSession).toHaveBeenLastCalledWith("Friday");
    cleanup();
    const blank = renderTab({}, { name: "   " });
    fireEvent.click(screen.getByRole("button", { name: "Download table backup" }));
    expect(blank.controls.onRequestSaveSession).toHaveBeenLastCalledWith("table-backup");
  });

  it("edits the file name through the menu's state, so it survives a tab switch", () => {
    const { setSessionName } = renderTab();
    fireEvent.change(screen.getByLabelText("Backup file name"), { target: { value: "Saturday" } });
    expect(setSessionName).toHaveBeenCalledExactlyOnceWith("Saturday");
  });

  it("cannot download before there is a table to download", () => {
    renderTab({ onRequestSaveSession: undefined });
    expect(screen.getByRole("button", { name: "Download table backup" })).toBeDisabled();
  });

  it("hands the chosen file to Restore, and resets the picker so the same file can be chosen again", () => {
    const { controls } = renderTab();
    const input = screen.getByLabelText(
      "Choose a table backup file to restore",
    ) as HTMLInputElement;
    // jsdom always reads a file input's value as "" (a plain `expect(input.value).toBe("")`
    // passes with the reset deleted), so the ASSIGNMENT the component makes is what is seen.
    const assigned: string[] = [];
    Object.defineProperty(input, "value", {
      configurable: true,
      get: () => "C:\\fakepath\\backup.json",
      set: (next: string) => {
        assigned.push(next);
      },
    });
    const file = new File(["{}"], "backup.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(controls.onRequestLoadSession).toHaveBeenCalledExactlyOnceWith(file);
    expect(assigned).toEqual([""]);
  });
});

describe("TableTab — Security answers", () => {
  it("shows the server's answer to a password change, and dismisses it as the DM starts typing again", () => {
    const { controls } = renderTab({
      roomPasswordStatus: { type: "success", message: "Table password updated." },
    });
    const security = within(section("Security"));
    expect(security.getByText("Table password updated.")).toBeInTheDocument();
    fireEvent.change(security.getByLabelText("New table password"), {
      target: { value: "sunday-night" },
    });
    expect(controls.onDismissRoomPasswordStatus).toHaveBeenCalled();
  });

  it("shows a refusal in the same place", () => {
    renderTab({ roomPasswordStatus: { type: "error", message: "Could not change it." } });
    expect(within(section("Security")).getByText("Could not change it.")).toBeInTheDocument();
  });

  it("holds both password buttons while a change is pending", () => {
    renderTab({ roomPasswordPending: true });
    const security = within(section("Security"));
    expect(security.getByRole("button", { name: "Changing…" })).toBeDisabled();
    expect(security.getByRole("button", { name: "Reset to default" })).toBeDisabled();
  });
});

describe("TableTab — Security", () => {
  it("offers a private table its password, and nothing about a fixed one", () => {
    renderTab();
    const security = within(section("Security"));
    expect(security.getByRole("button", { name: "Change table password" })).toBeInTheDocument();
    expect(security.queryByText(/Save as a Private Table/i)).toBeNull();
  });

  it("offers the public table a private copy instead, since its password is fixed", () => {
    renderTab({ onSaveAsPrivateTable: vi.fn().mockResolvedValue(undefined) });
    const security = within(section("Security"));
    expect(security.getByText("Save as a Private Table")).toBeInTheDocument();
    expect(security.queryByRole("button", { name: "Change table password" })).toBeNull();
    // Fixed, not "open for everyone": the host can set the Main Hall's passwords.
    expect(
      security.getByText(
        /its passwords are fixed \(the server's settings\), and by default it is wiped once it has sat empty for an hour/,
      ),
    ).toBeInTheDocument();
    expect(security.queryByText(/stays open for everyone|an hour by default/)).toBeNull();
  });

  it("names what Reset to default does", () => {
    renderTab();
    expect(
      within(section("Security")).getByText(
        /Main Hall.s password: anyone with its code and that password can join/i,
      ),
    ).toBeInTheDocument();
  });

  it("changes the password after validating it, and never sends a short one", () => {
    const { controls } = renderTab();
    const security = within(section("Security"));
    fireEvent.change(security.getByLabelText("New table password"), { target: { value: "abc" } });
    fireEvent.change(security.getByLabelText("Confirm table password"), {
      target: { value: "abc" },
    });
    fireEvent.click(security.getByRole("button", { name: "Change table password" }));
    expect(controls.onSetRoomPassword).not.toHaveBeenCalled();
    expect(security.getByText("Password must be at least 6 characters.")).toBeInTheDocument();

    fireEvent.change(security.getByLabelText("New table password"), {
      target: { value: "longenough" },
    });
    fireEvent.change(security.getByLabelText("Confirm table password"), {
      target: { value: "longenough" },
    });
    fireEvent.click(security.getByRole("button", { name: "Change table password" }));
    expect(controls.onSetRoomPassword).toHaveBeenCalledExactlyOnceWith("longenough");
  });
});
