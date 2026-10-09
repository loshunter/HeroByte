// ============================================================================
// TOKEN COLOUR POLICY — the server end of the personal-colour rule
// ============================================================================
// Every colour write passes through here: a new token's automatic colour, the
// double-click recolour, and a chosen colour (the picker, a character file).
// The rule itself is shared (`colorRule.ts`), so the picker draws exactly the
// zones enforced here; this file only says WHOSE colours count in a room.
//
// The server is the authority: the picker bumps a handle at a zone's edge,
// but a crafted message, a stale picker (someone joined meanwhile) or a loaded
// file can still ask for a taken colour. Those are SNAPPED to the nearest
// allowed colour, never refused, and the sender is told (personal-colour-arc
// -plan §3.3). Messages are handled in order, so two players choosing the
// same spot at once cannot both get it: the second is checked against the
// first.

import {
  closestBlocker,
  colorRuleInputs,
  farthestColor,
  isColorAllowed,
  nearestAllowedColor,
  normalizeColor,
  randomAllowedColor,
  type ColorHolder,
  type Token,
} from "@herobyte/shared";
import type { RoomState } from "../room/model.js";

/** What a chosen colour became, and whether the sender must be told. */
export interface ColorDecision {
  color: string;
  /** The request was moved (or could not be read); the sender gets a notice. */
  adjusted: boolean;
  /** The character whose zone the request fell in, for the notice. */
  near?: string;
}

const dmCheck =
  (state: RoomState) =>
  (uid: string): boolean =>
    state.players.some((player) => player.uid === uid && player.isDM === true);

/**
 * Every PC colour at the table: one per PC character whose token exists. A
 * fogged or hidden token still counts — this reads the room, not a view.
 */
export function pcColorHolders(state: RoomState): ColorHolder[] {
  const tokens = new Map(state.tokens.map((token) => [token.id, token]));
  const holders: ColorHolder[] = [];
  for (const character of state.characters) {
    if (character.type !== "pc" || !character.tokenId) continue;
    const token = tokens.get(character.tokenId);
    if (!token) continue;
    holders.push({
      ownerUid: character.ownedByPlayerUID ?? token.owner,
      color: token.color,
      name: character.name,
      characterId: character.id,
    });
  }
  return holders;
}

/** The rule's inputs for a token's owner. */
function inputsFor(state: RoomState, ownerUid: string) {
  return colorRuleInputs(pcColorHolders(state), dmCheck(state), ownerUid);
}

/**
 * A new token's colour: the open spot farthest from every other player's.
 * Never fails, so it can never block a join.
 */
export function automaticColor(state: RoomState, ownerUid: string, rng: () => number): string {
  return farthestColor(inputsFor(state, ownerUid).others, rng);
}

/**
 * The double-click recolour: a random allowed colour, visibly away from the
 * current one, so "recolour" always recolours. The DM's is free (exempt).
 */
export function recolorChoice(
  state: RoomState,
  token: Token,
  senderIsDM: boolean,
  rng: () => number,
): string {
  const { others, radius } = inputsFor(state, token.owner);
  return randomAllowedColor(senderIsDM ? [] : others, radius, rng, token.color);
}

/**
 * A colour someone CHOSE. The DM's choice is never checked; a player's is
 * kept when allowed and snapped to the nearest allowed colour when not. An
 * unreadable colour is the DM's to fix (null: nothing changes), while a
 * player's is reassigned — a character file must never fail to load.
 */
export function decideChosenColor(
  state: RoomState,
  token: Token,
  requested: string,
  senderIsDM: boolean,
): ColorDecision | null {
  const normalized = normalizeColor(requested);
  if (senderIsDM) return normalized ? { color: normalized, adjusted: false } : null;
  const { others, radius } = inputsFor(state, token.owner);
  if (normalized && isColorAllowed(normalized, others, radius)) {
    return { color: normalized, adjusted: false };
  }
  const near = normalized ? closestBlocker(normalized, others)?.holder.name : undefined;
  return {
    color: nearestAllowedColor(requested, others, radius),
    adjusted: true,
    ...(near ? { near } : {}),
  };
}
