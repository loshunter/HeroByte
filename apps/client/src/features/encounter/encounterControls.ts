// ============================================================================
// ENCOUNTER CONTROLS
// ============================================================================
// Everything the Encounter tab reads and sends, as ONE required object (U8):
// the DM menu cannot mount Encounter with a control silently unwired, the way
// a dozen optional props could be. Built once, in DMMenuContainer.

import type { MonsterHpDisplay, Player, RoomSnapshot, SnapshotCharacter } from "@herobyte/shared";
import type { InitiativeSetting } from "../../hooks/useInitiativeSetting";
import { manualInitiativeEnabled } from "../initiative/manualOverride";

export interface EncounterControls {
  characters: SnapshotCharacter[];
  players: Player[];
  /** The viewer's uid (the shared initiative dialog's owner rule). */
  uid: string;
  combatActive: boolean;
  currentTurnCharacterId: string | undefined;
  monsterHpDisplay: MonsterHpDisplay;
  onMonsterHpDisplayChange: (mode: MonsterHpDisplay) => void;
  onStartCombat: () => void;
  onEndCombat: () => void;
  onClearAllInitiative: () => void;
  onNextTurn: () => void;
  onPreviousTurn: () => void;
  /** The caller's one useInitiativeSetting: per-character roll/set/clear and the bulk roll. */
  initiative: InitiativeSetting;
  /** The table policy (DM Menu → Table → Permissions): may players enter a roll by hand. */
  playersMayEnterByHand: boolean;
  /** Tokens on the current map: a participant's Focus needs its token here. */
  mapTokenIds: ReadonlySet<string>;
  onFocusToken: (tokenId: string) => void;
}

/** The combat senders useDMContext already owns (the same ones Players used). */
export interface CombatSenders {
  handleStartCombat: () => void;
  handleEndCombat: () => void;
  handleClearAllInitiative: () => void;
  handleNextTurn: () => void;
  handlePreviousTurn: () => void;
  handleSetMonsterHpDisplay: (mode: MonsterHpDisplay) => void;
}

export function buildEncounterControls(
  snapshot: RoomSnapshot | null,
  combat: CombatSenders,
  wiring: Pick<EncounterControls, "uid" | "initiative" | "mapTokenIds" | "onFocusToken">,
): EncounterControls {
  return {
    characters: snapshot?.characters ?? [],
    players: snapshot?.players ?? [],
    combatActive: snapshot?.combatActive ?? false,
    currentTurnCharacterId: snapshot?.currentTurnCharacterId,
    monsterHpDisplay: snapshot?.monsterHpDisplay ?? "exact",
    onMonsterHpDisplayChange: combat.handleSetMonsterHpDisplay,
    onStartCombat: combat.handleStartCombat,
    onEndCombat: combat.handleEndCombat,
    onClearAllInitiative: combat.handleClearAllInitiative,
    onNextTurn: combat.handleNextTurn,
    onPreviousTurn: combat.handlePreviousTurn,
    // A named rule, not `?? false`: the flag defaults ON (manualOverride.ts).
    playersMayEnterByHand: manualInitiativeEnabled(snapshot),
    ...wiring,
  };
}
