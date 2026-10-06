/**
 * EntitiesPanel — a DM's fields hold through a reconnect blip
 *
 * Every socket close nulls the snapshot, and the DM flag reads false with it
 * while the cards keep painting the cached roster. ae66c184 kept the settings
 * WINDOW open through that blip, but the DM-only fields inside it (speed, sight,
 * owner, Token Lock, Delete Token) were gated on the bare flag: they unmounted,
 * and a half-typed value was gone when they came back. They now hold the role
 * the roster last confirmed until it confirms again — and a player's window
 * does not flash them.
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render as rtlRender, screen } from "@testing-library/react";
import type { Player, SnapshotCharacter } from "@herobyte/shared";
import { EntitiesPanel } from "../EntitiesPanel";
import { RoleKnownContext } from "../../../features/table/roleKnown";
import { showCards } from "./entitiesPanel.fixtures";

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
    onTokenImageChange: vi.fn(),
    onApplyPlayerState: vi.fn(),
    _onStatusEffectsChange: vi.fn(),
    onCharacterStatusEffectsChange: vi.fn(),
    onToggleTokenLock: vi.fn(),
    onTokenSizeChange: vi.fn(),
    onCharacterOwnerChange: vi.fn(),
    onCharacterSpeedChange: vi.fn(),
    onCharacterBudgetReset: vi.fn(),
    onAddCharacter: vi.fn(),
    onDeleteCharacter: vi.fn(),
    onFocusToken: vi.fn(),
    launcherDockRef: vi.fn(),
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

const speedField = () => screen.queryByLabelText("Movement speed in feet per turn");

function mount(roleKnown: boolean, props: Partial<React.ComponentProps<typeof EntitiesPanel>>) {
  const view = rtlRender(
    <RoleKnownContext.Provider value={roleKnown}>
      <EntitiesPanel {...panelProps(props)} />
    </RoleKnownContext.Provider>,
  );
  showCards();
  return {
    ...view,
    update: (known: boolean, next: Partial<React.ComponentProps<typeof EntitiesPanel>>) =>
      view.rerender(
        <RoleKnownContext.Provider value={known}>
          <EntitiesPanel {...panelProps(next)} />
        </RoleKnownContext.Provider>,
      ),
  };
}

describe("EntitiesPanel — the DM's fields through a reconnect blip", () => {
  it("a half-typed speed survives the blip; a confirmed demotion still takes the field", () => {
    const view = mount(true, { uid: DM, currentIsDM: true });
    fireEvent.click(settingsButtonOf("Alice")!);
    fireEvent.change(speedField()!, { target: { value: "3" } });

    // The blip: the role is unknown and the bare flag reads false.
    view.update(false, { uid: DM, currentIsDM: false });
    expect(speedField()).toHaveValue(3);

    // The roster says this seat is the DM again: nothing was lost.
    view.update(true, { uid: DM, currentIsDM: true });
    expect(speedField()).toHaveValue(3);

    // A real demotion (the role known, and not the DM) still removes it.
    view.update(true, { uid: DM, currentIsDM: false });
    expect(speedField()).toBeNull();
  });

  it("a player's own window does not flash the DM's fields during a blip", () => {
    const view = mount(true, { uid: ALICE, currentIsDM: false });
    fireEvent.click(settingsButtonOf("Alice")!);
    expect(speedField()).toBeNull();
    view.update(false, { uid: ALICE, currentIsDM: false });
    expect(speedField()).toBeNull();
  });
});
