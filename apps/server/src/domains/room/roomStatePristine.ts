// ============================================================================
// ROOM STATE — PRISTINE CHECK
// ============================================================================
// Its own module rather than a line in model.ts, which sits close enough to the
// 350-LOC guardrail that adding a predicate to it trips the structure gate.

import type { RoomState } from "./model.js";

/**
 * True when a room holds nothing a person put there — nothing worth clearing.
 *
 * Deliberately ignores `users`/`pointers` (live connection chatter, empty
 * whenever nobody is connected) and `stateVersion` (a monotonic counter that
 * never returns to 0 once touched, so comparing it would make an already-clean
 * room look dirty forever and re-wipe it on every sweep).
 */
export function isRoomStatePristine(state: RoomState): boolean {
  return (
    state.tokens.length === 0 &&
    state.players.length === 0 &&
    state.characters.length === 0 &&
    state.props.length === 0 &&
    state.drawings.length === 0 &&
    state.sceneObjects.length === 0 &&
    state.diceRolls.length === 0 &&
    // Chat counts as content, exactly like a roll: someone typed it. Omitting
    // it would let the public table's idle sweep wipe a log people are still
    // reading, on the grounds that a room with only conversation in it is
    // "untouched".
    state.chatLog.length === 0 &&
    state.mapBackground === undefined &&
    state.compiledScene === undefined &&
    state.mapTerrain === undefined &&
    state.mapElements === undefined &&
    state.liveMapDocumentId === undefined &&
    state.playerStagingZone === undefined &&
    state.combatActive === false &&
    // The campaign graph is content someone built — an atlas-only room must
    // not read as untouched, or the public table's idle sweep skips wiping it
    // and a visitor's graph persists for the next stranger indefinitely.
    state.atlasNodes.length === 0 &&
    state.atlasLinks.length === 0 &&
    Object.keys(state.sceneStates).length === 0
  );
}
