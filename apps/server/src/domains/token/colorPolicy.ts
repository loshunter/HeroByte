// ============================================================================
// TOKEN COLOUR POLICY — the server end of the personal-colour rule
// ============================================================================
// Every colour a player or the DM sets, and every new token's colour, passes
// through here: the automatic colour, the double-click recolour, and a chosen
// colour (the picker, a character file). Table restores do not.
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
import { colourTokens } from "../room/snapshot/pcColors.js";

/** What a chosen colour became, and whether the sender must be told. */
export interface ColorDecision {
  color: string;
  /** The request was moved (or could not be read); the sender gets a notice. */
  adjusted: boolean;
  /** The character whose zone the request fell in, for the notice. */
  near?: string;
  /** The character whose colour was moved (a player may have several). */
  name?: string;
}

/** Which kind of token is being born: a PC's gets a player colour, an NPC's a plain one. */
export type TokenKind = "pc" | "npc";

const dmCheck =
  (state: RoomState) =>
  (uid: string): boolean =>
    state.players.some((player) => player.uid === uid && player.isDM === true);

/**
 * Every PC colour at the table that holds a zone: one per PC character with an
 * owner and a token, the token found on the current map or waiting with
 * another one (a locked token can stay behind when the party travels). A fogged
 * token still counts: this reads the room, not a view. Not counted: a PC with
 * no owner (no player to hold the colour), and a PC hidden from players (only a
 * restored file can make one, and naming it in a notice would reveal it).
 */
export function pcColorHolders(state: RoomState): ColorHolder[] {
  const tokens = new Map(colourTokens(state).map((token) => [token.id, token]));
  const holders: ColorHolder[] = [];
  for (const character of state.characters) {
    if (character.type !== "pc" || !character.tokenId || !character.ownedByPlayerUID) continue;
    if (character.visibleToPlayers === false) continue;
    const token = tokens.get(character.tokenId);
    if (!token) continue;
    holders.push({
      ownerUid: character.ownedByPlayerUID,
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
 * A new token's colour. An NPC's is any window colour (NPCs hold no zone, and
 * steering them would put them on the colour the next player gets). A player's
 * further character starts in that player's colour (their characters may share,
 * and one player's characters must not spread across the window). A player's
 * first gets the open spot farthest from every other player's, among allowed
 * colours whenever any exist; it never fails, so it can never block a join.
 */
export function automaticColor(
  state: RoomState,
  ownerUid: string,
  rng: () => number,
  kind: TokenKind = "pc",
): string {
  if (kind === "npc") return farthestColor([], rng);
  const holders = pcColorHolders(state);
  const own = holders.find(
    (holder) => holder.ownerUid === ownerUid && normalizeColor(holder.color),
  );
  if (own) return normalizeColor(own.color)!;
  const { others, radius } = colorRuleInputs(holders, dmCheck(state), ownerUid);
  return farthestColor(others, rng, radius);
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
 * kept when it is the colour the token already has (the rule runs only on a
 * change: loading your own file must not move you), kept when allowed, and
 * moved to the nearest allowed colour when not. An unreadable colour is the
 * DM's to fix (null: nothing changes), while a player's gets a free colour: a
 * character file must never fail to load.
 */
export function decideChosenColor(
  state: RoomState,
  token: Token,
  requested: string,
  senderIsDM: boolean,
): ColorDecision | null {
  const normalized = normalizeColor(requested);
  if (senderIsDM) return normalized ? { color: normalized, adjusted: false } : null;
  if (normalized && normalized === normalizeColor(token.color)) {
    return { color: token.color, adjusted: false };
  }
  const { others, radius } = inputsFor(state, token.owner);
  if (normalized && isColorAllowed(normalized, others, radius)) {
    return { color: normalized, adjusted: false };
  }
  const near = normalized ? closestBlocker(normalized, others)?.holder.name : undefined;
  const name = state.characters.find((character) => character.tokenId === token.id)?.name;
  return {
    color: nearestAllowedColor(normalized ?? requested, others, radius),
    adjusted: true,
    ...(near ? { near } : {}),
    ...(name ? { name } : {}),
  };
}

/**
 * How many colour writes (picks and recolours) one player may make: a burst of
 * `capacity`, refilled at `perSecond`. The rule costs cells × PCs per write, so
 * a client spamming them must not be able to spend the server's time; a person
 * picking, recolouring or loading a file never comes near it.
 */
export class ColorWriteBudget {
  private readonly buckets = new Map<string, { tokens: number; at: number }>();

  constructor(
    private readonly capacity = 10,
    private readonly perSecond = 5,
    private readonly now: () => number = () => Date.now(),
  ) {}

  take(uid: string): boolean {
    const time = this.now();
    const bucket = this.buckets.get(uid) ?? { tokens: this.capacity, at: time };
    const refilled = Math.min(
      this.capacity,
      bucket.tokens + ((time - bucket.at) / 1000) * this.perSecond,
    );
    if (refilled < 1) {
      this.buckets.set(uid, { tokens: refilled, at: time });
      return false;
    }
    this.buckets.set(uid, { tokens: refilled - 1, at: time });
    return true;
  }
}
