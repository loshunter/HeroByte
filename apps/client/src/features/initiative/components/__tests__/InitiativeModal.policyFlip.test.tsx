// A hand entry already open must not outlive the table's permission for it.
// The DM can turn "Players can enter rolls by hand" off while a player's dialog
// is open (or a DM can leave DM mode over their own character's dialog): the
// server then refuses a hand-entered value without a word, so a field left
// usable led to five seconds of "Setting..." and a timeout.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SnapshotCharacter } from "@herobyte/shared";
import { InitiativeModal } from "../InitiativeModal";

vi.mock("../../../juice", () => ({ useSfx: () => ({ play: vi.fn() }) }));

afterEach(cleanup);

const hero = { id: "hero", name: "Hero", type: "pc", initiativeModifier: 0 } as SnapshotCharacter;
const base = (manualEntryAllowed: boolean, onSetInitiative = vi.fn()) => ({
  character: hero,
  onClose: vi.fn(),
  onSetInitiative,
  onRollInitiative: vi.fn(),
  manualEntryAllowed,
  combatActive: true,
});

// Named for both the old and the new words ("Use Physical Dice" / "Enter a roll by hand").
const handButton = () => screen.getByRole("button", { name: /Physical Dice|by hand/i });

describe("InitiativeModal — hand entry after the table turns it off", () => {
  it("the open field goes, and nothing is left to save", () => {
    const onSetInitiative = vi.fn();
    const view = render(<InitiativeModal {...base(true, onSetInitiative)} />);
    fireEvent.click(handButton());
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "15" } });

    view.rerender(<InitiativeModal {...base(false, onSetInitiative)} />);

    expect(screen.queryByRole("spinbutton")).toBeNull();
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onSetInitiative).not.toHaveBeenCalled();
  });

  it("turned back on, the field starts empty rather than resurrecting the old number", () => {
    const view = render(<InitiativeModal {...base(true)} />);
    fireEvent.click(handButton());
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "15" } });

    view.rerender(<InitiativeModal {...base(false)} />);
    view.rerender(<InitiativeModal {...base(true)} />);

    expect(screen.queryByRole("spinbutton")).toBeNull();
  });
});
