import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerSettingsMenu } from "../../players/components/PlayerSettingsMenu";
import { dismissalFocus } from "../dismissalFocus";
import { frameQueue, visible } from "./focusFixtures";
import { viewport } from "./frameInteraction.fixtures";
import { CharacterHarness } from "./desktopFrames.fixtures";

let queue: ReturnType<typeof frameQueue>;
let previousViewport: [number, number];
beforeEach(() => {
  previousViewport = [innerWidth, innerHeight];
  viewport(1440, 900);
  vi.stubGlobal("matchMedia", undefined);
  queue = frameQueue();
  dismissalFocus.invalidate();
});
afterEach(() => {
  cleanup();
  dismissalFocus.invalidate();
  viewport(...previousViewport);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Character explicit dismissal and existing save boundaries", () => {
  it.each([false, true])(
    "Escape closes a dirty name without save; forced blur=%s",
    (blurDuringClose) => {
      const submit = vi.fn();
      const close = vi.fn();
      render(<CharacterHarness submit={submit} close={close} blurDuringClose={blurDuringClose} />);
      const opener = visible(screen.getByRole("button", { name: "Open player settings" }));
      fireEvent.click(opener); // fireEvent does not focus buttons itself.
      const input = screen.getByPlaceholderText("Enter Name");
      act(() => input.focus());
      fireEvent.change(input, { target: { value: "Dirty" } });
      fireEvent.keyDown(input, { key: "Escape" });
      expect(close).toHaveBeenCalledTimes(1);
      expect(submit).not.toHaveBeenCalled();
      expect(screen.queryByPlaceholderText("Enter Name")).not.toBeInTheDocument();
      act(() => queue.flush());
      expect(document.activeElement).toBe(opener);
      expect(submit).not.toHaveBeenCalled();
      // Reopen invalidates the old suppression lifetime; ordinary blur saves again.
      fireEvent.click(opener);
      const reopened = screen.getByPlaceholderText("Enter Name");
      act(() => reopened.focus());
      fireEvent.blur(reopened);
      expect(submit).toHaveBeenCalledTimes(1);
    },
  );

  it("X retains the existing natural blur-save before its close callback", () => {
    const events: string[] = [];
    render(
      <CharacterHarness submit={() => events.push("save")} close={() => events.push("close")} />,
    );
    const opener = visible(screen.getByRole("button", { name: "Open player settings" }));
    fireEvent.click(opener);
    const input = screen.getByPlaceholderText("Enter Name");
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "Dirty" } });
    const x = screen.getByRole("button", { name: "Close 🎮 Dirty" });
    act(() => x.focus()); // The actual focus/blur transition precedes the click.
    fireEvent.click(x);
    expect(events).toEqual(["save", "close"]);
    act(() => queue.flush());
    expect(document.activeElement).toBe(opener);
  });

  it("picker Escape closes only the picker and sends no rollback/save command", () => {
    const change = vi.fn();
    const close = vi.fn();
    const props = {
      isOpen: true,
      onClose: close,
      selectedEffects: ["prone"],
      onStatusEffectsChange: change,
      onToggleDMMode: vi.fn(),
    };
    const view = render(<PlayerSettingsMenu {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "1 Active Effect" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /poisoned/i }));
    expect(change).toHaveBeenCalledExactlyOnceWith(["prone", "poisoned"]);
    view.rerender(<PlayerSettingsMenu {...props} selectedEffects={["stunned"]} />);
    expect(screen.getByRole("checkbox", { name: /prone/i })).toBeChecked();
    fireEvent.keyDown(screen.getByRole("checkbox", { name: /poisoned/i }), { key: "Escape" });
    expect(close).not.toHaveBeenCalled();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(change).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "1 Active Effect" }));
    expect(screen.getByRole("checkbox", { name: /stunned/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /prone/i })).not.toBeChecked();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(close).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(1);
    expect(change).toHaveBeenCalledTimes(1);
  });

  it("raw Character hiding never requests focus restoration", () => {
    const request = vi.spyOn(dismissalFocus, "request");
    const submit = vi.fn();
    const props = {
      isOpen: true,
      onClose: vi.fn(),
      selectedEffects: [],
      onStatusEffectsChange: vi.fn(),
      onToggleDMMode: vi.fn(),
      nameInput: "Dirty",
      onNameInputChange: vi.fn(),
      onNameSubmit: submit,
    };
    const view = render(<PlayerSettingsMenu {...props} />);
    act(() => screen.getByPlaceholderText("Enter Name").focus());
    view.rerender(<PlayerSettingsMenu {...props} isOpen={false} />);
    act(() => queue.flush());
    expect(request).not.toHaveBeenCalled();
  });
});
