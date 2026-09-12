// The combat banner's turn counter: "Turn N of M" indexes the card wearing the
// current-turn mark; while NO card does (the pointer was dropped — a combatant
// cleared its own initiative on its turn), it must not claim turn 1.

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Player, SnapshotCharacter } from "@herobyte/shared";
import { EntitiesPanel } from "../EntitiesPanel";

const DM = "dm-uid";
const ALICE = "alice-uid";
const players = [
  { uid: DM, name: "The DM", isDM: true, hp: 10, maxHp: 10 },
  { uid: ALICE, name: "Alice", isDM: false, hp: 10, maxHp: 10 },
] as unknown as Player[];
const alice = {
  id: "char-alice",
  name: "Alice",
  type: "pc",
  ownedByPlayerUID: ALICE,
  hp: 10,
  maxHp: 10,
  initiative: 12,
} as unknown as SnapshotCharacter;

function panelProps(overrides: Partial<React.ComponentProps<typeof EntitiesPanel>> = {}) {
  const noop = vi.fn();
  return {
    players,
    characters: [alice],
    tokens: [],
    sceneObjects: [],
    drawings: [],
    uid: DM,
    micEnabled: false,
    editingPlayerUID: null,
    nameInput: "",
    editingMaxHpUID: null,
    maxHpInput: "",
    editingTempHpUID: null,
    tempHpInput: "",
    onNameInputChange: noop,
    onNameEdit: noop,
    onNameSubmit: noop,
    onCharacterNameUpdate: noop,
    onCharacterPortraitUpdate: noop,
    onToggleMic: noop,
    onCharacterHpChange: noop,
    editingHpUID: null,
    hpInput: "",
    onHpInputChange: noop,
    onHpEdit: noop,
    onHpSubmit: noop,
    onMaxHpInputChange: noop,
    onMaxHpEdit: noop,
    onMaxHpSubmit: noop,
    onTempHpInputChange: noop,
    onTempHpEdit: noop,
    onTempHpSubmit: noop,
    currentIsDM: true,
    onToggleDMMode: noop,
    onTokenImageChange: noop,
    onApplyPlayerState: noop,
    _onStatusEffectsChange: noop,
    onCharacterStatusEffectsChange: noop,
    onToggleTokenLock: noop,
    onTokenSizeChange: noop,
    onAddCharacter: noop,
    onDeleteCharacter: noop,
    onFocusToken: noop,
    combatActive: true,
    onSetInitiative: noop,
    onRollInitiative: noop,
    ...overrides,
  };
}

describe("EntitiesPanel — the combat banner's turn counter", () => {
  it("indexes the card that holds the turn", () => {
    render(<EntitiesPanel {...panelProps({ currentTurnCharacterId: "char-alice" })} />);
    expect(screen.getByText(/Turn 1 of 1/)).toBeInTheDocument();
  });

  it("counts the DM's rolled character (F3) in the denominator and lands the index on it", () => {
    const sidekick = {
      ...alice,
      id: "char-sidekick",
      name: "Sidekick",
      ownedByPlayerUID: DM,
      initiative: 20,
    } as unknown as SnapshotCharacter;
    render(
      <EntitiesPanel
        {...panelProps({ characters: [alice, sidekick], currentTurnCharacterId: "char-sidekick" })}
      />,
    );
    expect(screen.getByText(/Turn 1 of 2/)).toBeInTheDocument();
  });

  it("reads — while nobody holds the turn, not turn 1", () => {
    render(<EntitiesPanel {...panelProps({ currentTurnCharacterId: undefined })} />);
    expect(screen.getByText(/Turn — of 1/)).toBeInTheDocument();
    expect(screen.queryByText(/Turn 1 of 1/)).toBeNull();
  });
});
