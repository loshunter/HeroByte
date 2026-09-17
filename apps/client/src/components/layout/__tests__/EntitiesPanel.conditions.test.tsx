// Conditions belong to a CHARACTER. A per-player list also exists and predates
// characters, so the cards fell back to it whenever a character carried none —
// which painted a sibling's condition onto every other card the same player
// owned. At the table that means the party reads the wrong combatant as
// poisoned (UX-02).
//
// The fallback is kept only where it cannot be ambiguous: a player with
// exactly one character. That is the same test the by-owner token fallback
// already uses in useCombatOrdering, for the same reason.

import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Player, SnapshotCharacter } from "@herobyte/shared";
import { EntitiesPanel } from "../EntitiesPanel";

const DM = "dm-uid";
const ALICE = "alice-uid";

const alice = (statusEffects?: string[]) =>
  ({
    uid: ALICE,
    name: "Alice",
    isDM: false,
    hp: 10,
    maxHp: 10,
    statusEffects,
  }) as unknown as Player;

const character = (id: string, name: string, statusEffects?: string[]) =>
  ({
    id,
    name,
    type: "pc",
    ownedByPlayerUID: ALICE,
    hp: 10,
    maxHp: 10,
    statusEffects,
  }) as unknown as SnapshotCharacter;

function panelProps(
  players: Player[],
  characters: SnapshotCharacter[],
  overrides: Partial<React.ComponentProps<typeof EntitiesPanel>> = {},
) {
  return {
    players,
    characters,
    tokens: [],
    sceneObjects: [],
    drawings: [],
    uid: ALICE,
    micEnabled: false,
    editingPlayerUID: null,
    nameInput: "",
    editingMaxHpUID: null,
    maxHpInput: "",
    editingTempHpUID: null,
    tempHpInput: "",
    onNameInputChange: vi.fn(),
    onNameEdit: vi.fn(),
    onNameSubmit: vi.fn(),
    onCharacterNameUpdate: vi.fn(),
    onCharacterPortraitUpdate: vi.fn(),
    onToggleMic: vi.fn(),
    onCharacterHpChange: vi.fn(),
    editingHpUID: null,
    hpInput: "",
    onHpInputChange: vi.fn(),
    onHpEdit: vi.fn(),
    onHpSubmit: vi.fn(),
    onMaxHpInputChange: vi.fn(),
    onMaxHpEdit: vi.fn(),
    onMaxHpSubmit: vi.fn(),
    onTempHpInputChange: vi.fn(),
    onTempHpEdit: vi.fn(),
    onTempHpSubmit: vi.fn(),
    currentIsDM: false,
    onToggleDMMode: vi.fn(),
    onTokenImageChange: vi.fn(),
    onApplyPlayerState: vi.fn(),
    _onStatusEffectsChange: vi.fn(),
    onCharacterStatusEffectsChange: vi.fn(),
    onToggleTokenLock: vi.fn(),
    onTokenSizeChange: vi.fn(),
    onCharacterSpeedChange: vi.fn(),
    onCharacterBudgetReset: vi.fn(),
    onAddCharacter: vi.fn(),
    onDeleteCharacter: vi.fn(),
    onFocusToken: vi.fn(),
    combatActive: false,
    onSetInitiative: vi.fn(),
    onRollInitiative: vi.fn(),
    ...overrides,
  };
}

const dm = { uid: DM, name: "The DM", isDM: true, hp: 10, maxHp: 10 } as unknown as Player;

/**
 * Does this card show the named condition? The label appears twice on a card
 * (the status button's tooltip and the badge overlay), so this counts matches
 * rather than demanding exactly one. The button's tooltip joins multiple
 * labels with commas, so an exact-title match still pins the per-badge title.
 */
function shows(cardName: string, label: string): boolean {
  const card = screen.getByText(cardName).closest(".player-card-shell") as HTMLElement;
  return within(card).queryAllByTitle(label).length > 0;
}

describe("EntitiesPanel — whose condition is it", () => {
  it("keeps one character's condition off the sibling that has none", () => {
    // The write path mirrors onto the player too, which is exactly what used
    // to bleed through to the second card.
    render(
      <EntitiesPanel
        {...panelProps(
          [dm, alice(["poisoned"])],
          [
            character("char-ranger", "Ranger", ["poisoned"]),
            character("char-companion", "Companion", undefined),
          ],
        )}
      />,
    );

    expect(shows("Ranger", "Poisoned")).toBe(true);
    expect(shows("Companion", "Poisoned")).toBe(false);
  });

  it("shows each sibling only its own condition when both carry one", () => {
    render(
      <EntitiesPanel
        {...panelProps(
          [dm, alice(["poisoned"])],
          [
            character("char-ranger", "Ranger", ["poisoned"]),
            character("char-companion", "Companion", ["prone"]),
          ],
        )}
      />,
    );

    expect(shows("Ranger", "Poisoned")).toBe(true);
    expect(shows("Ranger", "Prone")).toBe(false);
    expect(shows("Companion", "Prone")).toBe(true);
    expect(shows("Companion", "Poisoned")).toBe(false);
  });

  it("an explicitly empty list is respected, not treated as absent", () => {
    render(
      <EntitiesPanel
        {...panelProps([dm, alice(["poisoned"])], [character("char-solo", "Solo", [])])}
      />,
    );

    expect(shows("Solo", "Poisoned")).toBe(false);
  });

  it("still shows a lone character the legacy player-level list", () => {
    // A table written before conditions moved onto characters keeps them on
    // the player. With one character they are unambiguously that character's,
    // so dropping the fallback outright would have hidden them.
    render(
      <EntitiesPanel
        {...panelProps([dm, alice(["prone"])], [character("char-solo", "Solo", undefined)])}
      />,
    );

    expect(shows("Solo", "Prone")).toBe(true);
  });
});
