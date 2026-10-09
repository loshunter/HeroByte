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

import type { SnapshotCharacter } from "@herobyte/shared";
import type { RoomState } from "../model.js";

/** A colour a PC can hold: a string with something in it (a restored file can carry anything). */
export function holdableColor(color: unknown): color is string {
  return typeof color === "string" && color.length > 0;
}

/**
 * Each PC's token colour, by token id: the token on this map, or, only when a
 * PC's token is not on this map, a copy waiting with another one (party tokens
 * always travel, so only a restored file leaves one there). The live copy always
 * wins, waiting scenes are scanned only when some PC's token is missing (a
 * broadcast normally pays nothing for them), and malformed entries and colours
 * that are not strings are skipped: they must never reach the colour rule.
 */
export function pcTokenColours(state: RoomState): Map<string, string> {
  const wanted = new Set<string>();
  for (const character of state.characters) {
    if (character.type === "pc" && character.tokenId) wanted.add(character.tokenId);
  }
  const colours = new Map<string, string>();
  const live = new Set<string>();
  for (const token of state.tokens) {
    live.add(token.id);
    if (wanted.has(token.id) && holdableColor(token.color)) colours.set(token.id, token.color);
  }
  const missing = [...wanted].filter((id) => !live.has(id));
  if (missing.length === 0) return colours;
  const waitingFor = new Set(missing);
  for (const scene of Object.values(state.sceneStates ?? {})) {
    if (!Array.isArray(scene?.tokens)) continue;
    for (const token of scene.tokens) {
      if (typeof token?.id !== "string" || !waitingFor.has(token.id) || colours.has(token.id)) {
        continue;
      }
      if (holdableColor(token.color)) colours.set(token.id, token.color);
    }
  }
  return colours;
}

export function withPcColors(
  characters: SnapshotCharacter[],
  colours: ReadonlyMap<string, string>,
): SnapshotCharacter[] {
  return characters.map((character) => {
    const color =
      character.type === "pc" && character.tokenId ? colours.get(character.tokenId) : undefined;
    if (color !== undefined) return { ...character, color };
    if (!("color" in character)) return character;
    const { color: _stale, ...rest } = character;
    return rest;
  });
}
