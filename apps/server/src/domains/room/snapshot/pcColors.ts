// ============================================================================
// PC COLOURS ON THE WIRE — every player's colour reaches every screen
// ============================================================================
// The recipient filter drops another player's TOKEN from a payload when it is
// outside the recipient's sight (fog), but party records always ride along.
// The colour picker's zones (and, later, pings and chat names) need every PC's
// colour on every screen, so each PC record carries its token's colour.
// Derived here at send time from the room's own tokens, never stored in room
// state, so it cannot drift from the token (an exported session file carries
// it; the loader strips it); a stale copy on a record (a hand-edited file) is
// replaced or removed. Shallow clones only: the view's records alias live
// RoomState.

import type { SnapshotCharacter, Token } from "@herobyte/shared";
import type { RoomState } from "../model.js";

/**
 * Every token whose colour a PC can hold: the current map's, and those waiting
 * with another map (a locked token stays behind when the party travels). Without
 * the waiting ones, a PC record would carry a colour only while its token was on
 * this map, a one-bit hint fog otherwise hides.
 */
export function colourTokens(state: RoomState): Token[] {
  // A suspended scene can be malformed (a hand-edited or old file): skip what is not a token.
  const waiting = Object.values(state.sceneStates ?? {}).flatMap((scene) =>
    Array.isArray(scene?.tokens)
      ? scene.tokens.filter((token) => typeof token?.id === "string")
      : [],
  );
  return waiting.length > 0 ? [...state.tokens, ...waiting] : state.tokens;
}

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
