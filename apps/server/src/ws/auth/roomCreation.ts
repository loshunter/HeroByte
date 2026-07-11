// ============================================================================
// PRIVATE ROOM CREATION
// ============================================================================
// Mint a private table: set its own room password (and optional DM password)
// so the default/server password can never open it. Runs pre-auth (the creator
// isn't in the room yet), then the client authenticates with the room password
// like any player and elevates with the DM password.
//
// Lives outside AuthenticationHandler so that god file stays under the size
// guard; it only needs the auth service + the requesting socket.

import type { WebSocket } from "ws";
import type { AuthService } from "../../domains/auth/service.js";

const ROOM_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

/**
 * Attempt to create a private room. Replies `room-created` on success or
 * `room-create-failed` (with a human reason) on any rejection. Never throws.
 */
export interface CreateRoomRequest {
  roomId: string;
  roomPassword: string;
  dmPassword?: string;
}

export function handleCreateRoom(
  authService: AuthService,
  ws: WebSocket | undefined,
  defaultRoomId: string,
  request: CreateRoomRequest,
): void {
  if (!ws) {
    return;
  }

  const { roomId, roomPassword, dmPassword } = request;
  const trimmedId = roomId?.trim();
  if (!trimmedId || trimmedId === defaultRoomId || !ROOM_ID_PATTERN.test(trimmedId)) {
    ws.send(
      JSON.stringify({
        t: "room-create-failed",
        reason: "That table code isn't valid. Use letters, numbers, - and _.",
      }),
    );
    return;
  }

  try {
    authService.createRoom(trimmedId, roomPassword, dmPassword);
    ws.send(JSON.stringify({ t: "room-created", roomId: trimmedId }));
    console.log(`Private room created: ${trimmedId}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unable to create table.";
    ws.send(JSON.stringify({ t: "room-create-failed", reason }));
  }
}
