/**
 * Field-level coercions for a state file read off disk. Split out of
 * StatePersistence, which sits at the 350-line ceiling: a hand-edited file
 * must not smuggle a value the wire would refuse (the diagonalRule /
 * visionRadius precedent), so every field with a domain is whitelisted here.
 */

import {
  CUSTOM_TOKEN_LIMITS,
  coerceMovementBudgetFields,
  isCustomTokenImageUrl,
  type Character,
  type CustomToken,
  type TokenSize,
} from "@herobyte/shared";
import {
  VALID_TOKEN_SIZES,
  isNpcDisposition,
} from "../../../middleware/validators/commonValidators.js";

/** A picture this door will hand to every client's image loader, or nothing. */
function coerceCustomTokenUrl(value: unknown): string | undefined {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= CUSTOM_TOKEN_LIMITS.URL_MAX &&
    isCustomTokenImageUrl(value)
    ? value
    : undefined;
}

/**
 * The table's own Library tokens, from a state file or a session file: an
 * entry keeps only what the wire would have accepted. Anything else in the
 * list is dropped rather than handed to the picker to render.
 *
 * The two URLs are held to the wire's rule and not merely to "a non-empty
 * string", because they are the fields that LEAVE this process: a pick turns
 * imageUrl into an NPC's tokenImage and broadcasts it to every player's Konva
 * image loader, and thumbUrl rides the picker's grid the same way. A
 * hand-edited file could seat `data:text/html,…`, `javascript:…`, a plain-http
 * host or a four-megabyte string — every one of which add-custom-token
 * refuses — and the door underneath the comment saying "the same rule the wire
 * applies" was the one place none of that was checked. Nothing already on a
 * shelf is at risk: it passed the wire at add time, and the rule has only ever
 * widened.
 */
export function coerceCustomTokens(raw: unknown): CustomToken[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomToken[] = [];
  for (const entry of raw as Partial<CustomToken>[]) {
    if (!entry || typeof entry !== "object") continue;
    const { id, name, imageUrl, thumbUrl, description, tags, size, disposition, addedBy, addedAt } =
      entry;
    if (typeof id !== "string" || typeof name !== "string") continue;
    if (!id || !name || name.length > CUSTOM_TOKEN_LIMITS.NAME_MAX) continue;
    const picture = coerceCustomTokenUrl(imageUrl);
    if (!picture) continue;
    const thumb = coerceCustomTokenUrl(thumbUrl);
    const stance = coerceNpcDisposition(disposition);
    out.push({
      id,
      name,
      imageUrl: picture,
      // A missing thumb is the shipped default, so anything the wire would
      // not have taken is dropped rather than repaired — the picker draws
      // imageUrl, which is exactly what a token added before G1 does.
      ...(thumb ? { thumbUrl: thumb } : {}),
      ...(typeof description === "string" &&
      description &&
      description.length <= CUSTOM_TOKEN_LIMITS.DESCRIPTION_MAX
        ? { description }
        : {}),
      tags: coerceCustomTokenTags(tags),
      size: coerceTokenSize(size) ?? "medium",
      // Absent IS the default (hostile), so a word off the list is dropped
      // rather than replaced with one — the same rule the wire applies.
      ...(stance ? { disposition: stance } : {}),
      addedBy: typeof addedBy === "string" ? addedBy : "",
      addedAt: typeof addedAt === "number" ? addedAt : 0,
    });
  }
  return out;
}

/** Non-empty strings, each within TAG_MAX, no more than TAGS_MAX of them. */
function coerceCustomTokenTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (tag): tag is string =>
        typeof tag === "string" && tag.length > 0 && tag.length <= CUSTOM_TOKEN_LIMITS.TAG_MAX,
    )
    .slice(0, CUSTOM_TOKEN_LIMITS.TAGS_MAX);
}

/**
 * A stance off the list is dropped, never repaired — absent already means
 * hostile. Exported because there are THREE load doors, and this comment said
 * two for a whole review round: this file's (the state file), SnapshotLoader's
 * (the session file), and RedisRoomStore.hydrate (a Redis-backed table, which
 * spread its payload verbatim until it was found). Hardening only one of them
 * is what let a hand-edited `"disposition": "banana"` reach the card renderer,
 * where a `Record` index is `undefined` and the throw took the whole table
 * down for every client at it. The character and custom-token coercions are
 * applied at all three; SnapshotLoader applies the size and stance rules
 * inline rather than through coerceLoadedCharacters, so it skips that
 * function's combatActive movement-budget back-fill, and RoomSnapshot carries
 * no combatRound for coerceCombatRound to see.
 */
export function coerceNpcDisposition(value: unknown) {
  return isNpcDisposition(value) ? value : undefined;
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
  return (raw as Character[]).map(({ tokenSize, disposition, ...character }) => {
    const size = coerceTokenSize(tokenSize);
    const stance = coerceNpcDisposition(disposition);
    const coerced = coerceMovementBudgetFields({
      ...character,
      type: character.type === "npc" ? ("npc" as const) : ("pc" as const),
      tokenImage: character.tokenImage ?? undefined,
      tokenId: character.tokenId ?? undefined,
      // Only when it survives: a bare `tokenSize: undefined` is still a key.
      ...(size ? { tokenSize: size } : {}),
      // Same rule: a stance off the list is dropped, and absent means hostile.
      ...(stance ? { disposition: stance } : {}),
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
