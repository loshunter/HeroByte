// The initiative dialog's U8 contract: the commit vocabulary ("Roll d20 now"
// rolls at once; a hand entry waits for "Save initiative"), a reason where
// hand entry is off instead of a control that silently vanished, the
// auto-start rule said before the press, and a modifier reachable without a
// drag (keyboard and touch).

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SnapshotCharacter } from "@herobyte/shared";
import { InitiativeModal } from "../InitiativeModal";

vi.mock("../../../juice", () => ({ useSfx: () => ({ play: vi.fn() }) }));

afterEach(cleanup);

const goblin = {
  id: "gob",
  name: "Goblin",
  type: "npc",
  initiativeModifier: 2,
} as SnapshotCharacter;

function renderModal(overrides: Partial<React.ComponentProps<typeof InitiativeModal>> = {}) {
  const props = {
    character: goblin,
    onClose: vi.fn(),
    onSetInitiative: vi.fn(),
    onRollInitiative: vi.fn(),
    combatActive: true,
    ...overrides,
  };
  render(<InitiativeModal {...props} />);
  return props;
}

describe("InitiativeModal — U8", () => {
  it("Roll d20 now sends one roll and closes; an untouched dial leaves the modifier to the server", () => {
    const props = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Roll d20 now" }));
    expect(props.onRollInitiative).toHaveBeenCalledTimes(1);
    expect(props.onRollInitiative).toHaveBeenCalledWith(undefined);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onSetInitiative).not.toHaveBeenCalled();
  });

  it("where hand entry is off, says so and where the DM turns it on", () => {
    renderModal({ manualEntryAllowed: false });
    expect(screen.queryByRole("button", { name: "Enter a roll by hand" })).toBeNull();
    expect(screen.getByText(/Entering a roll by hand is off at this table/)).toBeTruthy();
    expect(screen.getByText(/DM Menu → Session/)).toBeTruthy();
  });

  it("says nothing about the policy where hand entry is allowed", () => {
    renderModal({ manualEntryAllowed: true });
    expect(screen.queryByText(/Entering a roll by hand is off/)).toBeNull();
  });

  it("with no fight running, names the auto-start: saving starts combat on THIS character's turn", () => {
    renderModal({ combatActive: false });
    expect(
      screen.getByText(
        "No fight is running: saving an initiative starts combat, on Goblin's turn.",
      ),
    ).toBeTruthy();
  });

  it("in a fight, does not", () => {
    renderModal({ combatActive: true });
    expect(screen.queryByText(/No fight is running/)).toBeNull();
  });

  it("− and + step the modifier, within −20..+20, and the roll uses it", () => {
    const props = renderModal({ character: { ...goblin, initiativeModifier: 19 } });
    const raise = screen.getByRole("button", { name: "Raise the modifier" });
    fireEvent.click(raise);
    fireEvent.click(raise);
    expect(screen.getByTestId("initiative-modifier-dial").textContent).toBe("+20");
    expect(raise).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Lower the modifier" }));
    fireEvent.click(screen.getByRole("button", { name: "Lower the modifier" }));
    fireEvent.click(screen.getByRole("button", { name: "Roll d20 now" }));
    expect(props.onRollInitiative).toHaveBeenCalledWith(18);
  });

  it("− stops at −20", () => {
    renderModal({ character: { ...goblin, initiativeModifier: -19 } });
    const lower = screen.getByRole("button", { name: "Lower the modifier" });
    fireEvent.click(lower);
    fireEvent.click(lower);
    expect(screen.getByTestId("initiative-modifier-dial").textContent).toBe("-20");
    expect(lower).toBeDisabled();
  });

  it("the dial takes a finger drag instead of the page scrolling", () => {
    renderModal();
    expect(screen.getByTestId("initiative-modifier-dial").style.touchAction).toBe("none");
  });

  it("the dial is locked while this dialog's own save is in flight", () => {
    const props = {
      character: goblin,
      onClose: vi.fn(),
      onSetInitiative: vi.fn(),
      onRollInitiative: vi.fn(),
      combatActive: true,
      isLoading: false,
      error: null,
    };
    const view = render(<InitiativeModal {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Enter a roll by hand" }));
    fireEvent.change(screen.getByPlaceholderText("Enter roll..."), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Save initiative" }));
    view.rerender(<InitiativeModal {...props} isLoading={true} />);

    expect(screen.getByRole("button", { name: "Lower the modifier" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Raise the modifier" })).toBeDisabled();
    // Nor does a drag move it. (jsdom has neither PointerEvent nor capture.)
    const dial = screen.getByTestId("initiative-modifier-dial");
    dial.setPointerCapture = vi.fn();
    dial.releasePointerCapture = vi.fn();
    act(() => {
      dial.dispatchEvent(new MouseEvent("pointerdown", { clientX: 100, bubbles: true }));
      document.dispatchEvent(new MouseEvent("pointermove", { clientX: 140, bubbles: true }));
      document.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
    });
    expect(dial.textContent).toBe("+2");
  });
});
