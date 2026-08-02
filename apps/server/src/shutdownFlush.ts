// ============================================================================
// SHUTDOWN FLUSH
// ============================================================================
// The final write-out before the process dies. A free function rather than a
// Container method only because container.ts sits against the file-size
// guard; it operates on the container's public stores.

import type { RoomRegistry } from "./domains/room/RoomRegistry.js";
import type { MapStudioService } from "./domains/mapStudio/service.js";

/**
 * Flush every loaded room's state (and the Map Studio store) to disk.
 * The SIGTERM path awaits this before exiting so a deploy never loses the
 * broadcasts since the last completed save; each room's write queue
 * serializes with any in-flight save, so this cannot corrupt a file it
 * races. The room-secret store needs no entry here — it writes synchronously
 * at every change.
 */
export async function flushStoresForShutdown(
  roomRegistry: RoomRegistry,
  mapStudioService: MapStudioService,
): Promise<void> {
  const flushes: Promise<void>[] = [];
  for (const roomId of roomRegistry.listRooms()) {
    const roomService = roomRegistry.get(roomId);
    roomService.saveState();
    flushes.push(roomService.awaitPendingWrites());
  }
  flushes.push(mapStudioService.flush());
  await Promise.all(flushes);
}
