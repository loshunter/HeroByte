/**
 * A monster's movement budget is the DM's information, like its HP numbers:
 * a player's frame carries a PC's speed and spend (party knowledge) and no
 * NPC's. Redacted on the WIRE, so devtools show nothing — the same principle
 * as the HP redaction beside it. Shallow clones only: every record here
 * aliases live RoomState.
 *
 * Keyed on `type`, not ownership — decided with F3 (a DM-owned character in
 * the order is a combatant): `type` is the secrecy axis for HP too, and a
 * DM-run PC-typed character is a party member the players can see the whole
 * of. A DM who wants an ally's numbers hidden makes it an NPC. Pinned by the
 * secrecy contract.
 */

import type { SnapshotCharacter } from "@herobyte/shared";

export function redactNpcMovement(
  characters: SnapshotCharacter[],
  isDM: boolean,
): SnapshotCharacter[] {
  if (isDM) return characters;
  return characters.map((character) => {
    if (character.type !== "npc") return character;
    if (
      character.speed === undefined &&
      character.movementUsed === undefined &&
      character.movementDiagonals === undefined &&
      character.movementRound === undefined
    ) {
      return character;
    }
    const redacted: SnapshotCharacter = { ...character };
    delete redacted.speed;
    delete redacted.movementUsed;
    delete redacted.movementDiagonals;
    delete redacted.movementRound;
    return redacted;
  });
}
