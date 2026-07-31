// ============================================================================
// DM PASSWORD UPDATE
// ============================================================================
// Split out of AuthenticationHandler to keep that file under the structural
// size guard. Two rules live here: the test table's DM password is fixed (so
// nobody can lock a host out of DM on their own public demo), and on any other
// table only the current DM may change it — unless none exists yet, which is
// the bootstrap case that also promotes the caller.

import type { WebSocket } from "ws";
import type { Container } from "../../container.js";

export function setDMPasswordForUid(
  container: Container,
  ws: WebSocket | undefined,
  uid: string,
  dmPassword: string,
  defaultRoomId: string,
): void {
  if (!ws) return;

  const roomId = container.roomIdForUid(uid);
  const roomService = container.getRoomServiceForRoom(roomId);
  const state = roomService.getState();
  const player = container.playerService.findPlayer(state, uid);

  if (!player) {
    ws.send(JSON.stringify({ t: "dm-password-update-failed", reason: "Player not found" }));
    return;
  }

  // The test table's DM password is fixed for the same reason its entry
  // password is: it is the published one, and a visitor who changed it would
  // lock the host out of DM on their own demo permanently.
  if (roomId === defaultRoomId) {
    ws.send(
      JSON.stringify({
        t: "dm-password-update-failed",
        reason:
          "The test table's DM password is fixed so it stays open for everyone. Save it as a private table to get one of your own.",
      }),
    );
    return;
  }

  // Only current DM can set/update DM password
  // OR if no DM password exists yet, anyone can set it (bootstrap case)
  const hasDMPassword = container.authService.hasDMPassword(roomId);
  if (hasDMPassword && !player.isDM) {
    ws.send(
      JSON.stringify({
        t: "dm-password-update-failed",
        reason: "Only DM can update DM password",
      }),
    );
    return;
  }

  // Update DM password
  try {
    const summary = container.authService.updateDMPassword(dmPassword, roomId);
    ws.send(JSON.stringify({ t: "dm-password-updated", updatedAt: summary.updatedAt }));
    console.log(`DM password updated by ${uid}`);

    // If this is first-time setup and player doesn't have DM status yet, grant it
    if (!hasDMPassword && !player.isDM) {
      player.isDM = true;
      ws.send(JSON.stringify({ t: "dm-status", isDM: true }));
      console.log(`DM status granted to ${uid} (first-time DM password setup)`);
      roomService.broadcast(container.getAuthenticatedClientsForRoom(roomId), container.uidToWs, {
        reason: "dm-bootstrapped",
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    ws.send(JSON.stringify({ t: "dm-password-update-failed", reason: errorMessage }));
  }
}
