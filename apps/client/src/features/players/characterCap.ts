import { PLAYER_CHARACTER_LIMITS, type RoomSnapshot, type ServerMessage } from "@herobyte/shared";

/** Said when a player at the cap asks for another character (the server would refuse it). */
export const CHARACTER_CAP_REACHED = `Up to ${PLAYER_CHARACTER_LIMITS.PER_PLAYER} characters each: delete one to add another.`;

/** Said when "Creating..." heard nothing back: a slow add still lands, so a retry would make two. */
export const CHARACTER_CREATION_NO_ANSWER =
  "The table has not answered yet. Your new character may still appear: check the Party list before adding another.";

/** The player already holds the most characters a player may (a DM is not capped). */
export function characterCapReached(snapshot: RoomSnapshot | null, uid: string): boolean {
  if (snapshot?.players?.find((player) => player.uid === uid)?.isDM) return false;
  const held = (snapshot?.characters ?? []).filter(
    (character) => character.type === "pc" && character.ownedByPlayerUID === uid,
  ).length;
  return held >= PLAYER_CHARACTER_LIMITS.PER_PLAYER;
}

/** What the sender reads when the server refused a character (`character-refused`). */
export function characterRefusalMessage(
  refusal: Extract<ServerMessage, { t: "character-refused" }>,
): string {
  if (refusal.reason === "table-full") {
    return "This table holds as many characters as it can: delete one to add another.";
  }
  if (refusal.action === "hand-over") {
    return `That player already has ${PLAYER_CHARACTER_LIMITS.PER_PLAYER} characters: one of theirs must be deleted (by them or by you) before you hand them another.`;
  }
  if (refusal.action === "claim") {
    return `Up to ${PLAYER_CHARACTER_LIMITS.PER_PLAYER} characters each: delete one before claiming another.`;
  }
  return CHARACTER_CAP_REACHED;
}
