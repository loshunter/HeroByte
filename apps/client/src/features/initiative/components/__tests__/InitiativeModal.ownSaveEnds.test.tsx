// The dialog's own save ends when ITS request does. It used to keep listening
// after a failure: every later request on the layout's one initiative hook —
// another character's clear from a settings window — then showed "Setting..."
// in this dialog and closed it on that request's confirm. And while someone
// else's request is in flight, nothing of this dialog is held: Escape closes,
// Cancel works, Enter in the hand-entry field saves.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SnapshotCharacter } from "@herobyte/shared";
import { InitiativeModal } from "../InitiativeModal";

vi.mock("../../../juice", () => ({ useSfx: () => ({ play: vi.fn() }) }));

afterEach(cleanup);

const hero = { id: "hero", name: "Hero", type: "pc", initiativeModifier: 0 } as SnapshotCharacter;
const spies = () => ({ onClose: vi.fn(), onSetInitiative: vi.fn() });
const props = (s: ReturnType<typeof spies>, isLoading: boolean, error: string | null) => ({
  character: hero,
  onClose: s.onClose,
  onSetInitiative: s.onSetInitiative,
  onRollInitiative: vi.fn(),
  manualEntryAllowed: true,
  isLoading,
  error,
});
const typeRoll = (value: string) => {
  fireEvent.click(screen.getByRole("button", { name: /Physical Dice|by hand/i }));
  const input = screen.getByPlaceholderText("Enter roll...");
  fireEvent.change(input, { target: { value } });
  return input;
};
const saveButton = () => screen.getByRole("button", { name: /^Save|Setting/ });
const TIMEOUT = "Initiative update timed out. Please try again.";

describe("InitiativeModal — someone else's request in flight", () => {
  it("holds nothing of this dialog: Cancel is live and Enter in the field saves, once", () => {
    const s = spies();
    render(<InitiativeModal {...props(s, true, null)} />);
    const input = typeRoll("12");

    expect(screen.getByRole("button", { name: "Cancel" })).not.toBeDisabled();
    fireEvent.keyDown(input, { key: "Enter" });

    expect(s.onSetInitiative).toHaveBeenCalledTimes(1);
    expect(s.onSetInitiative).toHaveBeenCalledWith(12, 0);
  });

  it("does not hold Escape", () => {
    const s = spies();
    render(<InitiativeModal {...props(s, true, null)} />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(s.onClose).toHaveBeenCalledTimes(1);
  });
});

describe("InitiativeModal — its own save ends with its request", () => {
  it("after its request fails, a later request is not its own: no Setting..., no close, its error stays", () => {
    const s = spies();
    const view = render(<InitiativeModal {...props(s, false, null)} />);
    typeRoll("12");
    fireEvent.click(saveButton());
    view.rerender(<InitiativeModal {...props(s, true, null)} />);
    view.rerender(<InitiativeModal {...props(s, false, TIMEOUT)} />);
    expect(screen.getByText(/timed out/)).toBeTruthy();

    // Another character's request on the same hook: in flight, then confirmed.
    view.rerender(<InitiativeModal {...props(s, true, null)} />);
    expect(saveButton()).not.toBeDisabled();
    expect(saveButton().textContent).not.toMatch(/Setting/);
    view.rerender(<InitiativeModal {...props(s, false, null)} />);

    expect(s.onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/timed out/)).toBeTruthy();
  });

  it("a new Save clears its old failure and waits again", () => {
    const s = spies();
    const view = render(<InitiativeModal {...props(s, false, null)} />);
    typeRoll("12");
    fireEvent.click(saveButton());
    view.rerender(<InitiativeModal {...props(s, true, null)} />);
    view.rerender(<InitiativeModal {...props(s, false, TIMEOUT)} />);

    fireEvent.click(saveButton());
    view.rerender(<InitiativeModal {...props(s, true, null)} />);
    expect(screen.queryByText(/timed out/)).toBeNull();
    expect(saveButton()).toBeDisabled();
    view.rerender(<InitiativeModal {...props(s, false, null)} />);
    expect(s.onClose).toHaveBeenCalledTimes(1);
  });
});
