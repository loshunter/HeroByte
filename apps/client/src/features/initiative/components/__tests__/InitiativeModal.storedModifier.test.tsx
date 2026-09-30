// The modifier the dialog rolls and saves with is the character's STORED one
// until the viewer changes the dial. It read the stored value once, at open:
// a change made meanwhile (the DM's Init Mod, the owner elsewhere) was then
// written back over by this dialog's Roll or Save.

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SnapshotCharacter } from "@herobyte/shared";
import { InitiativeModal } from "../InitiativeModal";

vi.mock("../../../juice", () => ({ useSfx: () => ({ play: vi.fn() }) }));

afterEach(cleanup);

const hero = (initiativeModifier: number) =>
  ({ id: "hero", name: "Hero", type: "pc", initiativeModifier }) as SnapshotCharacter;

describe("InitiativeModal — the stored modifier", () => {
  it("follows a change made elsewhere while the dialog is open, and leaves it to the server", () => {
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

    // Untouched, the dial sends nothing: the server rolls with its stored +5,
    // even one changed after the dialog last read it.
    expect(onRollInitiative).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it("once the viewer moves the dial, keeps their value over a change made elsewhere", () => {
    const onRollInitiative = vi.fn();
    const props = (modifier: number) => ({
      character: hero(modifier),
      onClose: vi.fn(),
      onSetInitiative: vi.fn(),
      onRollInitiative,
    });
    const view = render(<InitiativeModal {...props(2)} />);
    const dial = screen.getByTestId("initiative-modifier-dial");
    // jsdom has neither pointer capture nor PointerEvent; the dial reads clientX.
    dial.setPointerCapture = vi.fn();
    dial.releasePointerCapture = vi.fn();
    act(() => {
      dial.dispatchEvent(new MouseEvent("pointerdown", { clientX: 100, bubbles: true }));
      document.dispatchEvent(new MouseEvent("pointermove", { clientX: 110, bubbles: true }));
    });
    fireEvent.pointerUp(document);
    expect(dial.textContent).toBe("+3");

    view.rerender(<InitiativeModal {...props(5)} />);
    expect(screen.getByTestId("initiative-modifier-dial").textContent).toBe("+3");
    fireEvent.click(screen.getByRole("button", { name: /^Roll/ }));

    expect(onRollInitiative).toHaveBeenCalledExactlyOnceWith(3);
  });
});
