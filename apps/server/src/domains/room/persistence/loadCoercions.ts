/**
 * Field-level coercions for a state file read off disk. Split out of
 * StatePersistence, which sits at the 350-line ceiling: a hand-edited file
 * must not smuggle a value the wire would refuse (the diagonalRule /
 * visionRadius precedent), so every field with a domain is whitelisted here.
 */

import {
  coerceMovementBudgetFields,
  type Character,
  type CustomToken,
  type TokenSize,
} from "@herobyte/shared";
import { VALID_TOKEN_SIZES } from "../../../middleware/validators/commonValidators.js";

/**
 * The table's own Library tokens, from a state file or a session file: an
 * entry keeps only what the wire would have accepted — a string id, name and
 * image, string tags, a size on the ladder (else medium). Anything else in
 * the list is dropped rather than handed to the picker to render.
 */
export function coerceCustomTokens(raw: unknown): CustomToken[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomToken[] = [];
  for (const entry of raw as Partial<CustomToken>[]) {
    if (!entry || typeof entry !== "object") continue;
    const { id, name, imageUrl, description, tags, size, addedBy, addedAt } = entry;
    if (typeof id !== "string" || typeof name !== "string" || typeof imageUrl !== "string") {
      continue;
    }
    if (!id || !name || !imageUrl) continue;
    out.push({
      id,
      name,
      imageUrl,
      ...(typeof description === "string" && description ? { description } : {}),
      tags: Array.isArray(tags) ? tags.filter((t): t is string => typeof t === "string") : [],
      size: coerceTokenSize(size) ?? "medium",
      addedBy: typeof addedBy === "string" ? addedBy : "",
      addedAt: typeof addedAt === "number" ? addedAt : 0,
    });
  }
  return out;
}

/**
 * A token size off the ladder (a hand-edited file, an older pack's word) is
 * dropped rather than kept: the renderer would fall back to medium anyway, and
 * a saved file should not carry a value no validator would accept.
 */
export function coerceTokenSize(value: unknown): TokenSize | undefined {
  return typeof value === "string" && VALID_TOKEN_SIZES.includes(value as TokenSize)
    ? (value as TokenSize)
    : undefined;
}

/**
 * @param combatActive - a fight that survives the restart: every character
 *   in it carries a budget record (the DM's monster plates read from it),
 *   so a file written before the budget existed is back-filled with zero.
 */
export function coerceLoadedCharacters(raw: unknown, combatActive = false): Character[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Character[]).map(({ tokenSize, ...character }) => {
    const size = coerceTokenSize(tokenSize);
    const coerced = coerceMovementBudgetFields({
      ...character,
      type: character.type === "npc" ? ("npc" as const) : ("pc" as const),
      tokenImage: character.tokenImage ?? undefined,
      tokenId: character.tokenId ?? undefined,
      // Only when it survives: a bare `tokenSize: undefined` is still a key.
      ...(size ? { tokenSize: size } : {}),
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
