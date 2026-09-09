/**
 * Field-level coercions for a state file read off disk. Split out of
 * StatePersistence, which sits at the 350-line ceiling: a hand-edited file
 * must not smuggle a value the wire would refuse (the diagonalRule /
 * visionRadius precedent), so every field with a domain is whitelisted here.
 */

import { coerceMovementBudgetFields, type Character } from "@herobyte/shared";

export function coerceLoadedCharacters(raw: unknown): Character[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Character[]).map((character) =>
    coerceMovementBudgetFields({
      ...character,
      type: character.type === "npc" ? ("npc" as const) : ("pc" as const),
      tokenImage: character.tokenImage ?? undefined,
      tokenId: character.tokenId ?? undefined,
    }),
  );
}

/** The movement-budget round: a positive finite number, or absent (round 1). */
export function coerceCombatRound(raw: unknown): number | undefined {
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 1 ? raw : undefined;
}
