// Shared props for EntitiesPanel suites written from U7 on. The older suites
// each carry a private copy of this bag; new ones start here instead.

import { vi } from "vitest";
import type React from "react";
import type { Player, SnapshotCharacter } from "@herobyte/shared";
import type { EntitiesPanel } from "../EntitiesPanel";

export type EntitiesPanelTestProps = React.ComponentProps<typeof EntitiesPanel>;

export const DM_UID = "dm-uid";
export const ALICE_UID = "alice-uid";
export const BOB_UID = "bob-uid";

export function seat(uid: string, name: string, extra: Partial<Player> = {}): Player {
  return { uid, name, isDM: false, hp: 10, maxHp: 10, ...extra } as unknown as Player;
}

export function pc(
  id: string,
  name: string,
  owner: string,
  extra: Partial<SnapshotCharacter> = {},
): SnapshotCharacter {
  return {
    id,
    name,
    type: "pc",
    ownedByPlayerUID: owner,
    hp: 10,
    maxHp: 10,
    ...extra,
  } as unknown as SnapshotCharacter;
}

export function npc(
  id: string,
  name: string,
  extra: Partial<SnapshotCharacter> = {},
): SnapshotCharacter {
  return {
    id,
    name,
    type: "npc",
    ownedByPlayerUID: null,
    hp: 7,
    maxHp: 7,
    ...extra,
  } as unknown as SnapshotCharacter;
}

export function entitiesPanelProps(
  overrides: Partial<EntitiesPanelTestProps> = {},
): EntitiesPanelTestProps {
  return {
    players: [],
    characters: [],
    tokens: [],
    sceneObjects: [],
    drawings: [],
    uid: ALICE_UID,
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
    onAddCharacter: vi.fn(),
    onDeleteCharacter: vi.fn(),
    onFocusToken: vi.fn(),
    combatActive: false,
    onSetInitiative: vi.fn(),
    onRollInitiative: vi.fn(),
    ...overrides,
  };
}
