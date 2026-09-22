// ============================================================================
// REMOVE PLAYER — the DM clears an absent player's seat
// ============================================================================
// A player row outlives everything that made it: a character delete leaves
// the roster entry (the DM menu's Players tab lists it with no tokens), only
// a Main Hall idle clear wipes players, and a private table keeps every seat
// anyone ever took — SNAPSHOT_LIMITS.players (100) is the load ceiling a
// long campaign would walk into. This is the DM-side remove: the row, every
// PC the uid owns (through the turn-safe delete, so a fight in progress does
// not skip a round), every token it still owns that no surviving character
// stands on, and its selections.
//
// Refusals, each reported back to the DM alone (`remove-player-refused`, so
// a button that did nothing never does so silently). The DM's own seat:
// removing yourself is leaving, not this. A CONNECTED player: their client
// would go on speaking as a uid with no row, and every handler that looks the
// sender up would start warning; the seat belongs to whoever is sitting in
// it, and delete-character covers the parts. So only a uid outside
// `state.users` AND without an open socket goes (see RemovePlayerDeps): the
// roster keeps a dead socket's uid for up to the heartbeat window, and a
// live socket covers the player still typing the password. Both err on the
// side of "still here". And
// a seat whose last heartbeat is under REMOVE_PLAYER_GRACE_MS old: a network
// blip drops a uid from the roster for a moment, and a DM clicking in that
// moment would destroy a live player's characters.
//
// Not a ban: the table password is the gate, and a removed player who comes
// back is provisioned a fresh seat like any newcomer — a new row under the
// same uid with a freshly generated name, and a session token they still
// hold only proves the uid. The one thing that can carry over: a session
// file saved BEFORE the removal, loaded in between, brings that uid's old
// character and token back (never the row — SnapshotLoader merges players
// from the live table only), and the next reconnect inherits them.

import type { RoomState } from "../../domains/room/model.js";
import type { PlayerService } from "../../domains/player/service.js";
import type { CharacterService } from "../../domains/character/service.js";
import type { TokenService } from "../../domains/token/service.js";
import type { SelectionService } from "../../domains/selection/service.js";
import { deleteCharacterKeepingTurn } from "./deleteCharacter.js";

/**
 * A seat whose last heartbeat is this recent cannot be removed yet. The
 * client heartbeats every 25 s, so a connected player is never further behind
 * than that; a minute past the last one is a player who has actually gone.
 * The client mirrors this figure for its "dropped just now" label
 * (PlayersTab.tsx) and reads this source in a test so the two cannot drift.
 */
export const REMOVE_PLAYER_GRACE_MS = 60_000;

/**
 * How long an open socket that has not authenticated still counts as "here".
 * The heartbeat window (HeartbeatTimeoutManager): a socket parked on the
 * password form this long is not a player about to type it — and a zombie
 * (any script that opens `?uid=` and never logs in; nothing sweeps a held
 * socket) would otherwise pin the seat un-removable forever. The trade: a
 * human who leaves a login screen open longer than this can be removed, and
 * is re-provisioned a fresh seat when they finally log in. An AUTHENTICATED
 * player is in `state.users` and never reaches this test.
 */
export const HELD_SOCKET_TTL_MS = 5 * 60 * 1000;

export type RemovePlayerRefusal = "self" | "connected" | "recent" | "nothing";

export interface RemovePlayerDeps {
  playerService: PlayerService;
  characterService: CharacterService;
  tokenService: TokenService;
  selectionService: SelectionService;
  /**
   * ANY open socket for this uid younger than HELD_SOCKET_TTL_MS — registered
   * or a held newcomer (Container.liveSockets: every socket, at ANY table on
   * this process; a second tab on the password form is held, never registered,
   * and outlives the first tab). `state.users` is the AUTHENTICATED roster:
   * the connect strips the uid and only a verified password puts it back, and
   * `users` is not persisted — so a player at the password form, and every
   * player in the reconnect window after a restart, is absent from it with a
   * live socket. Either counts as connected here: the right side to fail on.
   */
  hasLiveSocket: (uid: string) => boolean;
}

