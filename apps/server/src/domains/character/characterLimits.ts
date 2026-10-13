/**
 * Whether a player may take one more character (an add, or a claim of an
 * unclaimed one). Two bounds: the table's own (SNAPSHOT_LIMITS.characters — past
 * it the DM's backup fails its own load check, as NPCMessageHandler already
 * refuses for NPCs) and the player's (PLAYER_CHARACTER_LIMITS.PER_PLAYER; a DM's
 * characters are not counted). A refusal is said to the sender (`character-refused`,
 * sent by the router from the result's `characterRefusal`): a hand-over refused at
 * five, or an add refused at a full table, changed nothing the sender could see.
 */

import { PLAYER_CHARACTER_LIMITS, type ServerMessage } from "@herobyte/shared";
import type { RoomState } from "../room/model.js";
import { SNAPSHOT_LIMITS } from "../../middleware/validators/sessionValidators.js";

export type CharacterRefusal = Omit<Extract<ServerMessage, { t: "character-refused" }>, "t">;

/** The table has room for one more character (an add; a claim adds none). */
export function tableHasRoom(state: RoomState): boolean {
  if (state.characters.length < SNAPSHOT_LIMITS.characters) return true;
  console.warn("Refusing a character: the table is at its character limit");
  return false;
}

/** Why `uid` may not take one more character, or null when they may. */
export function characterRefusalReason(
  state: RoomState,
  uid: string,
  isDM: boolean,
  { adds = true }: { adds?: boolean } = {},
): CharacterRefusal["reason"] | null {
  if (adds && !tableHasRoom(state)) return "table-full";
  if (isDM) return null;
  const held = state.characters.filter(
    (character) => character.type === "pc" && character.ownedByPlayerUID === uid,
  ).length;
  if (held >= PLAYER_CHARACTER_LIMITS.PER_PLAYER) {
    console.warn(`Refusing a character for ${uid}: already holds ${held}`);
    return "player-cap";
  }
  return null;
}

/** A refused character: nothing changes, and the router tells the sender why. */
export function refuseCharacter(
  action: CharacterRefusal["action"],
  reason: CharacterRefusal["reason"],
): { broadcast: false; save: false; characterRefusal: CharacterRefusal } {
  return { broadcast: false, save: false, characterRefusal: { action, reason } };
}
