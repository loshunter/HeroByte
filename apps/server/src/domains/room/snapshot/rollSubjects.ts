/**
 * rollsAboutSeen — a public initiative line follows its character out of view.
 *
 * initiativeLineConcealed decides a line's visibility ONCE, at roll time: an NPC
 * the table could see then gets a public line ("Goblin Ambusher — initiative:
 * 17"). But buildRecipientView re-checks the character on every broadcast — hide
 * it with the 👁 eye, place its token in a fogged room, or turn fog on, and its
 * record and turn pointer leave a player's payload while the line kept naming it,
 * for everyone and for every player who joined later. A line that names a
 * character (`subjectCharacterId`) now rides only with that character's record.
 *
 * Kept: lines with no subject (a plain roll), the roller's own lines, and a line
 * whose character no longer exists (nothing left to conceal). Never the reverse —
 * a line concealed at roll time stays the DM's (a spoiler cannot be un-shown).
 */

import type { DiceRoll } from "@herobyte/shared";

export function rollsAboutSeen(
  rolls: DiceRoll[],
  allCharacters: readonly { id: string }[],
  seenCharacters: readonly { id: string }[],
  recipientUid?: string,
): DiceRoll[] {
  if (seenCharacters.length === allCharacters.length) return rolls;
  const seen = new Set(seenCharacters.map((character) => character.id));
  const exists = new Set(allCharacters.map((character) => character.id));
  return rolls.filter(
    (roll) =>
      !roll.subjectCharacterId ||
      roll.playerUid === recipientUid ||
      seen.has(roll.subjectCharacterId) ||
      !exists.has(roll.subjectCharacterId),
  );
}
