// The Table menu's FOCUS contract (U10b, owner's answer to Q5). The Escape contract
// stays in TableMenu.u2.test.tsx; this is where focus goes:
//   1. opening takes focus INTO the popover;
//   2. Escape and the toggle button return it to the launcher, and nothing else does;
//   3. an item that opens something else hands focus to that thing, not back;
//   4. Tab is never trapped: past the last control the popover closes and focus
//      carries on after the launcher; Shift+Tab off the first lands on the launcher.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TableMenu } from "../TableMenu";
import type { TableMenuProps } from "../tableMenuProps";
import { __resetJuiceSettingsForTests } from "../../juice/juiceSettings";
import { __resetDMMenuRequestsForTests, takeDMMenuTabRequest } from "../menuRequest";

vi.mock("../../juice/sfxEngine", () => ({ sfxEngine: { play: vi.fn(), resume: vi.fn() } }));

const PLAYER: TableMenuProps = {
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

beforeEach(() => {
  __resetJuiceSettingsForTests({ motion: "full", muted: false, volume: 0.6 });
  __resetDMMenuRequestsForTests();
});
afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-motion");
  vi.clearAllMocks();
});

function Page({ menu = PLAYER }: { menu?: TableMenuProps }) {
  return (
    <>
      <button>Before</button>
      <header>
        <TableMenu menu={menu} />
        <button>After</button>
      </header>
    </>
  );
}

const launcher = () => screen.getByRole("button", { name: /^Table menu:/ });
const dialog = () => screen.getByRole("dialog", { name: "Table menu" });

function escape() {
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
  });
}

function tabbablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], [tabindex]"),
  ).filter((el) => !el.hasAttribute("disabled") && el.getAttribute("tabindex") !== "-1");
}

it("takes focus into the popover when it opens", () => {
  render(<Page />);
  fireEvent.click(launcher());
  expect(dialog().contains(document.activeElement)).toBe(true);
  expect(document.activeElement).not.toBe(launcher());
});

it("returns focus to the launcher on Escape", () => {
  render(<Page />);
  fireEvent.click(launcher());
  escape();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(launcher());
});

it("returns focus to the launcher when the toggle button closes it", () => {
  render(<Page />);
  fireEvent.click(launcher());
  fireEvent.click(launcher());
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(launcher());
});

it("leaves focus where the person clicked after a click elsewhere", () => {
  render(<Page />);
  fireEvent.click(launcher());
  const elsewhere = screen.getByRole("button", { name: "After" });
  elsewhere.focus();
  fireEvent.mouseDown(elsewhere);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(elsewhere);
});

it("does not trap Tab: past the last control it closes and carries on after the launcher", () => {
  render(<Page />);
  fireEvent.click(launcher());
  const items = tabbablesIn(dialog());
  const last = items[items.length - 1];
  last.focus();
  fireEvent.keyDown(last, { key: "Tab" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
});

it("sends Shift+Tab off the first control to the launcher and closes", () => {
  render(<Page />);
  fireEvent.click(launcher());
  const first = tabbablesIn(dialog())[0];
  first.focus();
  fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(launcher());
});

it("leaves Tab between inner controls alone", () => {
  render(<Page />);
  fireEvent.click(launcher());
  const items = tabbablesIn(dialog());
  expect(items.length).toBeGreaterThan(1);
  items[0].focus();
  expect(fireEvent.keyDown(items[0], { key: "Tab" })).toBe(true);
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

it("does not hand focus back to the launcher when an item opens something else", () => {
  const onToggleDM = vi.fn();
  render(<Page menu={{ ...PLAYER, onToggleDM }} />);
  fireEvent.click(launcher());
  fireEvent.click(screen.getByRole("button", { name: /enter dm mode/i }));
  expect(onToggleDM).toHaveBeenCalledWith(true);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).not.toBe(launcher());
});

it("does not hand focus back to the launcher when Table settings… opens the DM menu", () => {
  render(<Page menu={{ ...PLAYER, isDM: true }} />);
  fireEvent.click(launcher());
  fireEvent.click(screen.getByRole("button", { name: /table settings/i }));
  expect(takeDMMenuTabRequest()).toBe("table");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).not.toBe(launcher());
});

it("sends Shift+Tab to the launcher even when the popover container itself holds focus (after a click on its text)", () => {
  render(<Page />);
  fireEvent.click(launcher());
  const pop = dialog();
  pop.focus();
  expect(document.activeElement).toBe(pop);
  fireEvent.keyDown(pop, { key: "Tab", shiftKey: true });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(launcher());
});
