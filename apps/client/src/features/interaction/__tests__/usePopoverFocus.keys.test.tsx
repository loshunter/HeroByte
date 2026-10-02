// Two more promises of the header popovers (U10b, review round 2):
//  - the movement keys (arrows, WASD, QEZC) pressed INSIDE an open popover belong to the popover
//    (reading a help list with the down arrow must not step the player's token: the movement
//    hook listens on window);
//  - if the control that had focus inside the popover is removed while it is open (the Table menu
//    swaps its role controls when the connection blips), focus falls back to the popover itself
//    instead of dropping to the page, where the popover's Tab handling can no longer see keys.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { HelpMenuButton } from "../../help/HelpMenuButton";
import { TableMenu } from "../../table/TableMenu";
import type { TableMenuProps } from "../../table/tableMenuProps";

vi.mock("../../juice/sfxEngine", () => ({ sfxEngine: { play: vi.fn(), resume: vi.fn() } }));

afterEach(() => cleanup());

const MENU: TableMenuProps = {
  uid: "0123456789abcdef",
  tableName: "Sunday Game",
  isPublicTable: false,
  isConnected: true,
  isDM: false,
  roleKnown: true,
  onToggleDM: () => {},
  crtFilter: false,
  onCrtFilterChange: () => {},
};

it("keeps a movement key pressed inside the Help popover off the window (no token steps)", () => {
  const onWindowKey = vi.fn();
  window.addEventListener("keydown", onWindowKey);
  try {
    render(<HelpMenuButton />);
    fireEvent.click(screen.getByRole("button", { name: /help/i }));
    const inside = screen.getByRole("dialog", { name: "HeroByte help" }).querySelector("button")!;
    for (const key of ["ArrowDown", "ArrowUp", "w", "a", "s", "d", "q", "e", "z", "c"]) {
      fireEvent.keyDown(inside, { key });
    }
    expect(onWindowKey).not.toHaveBeenCalled();
    // A key the popover does not own still reaches the window, so does a movement key pressed
    // anywhere else, and so does a MODIFIED one: Ctrl+Z (undo) is somebody else's shortcut.
    fireEvent.keyDown(inside, { key: "x" });
    fireEvent.keyDown(document.body, { key: "ArrowDown" });
    fireEvent.keyDown(inside, { key: "z", ctrlKey: true });
    fireEvent.keyDown(inside, { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(inside, { key: "z", metaKey: true });
    fireEvent.keyDown(inside, { key: "ArrowLeft", altKey: true });
    expect(onWindowKey).toHaveBeenCalledTimes(6);
  } finally {
    window.removeEventListener("keydown", onWindowKey);
  }
});

it("keeps a movement key pressed inside the Table menu off the window too", () => {
  const onWindowKey = vi.fn();
  window.addEventListener("keydown", onWindowKey);
  try {
    render(<TableMenu menu={MENU} />);
    fireEvent.click(screen.getByRole("button", { name: /^Table menu:/ }));
    const inside = screen.getByRole("dialog", { name: "Table menu" }).querySelector("button")!;
    fireEvent.keyDown(inside, { key: "ArrowRight" });
    expect(onWindowKey).not.toHaveBeenCalled();
  } finally {
    window.removeEventListener("keydown", onWindowKey);
  }
});

it("does not swallow a movement key pressed in a text field inside the popover (typing is the field's)", () => {
  const onWindowKey = vi.fn();
  window.addEventListener("keydown", onWindowKey);
  try {
    render(<TableMenu menu={MENU} />);
    fireEvent.click(screen.getByRole("button", { name: /^Table menu:/ }));
    const field = document.createElement("input");
    screen.getByRole("dialog", { name: "Table menu" }).appendChild(field);
    fireEvent.keyDown(field, { key: "a" });
    expect(onWindowKey).toHaveBeenCalledTimes(1);
  } finally {
    window.removeEventListener("keydown", onWindowKey);
  }
});

it("falls back to the popover when the control that held focus is removed while it is open", () => {
  const view = render(<TableMenu menu={{ ...MENU, isDM: true }} />);
  fireEvent.click(screen.getByRole("button", { name: /^Table menu:/ }));
  const settings = screen.getByRole("button", { name: /table settings/i });
  settings.focus();
  expect(document.activeElement).toBe(settings);
  // The role UI is derived: a socket close nulls the snapshot and the role goes unknown, which
  // removes "Table settings..." (and replaces the role controls).
  act(() => {
    view.rerender(<TableMenu menu={{ ...MENU, isDM: true, roleKnown: false }} />);
  });
  expect(screen.queryByRole("button", { name: /table settings/i })).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("dialog", { name: "Table menu" }));
});

it("falls back to the popover when focus is still where OPENING it put it (the common path: nothing was focused by hand)", () => {
  const view = render(<TableMenu menu={{ ...MENU, isDM: true }} />);
  fireEvent.click(screen.getByRole("button", { name: /^Table menu:/ }));
  // Opening takes focus into the menu: the first control, here "Leave DM mode".
  const first = screen.getByRole("button", { name: "Leave DM mode" });
  expect(document.activeElement).toBe(first);
  act(() => {
    view.rerender(<TableMenu menu={{ ...MENU, isDM: true, roleKnown: false }} />);
  });
  expect(screen.queryByRole("button", { name: "Leave DM mode" })).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("dialog", { name: "Table menu" }));
});

it("does not pull focus back into the popover when the person moved it elsewhere on purpose", () => {
  render(
    <>
      <button>Elsewhere</button>
      <TableMenu menu={{ ...MENU, isDM: true }} />
    </>,
  );
  fireEvent.click(screen.getByRole("button", { name: /^Table menu:/ }));
  const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
  elsewhere.focus();
  fireEvent.mouseDown(elsewhere);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(elsewhere);
});
