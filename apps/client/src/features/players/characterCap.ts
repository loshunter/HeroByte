import { PLAYER_CHARACTER_LIMITS, type RoomSnapshot } from "@herobyte/shared";

/** Said when a player at the cap asks for another character (the server would refuse it). */
export const CHARACTER_CAP_REACHED = `Up to ${PLAYER_CHARACTER_LIMITS.PER_PLAYER} characters each: delete one to add another.`;

/** The player already holds the most characters a player may (a DM is not capped). */
export function characterCapReached(snapshot: RoomSnapshot | null, uid: string): boolean {
  if (snapshot?.players?.find((player) => player.uid === uid)?.isDM) return false;
  const held = (snapshot?.characters ?? []).filter(
    (character) => character.type === "pc" && character.ownedByPlayerUID === uid,
  ).length;
  return held >= PLAYER_CHARACTER_LIMITS.PER_PLAYER;
}
