// ============================================================================
// PC COLOURS ON THE WIRE — every player's colour reaches every screen
// ============================================================================
// The recipient filter drops another player's TOKEN from a payload when it is
// outside the recipient's sight (fog), but party records always ride along.
// The colour picker's zones (and, later, pings and chat names) need every PC's
// colour on every screen, so each PC record carries its token's colour.
// Derived here at send time from the room's own tokens, never stored, so it
// cannot drift from the token; a stale copy on a record (a hand-edited file)
// is replaced or removed. Shallow clones only: the view's records alias live
// RoomState.

import type { SnapshotCharacter, Token } from "@herobyte/shared";

export function withPcColors(
  characters: SnapshotCharacter[],
  tokens: readonly Token[],
): SnapshotCharacter[] {
  const colors = new Map(tokens.map((token) => [token.id, token.color]));
  return characters.map((character) => {
    const color =
      character.type === "pc" && character.tokenId ? colors.get(character.tokenId) : undefined;
    if (color !== undefined) return { ...character, color };
    if (!("color" in character)) return character;
    const { color: _stale, ...rest } = character;
    return rest;
  });
}
