/**
 * Whether a player may take one more character (an add, or a claim of an
 * unclaimed one). Two bounds: the table's own (SNAPSHOT_LIMITS.characters — past
 * it the DM's backup fails its own load check, as NPCMessageHandler already
 * refuses for NPCs) and the player's (PLAYER_CHARACTER_LIMITS.PER_PLAYER; a DM's
 * characters are not counted).
 */

import { PLAYER_CHARACTER_LIMITS } from "@herobyte/shared";
import type { RoomState } from "../room/model.js";
import { SNAPSHOT_LIMITS } from "../../middleware/validators/sessionValidators.js";

export function mayTakeCharacter(state: RoomState, uid: string, isDM: boolean): boolean {
  if (state.characters.length >= SNAPSHOT_LIMITS.characters) {
    console.warn(`Refusing a character for ${uid}: the table is at its character limit`);
    return false;
  }
  if (isDM) return true;
  const held = state.characters.filter(
    (character) => character.type === "pc" && character.ownedByPlayerUID === uid,
  ).length;
  if (held >= PLAYER_CHARACTER_LIMITS.PER_PLAYER) {
    console.warn(`Refusing a character for ${uid}: already holds ${held}`);
    return false;
  }
  return true;
}
