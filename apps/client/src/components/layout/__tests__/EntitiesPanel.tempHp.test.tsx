// Temporary HP belongs to a CHARACTER, like its HP and conditions. The Temp HP
// field writes `update-character-hp` with the character's id, but the desktop
// card displayed the player-level value — so what a player entered never
// showed, and dragging the bar sent the player-level value back as the
// character's. The player-level value is legacy; it is only attributable when
// the player owns one character (the conditions rule, UX-02).

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { EntitiesPanel } from "../EntitiesPanel";
import { ALICE_UID, DM_UID, entitiesPanelProps, pc, seat } from "./entitiesPanel.fixtures";

const dm = seat(DM_UID, "The DM", { isDM: true });

function card(name: string): HTMLElement {
  return screen.getByText(name).closest(".player-card-shell") as HTMLElement;
}

describe("EntitiesPanel — whose temporary HP is it", () => {
  it("shows the character's own temporary HP", () => {
    render(
      <EntitiesPanel
        {...entitiesPanelProps({
          players: [dm, seat(ALICE_UID, "Alice")],
          characters: [pc("char-ranger", "Ranger", ALICE_UID, { tempHp: 5 })],
        })}
      />,
    );

    expect(within(card("Ranger")).getByText("10 (+5)")).toBeInTheDocument();
  });

  it("keeps a legacy player-level value off a second character", () => {
    render(
      <EntitiesPanel
        {...entitiesPanelProps({
          players: [dm, seat(ALICE_UID, "Alice", { tempHp: 3 })],
          characters: [
            pc("char-ranger", "Ranger", ALICE_UID, { tempHp: 5 }),
            pc("char-companion", "Companion", ALICE_UID),
          ],
        })}
      />,
    );

    expect(within(card("Ranger")).getByText("10 (+5)")).toBeInTheDocument();
    expect(within(card("Companion")).queryByText(/\(\+3\)/)).toBeNull();
    expect(within(card("Companion")).getAllByText("10").length).toBeGreaterThan(0);
  });

  it("still shows a lone character the legacy player-level value", () => {
    render(
      <EntitiesPanel
        {...entitiesPanelProps({
          players: [dm, seat(ALICE_UID, "Alice", { tempHp: 3 })],
          characters: [pc("char-solo", "Solo", ALICE_UID)],
        })}
      />,
    );

    expect(within(card("Solo")).getByText("10 (+3)")).toBeInTheDocument();
  });

  it("dragging the bar sends the character's temporary HP, not the player's", () => {
    const onCharacterHpChange = vi.fn();
    render(
      <EntitiesPanel
        {...entitiesPanelProps({
          players: [dm, seat(ALICE_UID, "Alice", { tempHp: 3 })],
          characters: [
            pc("char-ranger", "Ranger", ALICE_UID, { tempHp: 5 }),
            pc("char-companion", "Companion", ALICE_UID),
          ],
          onCharacterHpChange,
        })}
      />,
    );

    const bar = card("Ranger").querySelector(".jrpg-hp-bar") as HTMLElement;
    fireEvent.mouseDown(bar, { clientX: 0 });
    fireEvent.mouseUp(document);

    expect(onCharacterHpChange).toHaveBeenCalled();
    expect(onCharacterHpChange.mock.calls[0][0]).toBe("char-ranger");
    expect(onCharacterHpChange.mock.calls[0][3]).toBe(5);
  });
});
