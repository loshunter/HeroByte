import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TableRoleControl } from "../TableRoleControl";

afterEach(cleanup);

describe("TableRoleControl — your role at the table, and the way to change it", () => {
  it("offers a player Enter DM mode, which asks to become the DM and does nothing else", () => {
    const onToggleDM = vi.fn();
    render(<TableRoleControl isDM={false} roleKnown onToggleDM={onToggleDM} />);

    expect(screen.getByText("You are a player.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enter DM mode" }));
    expect(onToggleDM).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.queryByRole("button", { name: "Leave DM mode" })).toBeNull();
  });

  it("offers a DM Leave DM mode, without the danger styling of a deletion", () => {
    const onToggleDM = vi.fn();
    render(<TableRoleControl isDM roleKnown onToggleDM={onToggleDM} />);

    expect(screen.getByText("You are the Dungeon Master.")).toBeInTheDocument();
    const leave = screen.getByRole("button", { name: "Leave DM mode" });
    expect(leave.className).not.toMatch(/danger/);
    fireEvent.click(leave);
    expect(onToggleDM).toHaveBeenCalledExactlyOnceWith(false);
    expect(screen.queryByRole("button", { name: "Enter DM mode" })).toBeNull();
  });

  it("says you keep your character when leaving, and that the password brings the tools back", () => {
    render(<TableRoleControl isDM roleKnown onToggleDM={vi.fn()} />);
    expect(screen.getByText(/keep your character/i)).toBeInTheDocument();
    expect(screen.getByText(/password brings them back/i)).toBeInTheDocument();
  });

  it("waits for the roster rather than judging the role: a reconnect reads every DM as a player", () => {
    // Every socket close nulls the snapshot while the app stays mounted; for that
    // blip the derived role is false. Whatever isDM says then, the control must not
    // offer the button that judgement implies.
    const onToggleDM = vi.fn();
    const { rerender } = render(
      <TableRoleControl isDM={false} roleKnown={false} onToggleDM={onToggleDM} />,
    );
    expect(screen.getByText("Reconnecting…")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Enter DM mode" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onToggleDM).not.toHaveBeenCalled();
    expect(screen.queryByText("You are a player.")).toBeNull();

    // ...and the same for an isDM the snapshot would have read as true.
    rerender(<TableRoleControl isDM roleKnown={false} onToggleDM={onToggleDM} />);
    expect(screen.getByText("Reconnecting…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Leave DM mode" })).toBeNull();

    // The roster returns: the control speaks again.
    rerender(<TableRoleControl isDM roleKnown onToggleDM={onToggleDM} />);
    expect(screen.getByRole("button", { name: "Leave DM mode" })).toBeEnabled();
  });
});
