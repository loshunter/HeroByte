// ============================================================================
// PC COLOURS ON THE WIRE — every player's colour reaches every screen
// ============================================================================
// The recipient filter drops another player's TOKEN from a payload when it is
// outside the recipient's sight (fog), but party records always ride along.
// The colour picker's zones, pings, chat and roll names, the Party row and the
// card need every PC's colour on every screen, so each PC record carries its
// token's colour (an unlinked sole PC: its player's one loose token's,
// loosePcColours).
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

/**
 * The colour of a PC that predates linking (no `tokenId`), by character id: the
 * one token its player owns that no character claims, and only while that PC is
 * its player's only one. Read from the room, never from a view, and carried on
 * the record: the client takes an unlinked PC's colour from the record alone, so
 * every screen agrees. Not for a DM: the tokens a DM holds unclaimed are what
 * REMOVE handed over (a removed player's), and a colour taken from one would
 * also tell every player that the DM holds exactly one, fog or not.
 */
export function loosePcColours(state: RoomState): Map<string, string> {
  const colours = new Map<string, string>();
  const claimed = new Set<string>();
  const pcsByOwner = new Map<string, number>();
  const dms = new Set(state.players.filter((player) => player.isDM).map((player) => player.uid));
  for (const character of state.characters) {
    if (character.tokenId) claimed.add(character.tokenId);
    if (character.type === "pc" && character.ownedByPlayerUID) {
      const owner = character.ownedByPlayerUID;
      pcsByOwner.set(owner, (pcsByOwner.get(owner) ?? 0) + 1);
    }
  }
  for (const character of state.characters) {
    const owner = character.ownedByPlayerUID;
    if (character.type !== "pc" || character.tokenId || !owner || dms.has(owner)) continue;
    if (pcsByOwner.get(owner) !== 1) continue;
    const loose = state.tokens.filter((token) => token.owner === owner && !claimed.has(token.id));
    const color = loose.length === 1 ? loose[0]!.color : undefined;
    if (holdableColor(color)) colours.set(character.id, color);
  }
  return colours;
}

export function withPcColors(
  characters: SnapshotCharacter[],
  colours: ReadonlyMap<string, string>,
  looseColours: ReadonlyMap<string, string> = new Map(),
): SnapshotCharacter[] {
  return characters.map((character) => {
    const color =
      character.type !== "pc"
        ? undefined
        : character.tokenId
          ? colours.get(character.tokenId)
          : looseColours.get(character.id);
    if (color !== undefined) return { ...character, color };
    if (!("color" in character)) return character;
    const { color: _stale, ...rest } = character;
    return rest;
  });
}
