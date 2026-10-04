// Help's FOCUS contract (U10b, owner's answer to Q5), the same four rules as the
// Table menu's (see TableMenu.focus.test.tsx): take focus on open; return it to the
// launcher only on Escape or the toggle; never trap Tab.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { HelpMenuButton } from "../HelpMenuButton";

afterEach(() => cleanup());

function Page() {
  return (
    <>
      <button>Before</button>
      <header>
        <HelpMenuButton />
        <button>After</button>
      </header>
    </>
  );
}

const launcher = () => screen.getByRole("button", { name: /help/i, expanded: false });
const dialog = () => screen.getByRole("dialog", { name: "HeroByte help" });

function openHelp() {
  const button = launcher();
  fireEvent.click(button);
  return button;
}

function tabbablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], [tabindex]"),
  ).filter((el) => !el.hasAttribute("disabled") && el.getAttribute("tabindex") !== "-1");
}

it("takes focus into the popover when it opens", () => {
  render(<Page />);
  const button = openHelp();
  expect(dialog().contains(document.activeElement)).toBe(true);
  expect(document.activeElement).not.toBe(button);
});

it("returns focus to the launcher on Escape", () => {
  render(<Page />);
  const button = openHelp();
  act(() => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
  });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(button);
});

it("returns focus to the launcher when the toggle button closes it", () => {
  render(<Page />);
  const button = openHelp();
  fireEvent.click(button);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(button);
});

it("leaves focus where the person clicked after a click elsewhere", () => {
  render(<Page />);
  openHelp();
  const elsewhere = screen.getByRole("button", { name: "After" });
  elsewhere.focus();
  fireEvent.mouseDown(elsewhere);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(elsewhere);
});

it("does not trap Tab: past the last control it closes and carries on after the launcher", () => {
  render(<Page />);
  openHelp();
  const items = tabbablesIn(dialog());
  const last = items[items.length - 1];
  last.focus();
  fireEvent.keyDown(last, { key: "Tab" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
});

it("sends Shift+Tab off the first control to the launcher and closes", () => {
  render(<Page />);
  const button = openHelp();
  const first = tabbablesIn(dialog())[0];
  first.focus();
  fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(button);
});

it("sends Shift+Tab to the launcher even when the popover container itself holds focus (after a click on its text)", () => {
  render(<Page />);
  const button = openHelp();
  const pop = dialog();
  pop.focus();
  expect(document.activeElement).toBe(pop);
  fireEvent.keyDown(pop, { key: "Tab", shiftKey: true });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(button);
});
