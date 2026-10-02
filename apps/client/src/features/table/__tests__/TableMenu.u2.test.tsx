// The Escape contract for the Table menu's popover (plan §3.1). These are the
// cases that pinned the Juice popover before its controls moved in here (U9): the
// menu is a nonmodal foreground popover, so Escape closes IT before it exits the
// active tool, leaves a held gesture for a later Escape, hands a native select or
// IME composition its own Escape, yields to a higher layer, and releases its owner
// when it unmounts.
import { useRef, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TableMenu } from "../TableMenu";
import type { TableMenuProps } from "../tableMenuProps";
import { __resetJuiceSettingsForTests, getJuiceSettings } from "../../juice/juiceSettings";
import { useToolMode } from "../../../hooks/useToolMode";
import { useEscapeOwner, useEscapeRoot } from "../../interaction/useEscapeOwner";

vi.mock("../../juice/sfxEngine", () => ({ sfxEngine: { play: vi.fn(), resume: vi.fn() } }));

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

beforeEach(() => __resetJuiceSettingsForTests({ motion: "full", muted: false, volume: 0.6 }));
afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-motion");
  vi.clearAllMocks();
});

function HigherBlocker() {
  const ref = useRef<HTMLElement>(null);
  const root = useEscapeRoot(ref, 2500);
  useEscapeOwner(() => ({
    kind: "popover",
    name: "Higher loading popover",
    active: true,
    root,
    anchor: ref.current,
  }));
  return <section ref={ref} aria-busy="true" style={{ position: "fixed", zIndex: 2500 }} />;
}

function Harness({ showMenu = true, blocker = false } = {}) {
  const tool = useToolMode();
  const [pending, setPending] = useState(false);
  useEscapeOwner(() => ({
    kind: "gesture",
    name: "Held annotation contract",
    order: 10,
    active: pending,
    handle: () => setPending(false),
  }));
  return (
    <>
      <button onClick={() => tool.setActiveTool("draw")}>Choose Draw</button>
      <button onClick={() => setPending(true)}>Hold stroke</button>
      <output data-testid="tool">{tool.activeTool ?? "move"}</output>
      <output data-testid="pending">{String(pending)}</output>
      <header style={{ position: "fixed", zIndex: 100 }}>
        {showMenu && <TableMenu menu={MENU} />}
      </header>
      {blocker && <HigherBlocker />}
    </>
  );
}

function escape(target: EventTarget, init: KeyboardEventInit = {}, prevent = false) {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
    ...init,
  });
  if (prevent) event.preventDefault();
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

const menuButton = () => screen.getByRole("button", { name: /^Table menu:/ });

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Choose Draw" }));
  const button = menuButton();
  button.focus();
  fireEvent.click(button);
  expect(button).toHaveAttribute("aria-expanded", "true");
  return button;
}

it("closes the Table menu before exiting the actual Draw tool on the next Escape", () => {
  render(<Harness />);
  const button = openMenu();
  expect(escape(button).defaultPrevented).toBe(true);
  expect(button).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByLabelText("Motion")).toBeNull();
  expect(screen.getByTestId("tool")).toHaveTextContent("draw");
  escape(button);
  expect(screen.getByTestId("tool")).toHaveTextContent("move");
});

it("opening and closing this nonmodal popover preserves a held gesture until a later Escape", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Choose Draw" }));
  fireEvent.click(screen.getByRole("button", { name: "Hold stroke" }));
  const button = menuButton();
  fireEvent.click(button);
  expect(screen.getByTestId("pending")).toHaveTextContent("true");
  escape(button);
  expect(button).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByTestId("pending")).toHaveTextContent("true");
  expect(screen.getByTestId("tool")).toHaveTextContent("draw");
  escape(button);
  expect(screen.getByTestId("pending")).toHaveTextContent("false");
  expect(screen.getByTestId("tool")).toHaveTextContent("draw");
  escape(button);
  expect(screen.getByTestId("tool")).toHaveTextContent("move");
});

it("leaves native select Escape to the Motion control", () => {
  render(<Harness />);
  const button = openMenu();
  const select = screen.getByRole("combobox", { name: "Motion" });
  select.focus();
  expect(escape(select).defaultPrevented).toBe(false);
  expect(button).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByTestId("tool")).toHaveTextContent("draw");
});

it("honors IME flags and tracked composition before a subsequent ordinary Escape", () => {
  render(<Harness />);
  const button = openMenu();
  expect(escape(button, { isComposing: true }).defaultPrevented).toBe(false);
  expect(escape(button, { keyCode: 229 }).defaultPrevented).toBe(false);
  fireEvent.compositionStart(button);
  expect(escape(button).defaultPrevented).toBe(false);
  expect(button).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByTestId("tool")).toHaveTextContent("draw");
  fireEvent.compositionEnd(button);
  escape(button);
  expect(button).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByTestId("tool")).toHaveTextContent("draw");
});

// U2 pinned "no launcher focus return" because focus did not yet move into the
// popover. U10b (owner's Q5) made it a rule: Escape returns focus to the launcher
// (TableMenu.focus.test.tsx holds the rest of the focus contract).
it("respects a prevented input Escape, then closes and returns focus to the launcher", () => {
  render(<Harness />);
  const button = openMenu();
  const volume = screen.getByRole("slider", { name: "Volume" });
  volume.focus();
  escape(volume, {}, true);
  expect(button).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByTestId("tool")).toHaveTextContent("draw");
  expect(document.activeElement).toBe(volume);
  expect(escape(volume).defaultPrevented).toBe(true);
  expect(button).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByTestId("tool")).toHaveTextContent("draw");
  expect(document.activeElement).toBe(button);
});

it("stays open behind a higher root instead of flattening its own layer", () => {
  const view = render(<Harness />);
  const button = openMenu();
  view.rerender(<Harness blocker />);
  expect(escape(button).defaultPrevented).toBe(true);
  expect(button).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByTestId("tool")).toHaveTextContent("draw");
});

it("preserves real settings, inside presses, and the outside-press close", () => {
  render(<Harness />);
  const button = openMenu();
  fireEvent.change(screen.getByLabelText("Motion"), { target: { value: "subtle" } });
  fireEvent.change(screen.getByRole("slider"), { target: { value: "0.25" } });
  fireEvent.click(screen.getByLabelText("Mute sound effects"));
  expect(getJuiceSettings()).toEqual({ motion: "subtle", volume: 0.25, muted: true });
  expect(screen.getByRole("slider")).toBeDisabled();
  fireEvent.mouseDown(screen.getByLabelText("Motion"));
  expect(button).toHaveAttribute("aria-expanded", "true");
  fireEvent.mouseDown(document.body);
  expect(button).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByTestId("tool")).toHaveTextContent("draw");
  escape(button);
  expect(screen.getByTestId("tool")).toHaveTextContent("move");
});

it("releases an open Table menu's owner on unmount so the remaining tool can exit", () => {
  const view = render(<Harness />);
  openMenu();
  view.rerender(<Harness showMenu={false} />);
  escape(document.body);
  expect(screen.getByTestId("tool")).toHaveTextContent("move");
});
