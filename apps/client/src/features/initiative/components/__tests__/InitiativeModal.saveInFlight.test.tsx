// While the dialog's OWN save is in flight nothing may override it: Roll sent
// a roll-initiative right behind the pending set-initiative, and a click on
// the backdrop closed the dialog on a request still waiting for its answer.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SnapshotCharacter } from "@herobyte/shared";
import { InitiativeModal } from "../InitiativeModal";

vi.mock("../../../juice", () => ({ useSfx: () => ({ play: vi.fn() }) }));

afterEach(cleanup);

const hero = { id: "hero", name: "Hero", type: "pc", initiativeModifier: 0 } as SnapshotCharacter;

describe("InitiativeModal — its own save in flight", () => {
  it("disables Roll and the hand entry, and a backdrop click does not close it", () => {
    const onClose = vi.fn();
    const onRollInitiative = vi.fn();
    const props = (isLoading: boolean) => ({
      character: hero,
      onClose,
      onSetInitiative: vi.fn(),
      onRollInitiative,
      isLoading,
      error: null,
    });
    const view = render(<InitiativeModal {...props(false)} />);
    fireEvent.click(screen.getByRole("button", { name: /Physical Dice|by hand/i }));
    fireEvent.change(screen.getByPlaceholderText("Enter roll..."), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));
    view.rerender(<InitiativeModal {...props(true)} />);

    const roll = screen.getByRole("button", { name: /^Roll/ });
    expect(roll).toBeDisabled();
    // The value being saved cannot be edited or wiped under the save.
    expect(screen.getByPlaceholderText("Enter roll...")).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: /Physical Dice|by hand/i })).toBeDisabled();
    fireEvent.click(roll);
    fireEvent.click(document.querySelector("[data-modal-overlay]") as HTMLElement);

    expect(onRollInitiative).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
