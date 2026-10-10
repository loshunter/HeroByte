// ============================================================================
// WHOSE COLOUR — one resolver for every place a player's colour shows (C3)
// ============================================================================
// Fog drops another player's TOKEN from a payload when it is out of the
// recipient's sight, but party records always ride along, and C1 puts each
// PC's token colour on its record (`SnapshotCharacter.color`). So a colour is
// read from the record first and from a token only when the record has none:
// a ping, a chat name or a roster ring then shows the same colour on every
// screen, in sight or not.

import { normalizeColor, type SnapshotCharacter, type Token } from "@herobyte/shared";
import { looseOwnToken } from "../../utils/looseOwnToken";

/** A character's colour: its record's (fog-proof), else its token's while in view. `#rrggbb` or null. */
export function characterColor(
  character: Pick<SnapshotCharacter, "color" | "tokenId">,
  token?: Pick<Token, "color"> | null,
): string | null {
  const raw = character.color ?? token?.color;
  return raw ? normalizeColor(raw) : null;
}

/**
 * A player's colour: their first PC's, in character order (a later PC only when
 * the earlier ones have no colour yet). The DM's comes from the DM's own PC, never
 * from an NPC token the DM placed. A PC that predates linking falls back on the
 * one loose token its player owns (looseOwnToken). Null: no PC with a colour,
 * and each place keeps its own fallback.
 */
export function playerColor(
  uid: string | null | undefined,
  characters: readonly SnapshotCharacter[] | undefined,
  tokens: readonly Token[] | undefined,
): string | null {
  if (!uid || !characters) return null;
  const pcs = characters.filter((c) => c.type === "pc" && c.ownedByPlayerUID === uid);
  for (const pc of pcs) {
    const token = pc.tokenId
      ? tokens?.find((t) => t.id === pc.tokenId)
      : pcs.length === 1
        ? looseOwnToken(tokens, characters, uid)
        : undefined;
    const color = characterColor(pc, token);
    if (color) return color;
  }
  return null;
}

/** Every player's colour by uid (players with no PC colour are left out). Build it once per snapshot. */
export function playerColorMap(
  uids: readonly string[],
  characters: readonly SnapshotCharacter[] | undefined,
  tokens: readonly Token[] | undefined,
): Map<string, string> {
  const colors = new Map<string, string>();
  for (const uid of uids) {
    const color = playerColor(uid, characters, tokens);
    if (color) colors.set(uid, color);
  }
  return colors;
}
