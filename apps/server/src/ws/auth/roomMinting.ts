// ============================================================================
// ROOM MINTING — create-room and fork-table entry points
// ============================================================================
// Both mint a room (hashing up to two passwords), so both spend the same per-IP
// auth budget as a password guess before any hashing happens. Split out of
// AuthenticationHandler for the structural size guard, the same move that
// produced dmElevation.ts and joinProvisioning.ts. Behaviour is unchanged.

import type { WebSocket } from "ws";
import type { Container } from "../../container.js";
import { handleCreateRoom, type CreateRoomRequest } from "./roomCreation.js";
import { forkTableForUid, type ForkTableRequest } from "./tableFork.js";

export interface RoomMintingDeps {
  container: Container;
  defaultRoomId: string;
  /** Per-IP budget spent BEFORE the hashing (D7). */
  takeAuthWork: (ws: WebSocket) => boolean;
}

const TOO_MANY = "Too many attempts from your network. Wait a minute and try again.";

/**
 * Mint a private table. Reachable PRE-auth (you cannot be in a room that does
 * not exist yet), which is why it is budgeted like a password guess.
 */
export async function createRoomForUid(
  deps: RoomMintingDeps,
  ws: WebSocket | undefined,
  request: CreateRoomRequest,
): Promise<void> {
  if (ws && !deps.takeAuthWork(ws)) {
    ws.send(JSON.stringify({ t: "room-create-failed", reason: TOO_MANY }));
    return;
  }
  await handleCreateRoom(
    deps.container.authService,
    ws,
    deps.defaultRoomId,
    request,
    (roomId, name) => {
      deps.container.getRoomServiceForRoom(roomId).setState({ tableName: name });
    },
  );
}

/**
 * Copy the sender's table into a new private one (DM-only, post-auth). This
 * is how work done on the test table is kept: that table's password is fixed
 * and it is wiped hourly, so a durable copy is the only way to hold on to it.
 */
export async function forkTableForSender(
  deps: RoomMintingDeps,
  ws: WebSocket | undefined,
  uid: string,
  request: ForkTableRequest,
): Promise<void> {
  // Forking mints a room (hashing) — same budget as create-room.
  if (ws && !deps.takeAuthWork(ws)) {
    ws.send(JSON.stringify({ t: "table-fork-failed", reason: TOO_MANY }));
    return;
  }
  await forkTableForUid(deps.container, ws, uid, request);
}
