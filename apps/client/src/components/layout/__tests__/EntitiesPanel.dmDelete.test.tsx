/**
 * EntitiesPanel — a DM may delete any character
 *
 * The server always allowed a DM to delete another player's character (with
 * its token), but the card only offered Delete to the character's own player,
 * so an abandoned seat — a player who started a fresh session, say — could
 * never be cleared from a private table by anyone. Delete is now gated like
 * every other DM-capable control on the card: the owner, or the DM.
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Player, SnapshotCharacter } from "@herobyte/shared";
import { EntitiesPanel } from "../EntitiesPanel";

const DM = "dm-uid";
const ALICE = "alice-uid";
const CAROL = "carol-uid";

const players = [
  { uid: DM, name: "The DM", isDM: true, hp: 10, maxHp: 10 },
  { uid: ALICE, name: "Alice", isDM: false, hp: 10, maxHp: 10 },
  { uid: CAROL, name: "Carol", isDM: false, hp: 10, maxHp: 10 },
] as unknown as Player[];

const alice = {
  id: "char-alice",
  name: "Alice",
  type: "pc",
  ownedByPlayerUID: ALICE,
  hp: 10,
  maxHp: 10,
} as unknown as SnapshotCharacter;

function panelProps(overrides: Partial<React.ComponentProps<typeof EntitiesPanel>> = {}) {
  return {
    players,
    characters: [alice],
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

/** The settings window opens from the portrait button, which only an editor has. */
function settingsButtonOf(name: string): HTMLButtonElement | null {
  const card = screen.getByText(name).closest(".player-card-shell")!;
  return card.querySelector('button[aria-label="Change portrait"]');
}

const deleteButton = () => screen.queryByRole("button", { name: /Delete this character/ });

describe("EntitiesPanel — who may delete a character", () => {
  it("the DM gets Delete on another player's card, and it names that character", () => {
    const onDeleteCharacter = vi.fn();
    render(<EntitiesPanel {...panelProps({ uid: DM, currentIsDM: true, onDeleteCharacter })} />);

    fireEvent.click(settingsButtonOf("Alice")!);
    fireEvent.click(deleteButton()!);

    expect(onDeleteCharacter).toHaveBeenCalledWith("char-alice");
  });

  it("a co-DM gets it on another DM's card too — the DM section is gated the same way", () => {
    // DM players' characters render in their own pinned section, a second
    // call site with the same gate; a co-DM viewing a DM's card goes through it.
    const onDeleteCharacter = vi.fn();
    const coDm = { uid: "codm-uid", name: "Co-DM", isDM: true, hp: 10, maxHp: 10 };
    const dmCharacter = {
      id: "char-dm",
      name: "The DM",
      type: "pc",
      ownedByPlayerUID: DM,
      hp: 10,
      maxHp: 10,
    } as unknown as SnapshotCharacter;
    render(
      <EntitiesPanel
        {...panelProps({
          players: [...players, coDm] as unknown as Player[],
          characters: [dmCharacter, alice],
          uid: "codm-uid",
          currentIsDM: true,
          onDeleteCharacter,
        })}
      />,
    );

    fireEvent.click(settingsButtonOf("The DM")!);
    fireEvent.click(deleteButton()!);

    expect(onDeleteCharacter).toHaveBeenCalledWith("char-dm");
  });

  it("the owner still gets it on their own card", () => {
    render(<EntitiesPanel {...panelProps({ uid: ALICE })} />);

    fireEvent.click(settingsButtonOf("Alice")!);

    expect(deleteButton()).toBeInTheDocument();
  });

  it("another player cannot even open Alice's settings window", () => {
    render(<EntitiesPanel {...panelProps({ uid: CAROL })} />);

    // The window's own gate (no onDeleteCharacter → no button) is pinned in
    // PlayerSettingsMenu.delete.test.tsx; here the door is shut before it.
    expect(settingsButtonOf("Alice")).toBeNull();
    expect(deleteButton()).not.toBeInTheDocument();
  });
});
