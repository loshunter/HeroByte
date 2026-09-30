// A layout has ONE initiative hook, so its `isSetting` and `error` belong to
// whatever was sent last — another character's clear, another dialog's save.
// A dialog must wait on, close on and report only its OWN save: it used to
// open as "Setting..." with Save disabled while someone else's request was in
// flight, close itself when that request landed, and show a timeout it never
// caused.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SnapshotCharacter } from "@herobyte/shared";
import { InitiativeModal } from "../InitiativeModal";

vi.mock("../../../juice", () => ({ useSfx: () => ({ play: vi.fn() }) }));

afterEach(cleanup);

const hero = { id: "hero", name: "Hero", type: "pc", initiativeModifier: 0 } as SnapshotCharacter;
const base = (isLoading: boolean, error: string | null, onClose = vi.fn()) => ({
  character: hero,
  onClose,
  onSetInitiative: vi.fn(),
  onRollInitiative: vi.fn(),
  manualEntryAllowed: true,
  combatActive: true,
  isLoading,
  error,
});

const handButton = () => screen.getByRole("button", { name: /Physical Dice|by hand/i });
const saveButton = () => screen.getByRole("button", { name: /^Save|Setting/ });

describe("InitiativeModal — only its own save", () => {
  it("another request in flight neither disables this dialog nor closes it when it lands", () => {
    const onClose = vi.fn();
    const view = render(<InitiativeModal {...base(true, null, onClose)} />);
    fireEvent.click(handButton());
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "12" } });

    expect(saveButton()).not.toBeDisabled();
    expect(saveButton().textContent).not.toMatch(/Setting/);

    view.rerender(<InitiativeModal {...base(false, null, onClose)} />);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("an earlier request's timeout is not this dialog's error", () => {
    render(<InitiativeModal {...base(false, "Initiative update timed out. Please try again.")} />);
    expect(screen.queryByText(/timed out/)).toBeNull();
  });

  it("its own save still waits, closes on the confirm, and reports its own failure", () => {
    const onClose = vi.fn();
    const view = render(<InitiativeModal {...base(false, null, onClose)} />);
    fireEvent.click(handButton());
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "12" } });
    fireEvent.click(saveButton());

    view.rerender(<InitiativeModal {...base(true, null, onClose)} />);
    expect(saveButton()).toBeDisabled();
    view.rerender(
      <InitiativeModal
        {...base(false, "Initiative update timed out. Please try again.", onClose)}
      />,
    );
    expect(screen.getByText(/timed out/)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(saveButton());
    view.rerender(<InitiativeModal {...base(true, null, onClose)} />);
    view.rerender(<InitiativeModal {...base(false, null, onClose)} />);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
