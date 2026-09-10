/**
 * Field-level coercions for a state file read off disk. Split out of
 * StatePersistence, which sits at the 350-line ceiling: a hand-edited file
 * must not smuggle a value the wire would refuse (the diagonalRule /
 * visionRadius precedent), so every field with a domain is whitelisted here.
 */

import { coerceMovementBudgetFields, type Character } from "@herobyte/shared";

/**
 * @param combatActive - a fight that survives the restart: every character
 *   in it carries a budget record (the DM's monster plates read from it),
 *   so a file written before the budget existed is back-filled with zero.
 */
export function coerceLoadedCharacters(raw: unknown, combatActive = false): Character[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Character[]).map((character) => {
    const coerced = coerceMovementBudgetFields({
      ...character,
      type: character.type === "npc" ? ("npc" as const) : ("pc" as const),
      tokenImage: character.tokenImage ?? undefined,
      tokenId: character.tokenId ?? undefined,
    });
    if (combatActive && coerced.movementUsed === undefined) {
      return { ...coerced, movementUsed: 0, movementDiagonals: 0 };
    }
    return coerced;
  });
}

/**
 * The movement-budget round: any integer (a backward wrap from the top of
 * the order in round 1 reads 0, and it is a stamp key, not a display), or
 * absent (round 1).
 */
export function coerceCombatRound(raw: unknown): number | undefined {
  return typeof raw === "number" && Number.isInteger(raw) ? raw : undefined;
}
