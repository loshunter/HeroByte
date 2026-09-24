import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HelpMenuButton } from "../../help/HelpMenuButton";
import type { KickControls } from "../../atlas/useKickedInDoor";
import { escape, KickHarness, kickCalls } from "./popoverOwners.fixtures";

afterEach(cleanup);
function setup(mobile = false, help = false) {
  const calls = kickCalls();
  const api = { current: null as KickControls | null };
  render(
    <>
      <KickHarness calls={calls} api={api} mobile={mobile} />
      {help && <HelpMenuButton />}
    </>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open kick" }));
  return { calls, api };
}

describe.each([false, true])("Kick's single mounted owner (mobile=%s)", (mobile) => {
  it.each(["name", "body"])(
    "Escape from %s closes exactly once through the real hook and UI",
    (site) => {
      const { calls, api } = setup(mobile);
      // Both layouts now read the one App-level session signal.
      expect(api.current?.open).toBe(true);
      const field = screen.getByLabelText("Name");
      expect(document.activeElement).toBe(field);
      const event = escape(site === "name" ? field : document.body);
      expect(event.defaultPrevented).toBe(true);
      expect(calls.close).toHaveBeenCalledTimes(1);
      expect(api.current?.open).toBe(false);
      expect(screen.queryByTestId("kick-panel")).toBeNull();
      expect(calls.send).not.toHaveBeenCalled();
    },
  );

  it.each(["select", "composing", "legacy composing", "prevented"])(
    "%s Escape reaches native/IME first, with no form or global close",
    (mode) => {
      const { calls } = setup(mobile);
      const target = screen.getByLabelText(mode === "select" ? "Door type" : "Name");
      const event = escape(
        target,
        { isComposing: mode === "composing", keyCode: mode === "legacy composing" ? 229 : 0 },
        mode === "prevented" ? (key) => key.preventDefault() : undefined,
      );
      expect(event.defaultPrevented).toBe(mode === "prevented");
      expect(calls.close).not.toHaveBeenCalled();
      expect(screen.getByTestId("kick-panel")).toBeInTheDocument();
      expect(calls.send).not.toHaveBeenCalled();
    },
  );

  it("a higher real Help frame gets Escape originating inside the lower Kick form", () => {
    const { calls } = setup(mobile, true);
    const field = screen.getByLabelText("Name");
    fireEvent.change(field, { target: { value: "Keep this draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    const help = screen.getByRole("dialog", { name: "HeroByte help" });
    expect(escape(field).defaultPrevented).toBe(true);
    expect(help).not.toBeInTheDocument();
    expect(calls.close).not.toHaveBeenCalled();
    expect(field).toHaveValue("Keep this draft");
    expect(screen.getByTestId("kick-panel")).toBeInTheDocument();
    escape(field);
    expect(calls.close).toHaveBeenCalledTimes(1);
  });

  it("Escape closes a reopened pending panel without retracting its sent request or toast", () => {
    const { calls, api } = setup(mobile);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Cellar" } });
    fireEvent.change(screen.getByLabelText("Seed"), { target: { value: "77" } });
    fireEvent.submit(screen.getByTestId("kick-panel"));
    expect(calls.send).toHaveBeenCalledTimes(1);
    expect(calls.send).toHaveBeenLastCalledWith(
      expect.objectContaining({ t: "atlas-kick", name: "Cellar", seed: 77 }),
    );
    const pending = api.current?.pending;
    expect(pending).toMatchObject({ name: "Cellar", expired: false });
    expect(screen.queryByTestId("kick-panel")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open kick" }));
    expect(screen.getByRole("button", { name: "⏳ Kicking…" })).toBeDisabled();
    escape(screen.getByLabelText("Name"));
    expect(calls.close).toHaveBeenCalledTimes(1);
    expect(api.current?.pending).toBe(pending);
    expect(calls.send).toHaveBeenCalledTimes(1);
    expect(calls.toast.dismiss).not.toHaveBeenCalled();
  });

  it("tracked composition keeps the form open until composition ends", () => {
    const { calls } = setup(mobile);
    const field = screen.getByLabelText("Name");
    fireEvent.compositionStart(field);
    expect(escape(field).defaultPrevented).toBe(false);
    expect(calls.close).not.toHaveBeenCalled();
    fireEvent.compositionEnd(field);
    escape(field);
    expect(calls.close).toHaveBeenCalledTimes(1);
  });
});

it("the real hook's G shortcut still opens the desktop panel, which now owns Escape", () => {
  const calls = kickCalls();
  const api = { current: null as KickControls | null };
  render(<KickHarness calls={calls} api={api} />);
  fireEvent.keyDown(document.body, { key: "g" });
  expect(screen.getByTestId("kick-panel")).toBeInTheDocument();
  escape(document.body);
  expect(calls.close).toHaveBeenCalledTimes(1);
  expect(api.current?.open).toBe(false);
});
