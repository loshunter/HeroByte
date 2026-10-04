import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HelpMenuButton } from "../../help/HelpMenuButton";
import type { KickControls } from "../../atlas/useKickedInDoor";
import { CharacterHarness } from "./desktopFrames.fixtures";
import { KickHarness, kickCalls, escape } from "./popoverOwners.fixtures";
import { viewport } from "./frameInteraction.fixtures";
import { dismissalFocus } from "../dismissalFocus";
import { frameQueue } from "./focusFixtures";

let previous: [number, number];
beforeEach(() => {
  previous = [innerWidth, innerHeight];
  viewport(1440, 900);
  vi.stubGlobal("matchMedia", undefined);
  frameQueue();
  dismissalFocus.invalidate();
});
afterEach(() => {
  cleanup();
  dismissalFocus.invalidate();
  viewport(...previous);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setup(character = false) {
  const calls = kickCalls();
  const close = vi.fn();
  const api = { current: null as KickControls | null };
  render(
    <>
      <KickHarness calls={calls} api={api} />
      <HelpMenuButton />
      {character && <CharacterHarness close={close} submit={vi.fn()} />}
    </>,
  );
  return { calls, api, close };
}

describe("Kick G respects the real foreground owner", () => {
  it.each(["character", "help"])(
    "does not mount below or steal a focused button from %s",
    (kind) => {
      const { calls, api, close } = setup(kind === "character");
      let button: HTMLElement;
      if (kind === "character") {
        fireEvent.click(screen.getByRole("button", { name: "Open player settings" }));
        button = screen.getByRole("button", { name: /Close.*Alice/ });
      } else {
        fireEvent.click(screen.getByRole("button", { name: "Help" }));
        button = within(screen.getByRole("dialog", { name: "HeroByte help" })).getAllByRole(
          "button",
        )[0]!;
      }
      act(() => button.focus());
      expect(document.activeElement).toBe(button);
      const key = new KeyboardEvent("keydown", { key: "g", bubbles: true, cancelable: true });
      act(() => button.dispatchEvent(key));
      expect(screen.queryByTestId("kick-panel")).toBeNull();
      expect(api.current?.open).toBe(false);
      expect(document.activeElement).toBe(button);
      expect(button).toBeInTheDocument();
      expect(key.defaultPrevented).toBe(false);
      expect(close).not.toHaveBeenCalled();
      expect(calls.send).not.toHaveBeenCalled();
      escape(button);
      fireEvent.keyDown(document.body, { key: "g" });
      expect(screen.getByTestId("kick-panel")).toBeInTheDocument();
      expect(document.activeElement).toBe(screen.getByLabelText("Name"));
      expect(calls.send).not.toHaveBeenCalled();
    },
  );

  it.each(["composing", "legacy", "tracked", "prevented"])(
    "retains %s G before global opening",
    (kind) => {
      const { api, calls } = setup();
      if (kind === "tracked") fireEvent.compositionStart(document.body);
      const key = new KeyboardEvent("keydown", {
        key: "g",
        bubbles: true,
        cancelable: true,
        isComposing: kind === "composing",
        keyCode: kind === "legacy" ? 229 : 0,
      });
      if (kind === "prevented") key.preventDefault();
      act(() => document.body.dispatchEvent(key));
      expect(api.current?.open).toBe(false);
      expect(screen.queryByTestId("kick-panel")).toBeNull();
      expect(calls.send).not.toHaveBeenCalled();
      if (kind === "tracked") fireEvent.compositionEnd(document.body);
      fireEvent.keyDown(document.body, { key: "g" });
      expect(screen.getByTestId("kick-panel")).toBeInTheDocument();
    },
  );

  it.each(["input", "textarea", "select"] as const)(
    "keeps native %s typing and still opens from body later",
    (tag) => {
      const { api, calls } = setup();
      const field = document.createElement(tag);
      document.body.append(field);
      act(() => field.focus());
      fireEvent.keyDown(field, { key: "g" });
      expect(api.current?.open).toBe(false);
      expect(document.activeElement).toBe(field);
      expect(calls.send).not.toHaveBeenCalled();
      field.remove();
      fireEvent.keyDown(document.body, { key: "g" });
      expect(screen.getByTestId("kick-panel")).toBeInTheDocument();
    },
  );
});
