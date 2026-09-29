// A seat's player-level portrait is legacy, like its conditions and temp HP:
// attributable only to the player's SOLE character (UX-02). With two, a
// character with no art of its own wore the seat's old portrait as if it were
// its own.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EntitiesPanel } from "../EntitiesPanel";
import { ALICE_UID, entitiesPanelProps, pc, seat } from "./entitiesPanel.fixtures";

afterEach(cleanup);

function renderCards(characters: ReturnType<typeof pc>[]) {
  const players = [seat(ALICE_UID, "Alice", { portrait: "https://example.test/seat.png" })];
  render(<EntitiesPanel {...entitiesPanelProps({ players, characters })} />);
  // Every card at once (the compact roster, where the Party has one, hides them).
  const cards = screen.queryByRole("button", { name: "▦ Cards" });
  if (cards) fireEvent.click(cards);
}

const seatPortraits = () => document.querySelectorAll('img[src="https://example.test/seat.png"]');

describe("EntitiesPanel — the seat's portrait", () => {
  it("is a sole character's fallback", () => {
    renderCards([pc("char-ranger", "Ranger", ALICE_UID)]);

    expect(seatPortraits()).toHaveLength(1);
  });

  it("is nobody's once the seat has two characters", () => {
    renderCards([
      pc("char-ranger", "Ranger", ALICE_UID),
      pc("char-companion", "Companion", ALICE_UID),
    ]);

    expect(seatPortraits()).toHaveLength(0);
  });
});
