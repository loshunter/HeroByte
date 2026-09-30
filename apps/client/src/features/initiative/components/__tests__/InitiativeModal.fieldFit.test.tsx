// The hand-entry field fits its column. It was `width: 100%` with 8px padding
// and a 2px border on a content-box, so it ran 20px past the dialog's column —
// past the screen's edge on a 375px phone. jsdom lays nothing out, so this pins
// the rule that makes it fit; the phone browser spec measures the box.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SnapshotCharacter } from "@herobyte/shared";
import { InitiativeModal } from "../InitiativeModal";

vi.mock("../../../juice", () => ({ useSfx: () => ({ play: vi.fn() }) }));

afterEach(cleanup);

const hero = { id: "hero", name: "Hero", type: "pc", initiativeModifier: 0 } as SnapshotCharacter;

describe("InitiativeModal — the hand-entry field", () => {
  it("keeps its padding and border inside its full width", () => {
    render(
      <InitiativeModal
        character={hero}
        onClose={vi.fn()}
        onSetInitiative={vi.fn()}
        onRollInitiative={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Physical Dice|by hand/i }));
    const field = screen.getByPlaceholderText("Enter roll...");

    expect(field.style.width).toBe("100%");
    expect(field.style.boxSizing).toBe("border-box");
  });
});
