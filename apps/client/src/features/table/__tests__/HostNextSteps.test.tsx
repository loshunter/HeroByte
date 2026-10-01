import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HostNextSteps } from "../HostNextSteps";
import type { TableMenuProps } from "../tableMenuProps";
import { clearNewTable, markNewTable, readNewTable, seatClaimed } from "../newTableMarker";

const ROOM = "table-abc123";

const menuProps = (overrides: Partial<TableMenuProps> = {}): TableMenuProps => ({
  uid: "uid-1",
  tableName: "Sunday Game",
  isPublicTable: false,
  isConnected: true,
  isDM: false,
  roleKnown: true,
  onToggleDM: vi.fn(),
  crtFilter: false,
  onCrtFilterChange: vi.fn(),
  ...overrides,
});

const writeText = vi.fn();

beforeEach(() => {
  window.history.replaceState(null, "", `/?room=${ROOM}`);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("HostNextSteps — the two things to do after creating a table", () => {
  it("shows nothing to someone this tab did not create the table for", () => {
    render(<HostNextSteps menu={menuProps()} />);
    expect(screen.queryByRole("region", { name: "Next steps for the host" })).toBeNull();
  });

  it("names both steps once this tab has made the table", () => {
    markNewTable(ROOM);
    render(<HostNextSteps menu={menuProps()} />);
    const card = screen.getByRole("region", { name: "Next steps for the host" });
    expect(card).toHaveTextContent(/next steps/i);
    expect(screen.getByRole("button", { name: "Enter DM mode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invite players" })).toBeInTheDocument();
  });

  it("Enter DM mode only opens the password dialog; it never elevates by itself", () => {
    markNewTable(ROOM);
    const onToggleDM = vi.fn();
    render(<HostNextSteps menu={menuProps({ onToggleDM })} />);
    fireEvent.click(screen.getByRole("button", { name: "Enter DM mode" }));
    // The app's ONE launcher: it opens DMElevationModal, where the DM password
    // (or, for a table made without one, setting it) is still the gate.
    expect(onToggleDM).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("marks the first step done for a host who is already the DM", () => {
    markNewTable(ROOM);
    render(<HostNextSteps menu={menuProps({ isDM: true })} />);
    expect(screen.getByText("✓ You are the DM.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enter DM mode" })).toBeNull();
  });

  it("holds Invite players until the host is the DM, and says why", () => {
    // A table made without a DM password goes to whoever enters DM mode FIRST (the
    // bootstrap dialog sets the password and promotes them). The invitation must not
    // go out before the host has claimed the seat.
    markNewTable(ROOM);
    const { rerender } = render(<HostNextSteps menu={menuProps()} />);
    const invite = screen.getByRole("button", { name: "Invite players" });
    expect(invite).toBeDisabled();
    expect(screen.getByRole("region", { name: "Next steps for the host" })).toHaveTextContent(
      /enter dm mode first/i,
    );
    fireEvent.click(invite);
    expect(writeText).not.toHaveBeenCalled();
    rerender(<HostNextSteps menu={menuProps({ isDM: true })} />);
    expect(screen.getByRole("button", { name: "Invite players" })).toBeEnabled();
  });

  it("keeps Invite once the host has held the seat: leaving DM mode does not lock it again", () => {
    // "Whoever enters DM mode first becomes its DM" is about the seat being UNCLAIMED. Once the
    // host has held it, the note would be false, and a greyed button a reason to think the
    // link had stopped working.
    markNewTable(ROOM);
    const { rerender } = render(<HostNextSteps menu={menuProps({ isDM: true })} />);
    expect(seatClaimed(ROOM)).toBe(true);

    rerender(<HostNextSteps menu={menuProps({ isDM: false })} />);
    expect(screen.getByRole("button", { name: "Invite players" })).toBeEnabled();
    // The first step is offered again — they can re-enter — but the invitation is not held.
    expect(screen.getByRole("button", { name: "Enter DM mode" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Next steps for the host" })).not.toHaveTextContent(
      /enter dm mode first/i,
    );
  });

  it("remembers the claim across a reload of the tab", () => {
    markNewTable(ROOM);
    const first = render(<HostNextSteps menu={menuProps({ isDM: true })} />);
    first.unmount();
    render(<HostNextSteps menu={menuProps({ isDM: false })} />);
    expect(screen.getByRole("button", { name: "Invite players" })).toBeEnabled();
  });

  it("does not take a blip for a claim, or a claim for a roster that is not back", () => {
    markNewTable(ROOM);
    render(<HostNextSteps menu={menuProps({ isDM: false, roleKnown: false })} />);
    expect(seatClaimed(ROOM)).toBe(false);
  });

  it("stores a claim only once the roster has said so, whatever the flag reads", () => {
    // `isDM` is derived from the roster, so a DM flag without a known roster cannot happen
    // today: this pair is the guard's own case, so a role the page cannot know never becomes a
    // stored claim if that ever changes — and the claim is still made the moment it is known.
    markNewTable(ROOM);
    const { rerender } = render(
      <HostNextSteps menu={menuProps({ isDM: true, roleKnown: false })} />,
    );
    expect(seatClaimed(ROOM)).toBe(false);

    rerender(<HostNextSteps menu={menuProps({ isDM: true, roleKnown: true })} />);

    expect(seatClaimed(ROOM)).toBe(true);
  });

  it("says Enter DM mode may ask to set the password, for a table that has none", () => {
    markNewTable(ROOM);
    render(<HostNextSteps menu={menuProps()} />);
    expect(screen.getByRole("region", { name: "Next steps for the host" })).toHaveTextContent(
      /or to set one, if this table has none/i,
    );
  });

  it("Invite players copies this table's link, and says the password is sent separately", async () => {
    markNewTable(ROOM);
    render(<HostNextSteps menu={menuProps({ isDM: true })} />);
    fireEvent.click(screen.getByRole("button", { name: "Invite players" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0]![0]).toContain(`room=${ROOM}`);
    expect(await screen.findByText(/send the table password separately/i)).toBeInTheDocument();
  });

  it("falls back to showing the link for a manual copy when the clipboard is refused", async () => {
    markNewTable(ROOM);
    writeText.mockRejectedValue(new Error("not allowed"));
    render(<HostNextSteps menu={menuProps({ isDM: true })} />);
    fireEvent.click(screen.getByRole("button", { name: "Invite players" }));
    const manual = (await screen.findByLabelText(
      "Invite link — copy this manually",
    )) as HTMLInputElement;
    expect(manual.value).toContain(`room=${ROOM}`);
  });

  it("Dismiss clears the marker, so a reload does not bring it back", () => {
    markNewTable(ROOM);
    render(<HostNextSteps menu={menuProps()} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss next steps" }));
    expect(screen.queryByRole("region", { name: "Next steps for the host" })).toBeNull();
    expect(readNewTable(ROOM)).toBe(false);
  });

  it("waits for the roster: nothing is offered on a reconnect's empty snapshot", () => {
    markNewTable(ROOM);
    const { rerender } = render(<HostNextSteps menu={menuProps({ roleKnown: false })} />);
    expect(screen.queryByRole("region", { name: "Next steps for the host" })).toBeNull();
    // Not dismissed, merely not yet: it returns with the roster.
    rerender(<HostNextSteps menu={menuProps()} />);
    expect(screen.getByRole("region", { name: "Next steps for the host" })).toBeInTheDocument();
  });

  it("parks itself below the header on desktop, taking no taps outside its own buttons", () => {
    markNewTable(ROOM);
    render(<HostNextSteps menu={menuProps()} placement={{ top: 120 }} />);
    const dock = screen
      .getByRole("region", { name: "Next steps for the host" })
      .closest(".host-steps-dock") as HTMLElement;
    expect(dock.style.position).toBe("fixed");
    expect(dock.style.top).toBe("120px");
    expect(dock.style.pointerEvents).toBe("none");
  });

  it("is per table: a marker for some other table shows nothing here", () => {
    markNewTable("table-other");
    render(<HostNextSteps menu={menuProps()} />);
    expect(screen.queryByRole("region", { name: "Next steps for the host" })).toBeNull();
    clearNewTable("table-other");
  });
});