export interface RemovePlayerResult {
  broadcast: boolean;
  save: boolean;
  /** Set when nothing was removed, so the dispatcher can tell the DM why. */
  refused?: RemovePlayerRefusal;
}

const refuse = (why: RemovePlayerRefusal): RemovePlayerResult => ({
  broadcast: false,
  save: false,
  refused: why,
});

export function removePlayer(
  deps: RemovePlayerDeps,
  state: RoomState,
  uid: string,
  senderUid: string,
  now: number = Date.now(),
): RemovePlayerResult {
  if (uid === senderUid) {
    console.warn(`[RemovePlayer] ${senderUid} tried to remove their own seat`);
    return refuse("self");
  }
  if (state.users.includes(uid) || deps.hasLiveSocket(uid)) {
    console.warn(`[RemovePlayer] ${senderUid} tried to remove ${uid}, who is connected`);
    return refuse("connected");
  }
  const player = deps.playerService.findPlayer(state, uid);
  if (player?.lastHeartbeat !== undefined && now - player.lastHeartbeat < REMOVE_PLAYER_GRACE_MS) {
    console.warn(`[RemovePlayer] ${uid} was here ${now - player.lastHeartbeat} ms ago; not yet`);
    return refuse("recent");
  }

  // Everything that goes, decided BEFORE anything moves: the uid's PCs (each
  // takes its own token through the turn-safe delete), and the tokens it owns
  // that no surviving character stands on. A token linked to a character that
  // STAYS (an NPC a former DM placed) is that character's, and is left alone.
  const owned = state.characters.filter((c) => c.ownedByPlayerUID === uid);
  const ownedPcs = owned.filter((c) => c.type === "pc");
  // A claimed NPC stays (it is the DM's creature) but the claim goes with the
  // seat: provisionJoin keys its reconnect branch on ANY owned character, so a
  // dangling claim would seat the returning uid with no PC and no token.
  const claimedNpcs = owned.filter((c) => c.type !== "pc");
  const pcTokens = new Set(ownedPcs.map((c) => c.tokenId).filter(Boolean));
  const keptByOthers = new Set(
    state.characters
      .filter((c) => !ownedPcs.includes(c))
      .map((c) => c.tokenId)
      .filter(Boolean),
  );
  const stray = state.tokens.filter(
    (t) => t.owner === uid && !pcTokens.has(t.id) && !keptByOthers.has(t.id),
  );
  const hadSelection = state.selectionState.has(uid);
  if (
    !player &&
    ownedPcs.length === 0 &&
    claimedNpcs.length === 0 &&
    stray.length === 0 &&
    !hadSelection
  ) {
    console.warn(`[RemovePlayer] nothing at the table for ${uid}`);
    return refuse("nothing");
  }

  for (const pc of ownedPcs) deleteCharacterKeepingTurn(deps, state, pc.id);
  // Every token the seat OWNED that a surviving character stands on passes to
  // the DM who cleared the seat — placed or claimed alike. `token.owner` is a
  // move authority (TokenMessageHandler, tokenDragPreview), and every monster
  // a DM places is owned by that DM's uid: a returning uid would otherwise
  // still drive every piece this seat put on the map.
  for (const token of state.tokens) {
    if (token.owner === uid && keptByOthers.has(token.id)) token.owner = senderUid;
  }
  for (const npc of claimedNpcs) npc.ownedByPlayerUID = undefined;
  for (const token of stray) {
    deps.tokenService.forceDeleteToken(state, token.id);
    deps.selectionService.removeObject(state, token.id);
  }
  deps.selectionService.deselect(state, uid);
  deps.playerService.removePlayer(state, uid);
  console.log(
    `[RemovePlayer] ${senderUid} cleared ${uid}'s seat: ${ownedPcs.length} PC(s), ${stray.length} stray token(s)`,
  );
  return { broadcast: true, save: true };
}
