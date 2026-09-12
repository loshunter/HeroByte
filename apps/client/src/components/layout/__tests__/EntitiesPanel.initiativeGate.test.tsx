// The initiative badge opens the modal only where the server would accept the
// roll: your own card, or any card for a DM. It used to be offered on every
// card to every viewer — the server refused, `rollInitiative` is fire-and-
// forget, and hand entry waited its full 5 s before reporting a timeout.
// And it still READS on every card: the number is drawn nowhere else, so the
// first cut of this gate (badge hidden without a handler) took every other
// combatant's initiative away from a player.

import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
} as unknown as SnapshotCharacter;
const sidekick = {
  ...alice,
  id: "char-sidekick",
  name: "Sidekick",
  ownedByPlayerUID: DM,
} as unknown as SnapshotCharacter;
const ogre = {
  id: "npc-ogre",
  name: "Ogre",
  type: "npc",
  hp: 30,
  maxHp: 30,
  visibleToPlayers: true,
} as unknown as SnapshotCharacter;

function panelProps(overrides: Partial<React.ComponentProps<typeof EntitiesPanel>> = {}) {
  const noop = vi.fn();
  return {
    players,
    characters: [alice, sidekick, ogre],
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
    currentIsDM: false,
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
    combatActive: false,
    onSetInitiative: noop,
    onRollInitiative: noop,
    ...overrides,
  };
}

const cardOf = (name: string) => screen.getByText(name).closest(".player-card")!;
const initButton = (name: string) =>
  within(cardOf(name) as HTMLElement).queryByRole("button", { name: "Set Initiative" });

describe("EntitiesPanel — the initiative badge reads for everyone", () => {
  it("a player sees every rolled card's number — the DM's ally's and a monster's — with only their own live", () => {
    render(
      <EntitiesPanel
        {...panelProps({
          characters: [
            { ...alice, initiative: 12 },
            { ...sidekick, initiative: 20 },
            { ...ogre, initiative: 18 },
          ],
          combatActive: true,
        })}
      />,
    );
    expect(within(cardOf("Sidekick") as HTMLElement).getByText("20")).toBeInTheDocument();
    expect(within(cardOf("Ogre") as HTMLElement).getByText("18")).toBeInTheDocument();
    expect(within(cardOf("Alice") as HTMLElement).getByText("12")).toBeInTheDocument();
    expect(initButton("Alice")).not.toBeNull();
    expect(initButton("Sidekick")).toBeNull();
    expect(initButton("Ogre")).toBeNull();
    // The read-only badge is inert: disabled, and named by its value.
    const readOnly = within(cardOf("Sidekick") as HTMLElement).getByRole("button", {
      name: "Initiative 20",
    });
    expect(readOnly).toBeDisabled();
  });
});

describe("EntitiesPanel — who may open the initiative modal", () => {
  it("a player: their own card only — not the DM's character, not a monster", () => {
    render(<EntitiesPanel {...panelProps()} />);
    expect(initButton("Alice")).not.toBeNull();
    expect(initButton("Sidekick")).toBeNull();
    expect(initButton("Ogre")).toBeNull();
  });

  it("the DM: every card", () => {
    render(<EntitiesPanel {...panelProps({ uid: DM, currentIsDM: true })} />);
    expect(initButton("Alice")).not.toBeNull();
    expect(initButton("Sidekick")).not.toBeNull();
    expect(initButton("Ogre")).not.toBeNull();
  });
});
