// ============================================================================
// DM ELEVATION / REVOCATION
// ============================================================================
// Split out of AuthenticationHandler to keep that file under the structural
// size guard (the same move that produced roomCreation.ts, tableFork.ts and
// dmPasswordUpdate.ts). Elevation is async since S1: the scrypt compare runs
// off the event loop, so everything after the await re-checks that the
// socket still belongs to the uid.

import type { WebSocket } from "ws";
import type { Container } from "../../container.js";
import type { DMElevationThrottle } from "./dmElevationThrottle.js";

export interface DMElevationDeps {
  container: Container;
  uidToWs: Map<string, WebSocket>;
  dmThrottle: DMElevationThrottle;
  /** Uids with a password check already in flight (shared with authenticate). */
  pendingAuthWork: Set<string>;
  /** Per-IP budget spent BEFORE the scrypt compare (D7). */
  takeAuthWork: (ws: WebSocket) => boolean;
  /** Success refund — only failed guesses stay charged. */
  refundAuthWork: (ws: WebSocket) => void;
}

/**
 * Elevate a client to DM after verifying the room's DM password.
 * Ordering matters: the cheap checks (player exists, per-uid throttle,
 * DM password configured at all) run before the per-IP budget is spent,
 * and the budget is spent before any hashing happens.
 */
export async function elevateUidToDM(
  deps: DMElevationDeps,
  uid: string,
  dmPassword: string,
): Promise<void> {
  const { container, uidToWs, dmThrottle } = deps;
  const ws = uidToWs.get(uid);
  if (!ws) {
    return;
  }

  const roomId = container.roomIdForUid(uid);
  const roomService = container.getRoomServiceForRoom(roomId);
  const state = roomService.getState();
  const player = container.playerService.findPlayer(state, uid);

  if (!player) {
    ws.send(JSON.stringify({ t: "dm-elevation-failed", reason: "Player not found" }));
    return;
  }

  // Back off after a burst of wrong guesses so a room member can't brute-force
  // a weak DM password in a tight loop on one connection.
  const now = Date.now();
  if (dmThrottle.isLocked(uid, now)) {
    ws.send(
      JSON.stringify({
        t: "dm-elevation-failed",
        reason: "Too many attempts. Wait a few seconds and try again.",
      }),
    );
    return;
  }

  // Check if DM password is even set (the room's own, or the default)
  if (!container.authService.hasDMPassword(roomId)) {
    ws.send(
      JSON.stringify({
        t: "dm-elevation-failed",
        reason: "No DM password configured. Use set-dm-password to create one.",
      }),
    );
    return;
  }

  // Per-IP budget before the scrypt compare (the per-uid throttle above
  // caps failures, but a uid is client-supplied — the IP is not).
  if (!deps.takeAuthWork(ws)) {
    ws.send(
      JSON.stringify({
        t: "dm-elevation-failed",
        reason: "Too many attempts from your network. Wait a minute and try again.",
      }),
    );
    return;
  }

  // One in-flight elevation per uid (see authenticate for why).
  if (deps.pendingAuthWork.has(uid)) {
    return;
  }
  deps.pendingAuthWork.add(uid);

  // Verify DM password
  let verified: boolean;
  try {
    const normalizedPassword = dmPassword.trim();
    verified = await container.authService.verifyDMPassword(normalizedPassword, roomId);
  } finally {
    deps.pendingAuthWork.delete(uid);
  }

  // Bail if the connection was replaced while the hash computed — the
  // replacement can re-request elevation itself.
  if (uidToWs.get(uid) !== ws) {
    return;
  }

  if (!verified) {
    dmThrottle.recordFailure(uid, now);
    console.warn(`DM elevation failed for uid ${uid}: Invalid password`);
    ws.send(JSON.stringify({ t: "dm-elevation-failed", reason: "Invalid DM password" }));
    return;
  }

  // Grant DM powers
  dmThrottle.clear(uid);
  deps.refundAuthWork(ws);
  player.isDM = true;
  ws.send(JSON.stringify({ t: "dm-status", isDM: true }));
  console.log(`DM elevation granted to ${uid}`);

  // Broadcast updated state to the player's room
  roomService.broadcast(container.getAuthenticatedClientsForRoom(roomId), uidToWs, {
    reason: "dm-elevated",
  });
}

/** Revoke DM status from a client (no password involved, stays synchronous). */
export function revokeUidDM(
  deps: Pick<DMElevationDeps, "container" | "uidToWs">,
  uid: string,
): void {
  const { container, uidToWs } = deps;
  const ws = uidToWs.get(uid);
  if (!ws) {
    return;
  }

  const roomId = container.roomIdForUid(uid);
  const roomService = container.getRoomServiceForRoom(roomId);
  const state = roomService.getState();
  const player = container.playerService.findPlayer(state, uid);

  if (!player) {
    console.warn(`DM revocation failed: player ${uid} not found`);
    return;
  }

  if (!player.isDM) {
    console.warn(`DM revocation ignored: player ${uid} is not DM`);
    return;
  }

  // Revoke DM status
  player.isDM = false;
  ws.send(JSON.stringify({ t: "dm-status", isDM: false }));
  console.log(`DM status revoked for ${uid}`);

  // Broadcast updated state to the player's room
  roomService.broadcast(container.getAuthenticatedClientsForRoom(roomId), uidToWs, {
    reason: "dm-revoked",
  });
}
