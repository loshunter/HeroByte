/**
 * A DM's pieces answer to whoever is DM now, never to a uid that stopped being one.
 *
 * Every monster a DM places is owned by that DM's uid, and `token.owner` is both a
 * move authority (token service, drag preview, keyboard steps) and a sightline: a
 * player sees from every token they own (visionFilter), and an own token passes the
 * fog (recipientFilter). Left with the uid, a DM who pressed Leave DM mode — or
 * anyone who reclaimed a DM's uid with the table password alone — saw through every
 * monster's eyes, saw NPCs through the fog, and could move, delete or recolour
 * hidden ones.
 *
 * So a demotion hands the uid's pieces (all but its own player characters' tokens,
 * on the table and on every map it left) to another DM at the table, or else to the
 * DM role: an owner no uid can be (a uid is [A-Za-z0-9_-], ConnectionLifecycleManager),
 * which no player ever matches. The next DM to elevate (or to reconnect with their
 * session token) takes the role's pieces back, so the deploy that demotes every DM
 * (session tokens live in memory) costs a lone DM nothing once they enter the password
 * again; at a co-DM table every DM's pieces go to whichever DM elevates first. A table loaded from disk, a restored
 * backup and a fork get the same rule for NPC tokens, which may name a uid that is
 * a player now.
 */

import { DM_ROLE_OWNER, type Player, type Token } from "@herobyte/shared";
import type { RoomState } from "./model.js";

export { DM_ROLE_OWNER };

type TableState = Pick<RoomState, "tokens" | "characters" | "players" | "users" | "sceneStates">;

/** Every token on the table, and on every map the table left (parked with it). */
function everyToken(state: TableState): Token[] {
  return [...state.tokens, ...Object.values(state.sceneStates ?? {}).flatMap((s) => s.tokens)];
}

/** Another DM at the table (authenticated now), or the DM role. */
export function heirOf(state: TableState, leaving?: string): string {
  const seated = state.players.find(
    (player) => player.isDM && player.uid !== leaving && state.users.includes(player.uid),
  );
  return seated?.uid ?? DM_ROLE_OWNER;
}

export function demoteDM(state: TableState, player: Player): void {
  player.isDM = false;
  const heir = heirOf(state, player.uid);
  const ownCharacterTokens = new Set(
    state.characters
      .filter((character) => character.type === "pc" && character.ownedByPlayerUID === player.uid)
      .map((character) => character.tokenId),
  );
  let passed = 0;
  for (const token of everyToken(state)) {
    if (token.owner !== player.uid || ownCharacterTokens.has(token.id)) continue;
    token.owner = heir;
    passed += 1;
  }
  console.log(`[DM] ${player.uid} is no longer DM; ${passed} piece(s) passed to ${heir}`);
}

/**
 * The pieces `from` left parked on maps the table left pass to `to` — a REMOVE or a
 * clear hands the live ones over itself. Parked tokens are never the party's (a
 * traveler never suspends), so every one of them is a placed piece.
 */
export function handParkedPieces(
  state: Pick<RoomState, "sceneStates">,
  from: ReadonlySet<string>,
  to: string,
): void {
  for (const scene of Object.values(state.sceneStates ?? {})) {
    for (const token of scene.tokens) if (from.has(token.owner)) token.owner = to;
  }
}

/** A DM who elevates takes back the pieces the DM role holds. */
export function claimDmRolePieces(state: TableState, uid: string): void {
  for (const token of everyToken(state)) {
    if (token.owner === DM_ROLE_OWNER) token.owner = uid;
  }
}

/**
 * NPC tokens owned by a uid that is not a DM now pass to a seated DM, or the DM role:
 * a table saved while a demoted DM still held them, a restored backup whose DM is a
 * player tonight, a fork. A token on a map the table left names its NPC through the
 * parked scene's characterLinks.
 */
export function rehomeNpcTokens(state: TableState): void {
  const heir = heirOf(state);
  const npcIds = new Set(state.characters.filter((c) => c.type !== "pc").map((c) => c.id));
  const npcTokens = new Set(
    state.characters.filter((c) => c.type !== "pc" && c.tokenId).map((c) => c.tokenId),
  );
  const isDM = (uid: string) => state.players.some((p) => p.uid === uid && p.isDM);
  const rehome = (token: Token) => {
    if (token.owner !== heir && !isDM(token.owner)) token.owner = heir;
  };
  for (const token of state.tokens) if (npcTokens.has(token.id)) rehome(token);
  for (const scene of Object.values(state.sceneStates ?? {})) {
    for (const token of scene.tokens) {
      const characterId = scene.characterLinks?.[token.id];
      if (characterId && npcIds.has(characterId)) rehome(token);
    }
  }
}
