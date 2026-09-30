// The modifier the dialog rolls and saves with is the character's STORED one
// until the viewer changes the dial. It read the stored value once, at open:
// a change made meanwhile (the DM's Init Mod, the owner elsewhere) was then
// written back over by this dialog's Roll or Save.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SnapshotCharacter } from "@herobyte/shared";
import { InitiativeModal } from "../InitiativeModal";

vi.mock("../../../juice", () => ({ useSfx: () => ({ play: vi.fn() }) }));

afterEach(cleanup);

const hero = (initiativeModifier: number) =>
  ({ id: "hero", name: "Hero", type: "pc", initiativeModifier }) as SnapshotCharacter;

describe("InitiativeModal — the stored modifier", () => {
  it("follows a change made elsewhere while the dialog is open", () => {
    const onRollInitiative = vi.fn();
    const props = (modifier: number) => ({
      character: hero(modifier),
      onClose: vi.fn(),
      onSetInitiative: vi.fn(),
      onRollInitiative,
    });
    const view = render(<InitiativeModal {...props(2)} />);
    expect(screen.getByTestId("initiative-modifier-dial").textContent).toBe("+2");

    view.rerender(<InitiativeModal {...props(5)} />);
    expect(screen.getByTestId("initiative-modifier-dial").textContent).toBe("+5");
    fireEvent.click(screen.getByRole("button", { name: /^Roll/ }));

    expect(onRollInitiative).toHaveBeenCalledWith(5);
  });
});
