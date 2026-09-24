import { useRef, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { JuiceMenuButton } from "../JuiceMenuButton";
import { __resetJuiceSettingsForTests, getJuiceSettings } from "../juiceSettings";
import { useToolMode } from "../../../hooks/useToolMode";
import { useEscapeOwner, useEscapeRoot } from "../../interaction/useEscapeOwner";

vi.mock("../sfxEngine", () => ({ sfxEngine: { play: vi.fn(), resume: vi.fn() } }));

beforeEach(() => __resetJuiceSettingsForTests({ motion: "full", muted: false, volume: 0.6 }));
afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-motion");
  vi.clearAllMocks();
});

function HigherBlocker() {
  const ref = useRef<HTMLElement>(null);
  const root = useEscapeRoot(ref, 150);
  useEscapeOwner(() => ({
    kind: "popover",
    name: "Higher loading popover",
    active: true,
    root,
    anchor: ref.current,
  }));
  return <section ref={ref} aria-busy="true" style={{ position: "fixed", zIndex: 150 }} />;
}

function Harness({ showJuice = true, blocker = false } = {}) {
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
      <header style={{ position: "fixed", zIndex: 100 }}>{showJuice && <JuiceMenuButton />}</header>
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

function openJuice() {
  fireEvent.click(screen.getByRole("button", { name: "Choose Draw" }));
  const button = screen.getByRole("button", { name: /Juice/ });
  button.focus();
  fireEvent.click(button);
  expect(button).toHaveAttribute("aria-expanded", "true");
  return button;
}

it("closes Juice before exiting the actual Draw tool on the next Escape", () => {
  render(<Harness />);
  const button = openJuice();
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
  const button = screen.getByRole("button", { name: /Juice/ });
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
  const button = openJuice();
  const select = screen.getByRole("combobox", { name: "Motion" });
  select.focus();
  expect(escape(select).defaultPrevented).toBe(false);
  expect(button).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByTestId("tool")).toHaveTextContent("draw");
});

it("honors IME flags and tracked composition before a subsequent ordinary Escape", () => {
  render(<Harness />);
  const button = openJuice();
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

it("respects a prevented input Escape, then closes without adding launcher focus return", () => {
  render(<Harness />);
  const button = openJuice();
  const volume = screen.getByRole("slider", { name: "Volume" });
  volume.focus();
  escape(volume, {}, true);
  expect(button).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByTestId("tool")).toHaveTextContent("draw");
  expect(document.activeElement).toBe(volume);
  expect(escape(volume).defaultPrevented).toBe(true);
  expect(button).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByTestId("tool")).toHaveTextContent("draw");
  expect(document.activeElement).toBe(document.body);
});

it("keeps Juice hidden behind a higher root instead of flattening its local z-index 200", () => {
  const view = render(<Harness />);
  const button = openJuice();
  view.rerender(<Harness blocker />);
  expect(escape(button).defaultPrevented).toBe(true);
  expect(button).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByTestId("tool")).toHaveTextContent("draw");
});

it("preserves real settings, mute state, inside clicks, and the existing outside-click close", () => {
  render(<Harness />);
  const button = openJuice();
  fireEvent.change(screen.getByLabelText("Motion"), { target: { value: "subtle" } });
  fireEvent.change(screen.getByRole("slider"), { target: { value: "0.25" } });
  fireEvent.click(screen.getByLabelText("Mute sound effects"));
  expect(getJuiceSettings()).toEqual({ motion: "subtle", volume: 0.25, muted: true });
  expect(button).toHaveTextContent("🔇 Juice");
  expect(screen.getByRole("slider")).toBeDisabled();
  fireEvent.mouseDown(screen.getByLabelText("Motion"));
  expect(button).toHaveAttribute("aria-expanded", "true");
  fireEvent.mouseDown(document.body);
  expect(button).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByTestId("tool")).toHaveTextContent("draw");
  escape(button);
  expect(screen.getByTestId("tool")).toHaveTextContent("move");
});

it("releases an open Juice owner on unmount so the remaining tool can exit", () => {
  const view = render(<Harness />);
  openJuice();
  view.rerender(<Harness showJuice={false} />);
  escape(document.body);
  expect(screen.getByTestId("tool")).toHaveTextContent("move");
});
