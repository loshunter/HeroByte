// ============================================================================
// JOIN PROVISIONING
// ============================================================================
// What a password-verified `authenticate` does to room state: find or create
// the player, make sure every PC the uid owns has a token to stand on, and —
// when one session moves tables in a single step — leave the old roster.
// Split out of AuthenticationHandler for the structural size guard, the same
// move that produced dmElevation.ts and tableFork.ts.

import type { WebSocket } from "ws";
import type { Player } from "@herobyte/shared";
import type { Container } from "../../container.js";
import type { RoomService } from "../../domains/room/service.js";
import type { RoomState } from "../../domains/room/model.js";

/**
 * Drop a uid from the roster of a room it is no longer connected to, and tell
 * that room. Without this the heartbeat sweep later finds the stale entry,
 * resolves the uid's room to the NEW one, and cleans that up instead.
 */
export function leaveRoomRoster(
  container: Container,
  uidToWs: Map<string, WebSocket>,
  uid: string,
  roomId: string,
): void {
  const roomService = container.getRoomServiceForRoom(roomId);
  const state = roomService.getState();
  if (!state.users.includes(uid)) return;
  state.users = state.users.filter((u) => u !== uid);
  roomService.broadcast(container.getAuthenticatedClientsForRoom(roomId), uidToWs, {
    reason: "room-switch",
  });
}

/**
 * Create-or-reconnect the player record for `uid` and provision its tokens.
 * Returns the player (existing or freshly created).
 */
export function provisionJoin(
  container: Container,
  roomService: RoomService,
  state: RoomState,
  uid: string,
): Player {
  let player = container.playerService.findPlayer(state, uid);

  // Create or reconnect player entities
  if (!player) {
    player = container.playerService.createPlayer(state, uid);
  }

  // Create character if player doesn't have one
  const existingCharacter = container.characterService.findCharacterByOwner(state, uid);
  if (!existingCharacter) {
    const character = container.characterService.createCharacter(
      state,
      player.name,
      100, // default maxHp
      player.portrait,
      "pc",
    );
    container.characterService.claimCharacter(state, character.id, uid);

    // Create token for the character — a DM's too. "DM players should never
    // have tokens" was the rule here until F3 made a DM's rolled character a
    // combatant (and every DM elevates from a tokened join anyway).
    const spawn = roomService.getPlayerSpawnPosition();
    const token = container.tokenService.createToken(state, uid, spawn.x, spawn.y);
    container.characterService.linkToken(state, character.id, token.id);
  } else {
    // Player reconnecting - ensure EVERY PC this uid owns has a token, DM or
    // not: a DM who deleted their own token must get one back the way a
    // player does, or their character stands in the order with nothing to
    // step. Keyed on each character's link, never on "any token this uid
    // owns" — a DM owns the NPC tokens they placed, and that gate left them
    // tokenless for good (F4's review, round 1); and every owned PC, not
    // the first character of any type — a second PC's dead link was never
    // repaired, and a claimed NPC sorting first would have been tokened as
    // the player (round 3).
    const ownedPcs = state.characters.filter((c) => c.type === "pc" && c.ownedByPlayerUID === uid);
    for (const pc of ownedPcs) {
      container.characterService.ensureToken(state, container.tokenService, pc.id, uid, () =>
        roomService.getPlayerSpawnPosition(),
      );
    }
  }

  return player;
}
