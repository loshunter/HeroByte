// Test fixtures for Encounter (U8): a complete EncounterControls whose every
// send is a spy, and small character/seat builders.

import { vi } from "vitest";
import type { Player, SnapshotCharacter } from "@herobyte/shared";
import type { EncounterControls } from "../encounterControls";
import type { InitiativeSetting } from "../../../hooks/useInitiativeSetting";

export const DM_UID = "dm-uid";
export const ALICE_UID = "alice-uid";

export const seat = (uid: string, name: string, isDM = false): Player =>
  ({ uid, name, isDM }) as Player;

export const npc = (
  id: string,
  name: string,
  extra: Partial<SnapshotCharacter> = {},
): SnapshotCharacter => ({ id, name, type: "npc", hp: 7, maxHp: 7, ...extra }) as SnapshotCharacter;

export const pc = (
  id: string,
  name: string,
  owner: string,
  extra: Partial<SnapshotCharacter> = {},
): SnapshotCharacter =>
  ({
    id,
    name,
    type: "pc",
    ownedByPlayerUID: owner,
    hp: 20,
    maxHp: 20,
    ...extra,
  }) as SnapshotCharacter;

export function initiativeSpies(): InitiativeSetting {
  return {
    isSetting: false,
    error: null,
    setInitiative: vi.fn(),
    clearInitiative: vi.fn(),
    rollInitiative: vi.fn(),
    rollAllInitiative: vi.fn(),
  };
}

export function encounterControls(overrides: Partial<EncounterControls> = {}): EncounterControls {
  return {
    characters: [],
    players: [seat(DM_UID, "The DM", true)],
    uid: DM_UID,
    combatActive: false,
    currentTurnCharacterId: undefined,
    monsterHpDisplay: "exact",
    onMonsterHpDisplayChange: vi.fn(),
    onStartCombat: vi.fn(),
    onEndCombat: vi.fn(),
    onClearAllInitiative: vi.fn(),
    onNextTurn: vi.fn(),
    onPreviousTurn: vi.fn(),
    initiative: initiativeSpies(),
    playersMayEnterByHand: true,
    mapTokenIds: new Set<string>(),
    onFocusToken: vi.fn(),
    ...overrides,
  };
}
