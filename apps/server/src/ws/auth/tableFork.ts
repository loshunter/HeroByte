// ============================================================================
// TABLE FORK — copy this table into a new private one
// ============================================================================
// The "keep what I built" move. The test table's password can never change and
// it is wiped hourly, so the only way to hold on to work done there is to take
// a copy somewhere durable. That copy is a normal private table: its own
// password, never auto-cleared, and the test table carries on untouched.
//
// Post-auth and DM-only, unlike create-room — it copies a table's entire
// contents, so it needs a caller who already holds that table.
//
// Lives outside AuthenticationHandler so that file stays under the size guard.

import type { WebSocket } from "ws";
import type { AssetService } from "../../domains/assets/service.js";
import type { AuthService } from "../../domains/auth/service.js";
import type { MapStudioService } from "../../domains/mapStudio/service.js";
import type { RoomService } from "../../domains/room/service.js";

const ROOM_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const MAX_NAME_LENGTH = 60;

export interface ForkTableRequest {
  roomId: string;
  name: string;
  roomPassword: string;
  dmPassword?: string;
}

export interface ForkTableDeps {
  authService: AuthService;
  mapStudioService: MapStudioService;
  assetService?: AssetService;
  /** The table being copied. */
  sourceRoomId: string;
  sourceRoomService: RoomService;
  /** Creates-on-first-use, so this is also how the destination is born. */
  getRoomServiceForRoom: (roomId: string) => RoomService;
  isDM: boolean;
}

function fail(ws: WebSocket, reason: string): void {
  ws.send(JSON.stringify({ t: "table-fork-failed", reason }));
}

/**
 * Copy `sourceRoomId` into a brand-new private table. Replies `table-forked`
 * on success or `table-fork-failed` with a human reason. Never throws.
 */
export function handleForkTable(
  ws: WebSocket | undefined,
  request: ForkTableRequest,
  deps: ForkTableDeps,
): void {
  if (!ws) return;

  if (!deps.isDM) {
    fail(ws, "Only the DM can save this table.");
    return;
  }

  const roomId = request.roomId?.trim();
  if (!roomId || roomId === deps.sourceRoomId || !ROOM_ID_PATTERN.test(roomId)) {
    fail(ws, "That table code isn't valid. Use letters, numbers, - and _.");
    return;
  }

  const name = request.name?.trim();
  if (!name) {
    fail(ws, "Give the table a name so you can find it again.");
    return;
  }
  if (name.length > MAX_NAME_LENGTH) {
    fail(ws, `Table names are ${MAX_NAME_LENGTH} characters or fewer.`);
    return;
  }

  // Mint it first: this validates both passwords and the table ceiling, so a
  // rejection happens before anything has been copied anywhere.
  try {
    deps.authService.createRoom(roomId, request.roomPassword, request.dmPassword);
  } catch (error) {
    fail(ws, error instanceof Error ? error.message : "Unable to create the table.");
    return;
  }

  try {
    const target = deps.getRoomServiceForRoom(roomId);

    // Unfiltered DM view (createSnapshot with no recipient), so secret doors
    // and hidden NPCs survive the copy. Same path load-session uses.
    target.loadSnapshot(deps.sourceRoomService.createSnapshot());
    target.setState({ tableName: name, isPublicTable: false });

    // Map documents are the live map itself — the whole point of keeping the
    // table — and they live outside room state.
    for (const document of deps.mapStudioService.list(deps.sourceRoomId)) {
      deps.mapStudioService.restore(roomId, document);
    }

    // Co-claim the uploads. Without this the copy points at images it does not
    // own, and the next sweep of the source table drops the last claim and
    // deletes them.
    void deps.assetService?.copyClaims(deps.sourceRoomId, roomId).catch((error) => {
      console.error(`[TableFork] Failed to copy asset claims to ${roomId}`, error);
    });

    target.saveState();
    ws.send(JSON.stringify({ t: "table-forked", roomId, name }));
    console.log(`Table ${deps.sourceRoomId} forked into private table ${roomId} ("${name}")`);
  } catch (error) {
    console.error("Table fork failed after the table was minted:", error);
    // The table exists and is reachable with the password they just chose, so
    // say that rather than implying nothing happened.
    fail(
      ws,
      "The table was created but copying the contents failed. It is empty — check the server logs.",
    );
  }
}
