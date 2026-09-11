// The desktop party panel's movement-budget reset (F2): the DM viewing a
// PLAYER's card gets the readout and a reset bound to that character; a
// player never does; and the control exists where the plate shows a budget —
// in combat, for a combatant in the order — or wherever there is a spend to
// clear. The DM-section render site (a DM's OWN character) is reachable today
// only through that spend clause: a DM-owned PC is not a combatant under
// today's participation rule (F3 widens it), but the server charges its token
// like any other, and this is the only lever that clears that spend.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
  movementUsed: 10,
} as unknown as SnapshotCharacter;

function panelProps(overrides: Partial<React.ComponentProps<typeof EntitiesPanel>> = {}) {
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
    currentIsDM: true,
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
    combatActive: true,
    onSetInitiative: vi.fn(),
    onRollInitiative: vi.fn(),
    ...overrides,
  };
}

function openSettingsOf(name: string) {
  const card = screen.getByText(name).closest(".player-card-shell")!;
  fireEvent.click(card.querySelector('button[aria-label="Change portrait"]')!);
}
const openAliceSettings = () => openSettingsOf("Alice");

// The DM's OWN character: it renders through the DM section, not the player
// section — a separate copy of the gate.
const sidekick = {
  ...alice,
  id: "char-sidekick",
  name: "Sidekick",
  ownedByPlayerUID: DM,
} as unknown as SnapshotCharacter;

describe("EntitiesPanel — the movement-budget reset on a player's card", () => {
  it("the DM reads the spend and the reset names the character", () => {
    const props = panelProps();
    render(<EntitiesPanel {...props} />);
    openAliceSettings();
    expect(screen.getByText("Used 10 ft")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset movement budget" }));
    expect(props.onCharacterBudgetReset).toHaveBeenCalledWith("char-alice");
  });

  it("a player viewing the same card never sees it, handler or not", () => {
    render(<EntitiesPanel {...panelProps({ currentIsDM: false, uid: ALICE })} />);
    openAliceSettings();
    // The menu did open (its name field is there) — the absence is the gate's,
    // not a closed menu's.
    expect(screen.getByText("Character Name")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset movement budget" })).toBeNull();
  });

  it("only where the plate shows a budget: not out of combat, not without an initiative", () => {
    const { unmount } = render(<EntitiesPanel {...panelProps({ combatActive: false })} />);
    openAliceSettings();
    expect(screen.getByLabelText("Movement speed in feet per turn")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset movement budget" })).toBeNull();
    unmount();
    render(
      <EntitiesPanel
        {...panelProps({ characters: [{ ...alice, initiative: undefined, movementUsed: 0 }] })}
      />,
    );
    openAliceSettings();
    expect(screen.getByLabelText("Movement speed in feet per turn")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset movement budget" })).toBeNull();
  });

  it("… but a SPEND with no initiative still gets it: the server charges any token moved in combat", () => {
    const props = panelProps({
      characters: [{ ...alice, initiative: undefined, movementUsed: 20 }],
    });
    render(<EntitiesPanel {...props} />);
    openAliceSettings();
    expect(screen.getByText("Used 20 ft")).toBeInTheDocument();
    const reset = screen.getByRole("button", { name: "Reset movement budget" });
    expect(reset).toBeEnabled();
    fireEvent.click(reset);
    expect(props.onCharacterBudgetReset).toHaveBeenCalledWith("char-alice");
  });
});

describe("EntitiesPanel — the DM section's copy of the gate (the DM's own character)", () => {
  it("in the order but no combatant (today's rule) and nothing spent: no control", () => {
    render(
      <EntitiesPanel
        {...panelProps({ characters: [{ ...sidekick, initiative: 20, movementUsed: 0 }] })}
      />,
    );
    openSettingsOf("Sidekick");
    expect(screen.getByLabelText("Movement speed in feet per turn")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset movement budget" })).toBeNull();
  });

  it("a spend on the DM's own token gets the lever — the only thing that clears it short of ending combat", () => {
    const props = panelProps({
      characters: [{ ...sidekick, initiative: undefined, movementUsed: 15 }],
    });
    render(<EntitiesPanel {...props} />);
    openSettingsOf("Sidekick");
    expect(screen.getByText("Used 15 ft")).toBeInTheDocument();
    const reset = screen.getByRole("button", { name: "Reset movement budget" });
    expect(reset).toBeEnabled();
    fireEvent.click(reset);
    expect(props.onCharacterBudgetReset).toHaveBeenCalledWith("char-sidekick");
  });
});
