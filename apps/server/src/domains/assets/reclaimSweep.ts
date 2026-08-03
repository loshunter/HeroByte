// ============================================================================
// ASSET RECLAIM SWEEP
// ============================================================================
// The replacement-leak fix (arc §7.3): before this, a room's claim on an
// upload was released only by clearing the WHOLE room, so every replaced
// background/portrait/prop image stayed claimed — and counted against the
// room's quota — forever. This sweep reconciles each loaded room's claims
// against what its serialized state and map documents actually reference.
// The mark/keep/un-claim rules live in planRoomReclaim; the scan is
// collectAssetHashes. Driven by IdleRoomUnloadManager's 5-minute tick and by
// idle-unload's last look at a room on its way out of memory.

import type { AssetService } from "./service.js";
import { collectAssetHashes } from "./assetReferences.js";

interface RoomStateSource {
  listRooms(): string[];
  has(roomId: string): boolean;
  get(roomId: string): { getState(): unknown };
}

interface MapDocumentSource {
  list(roomId: string): unknown[];
}

export class AssetReclaimSweeper {
  private readonly assetService?: AssetService;
  private readonly rooms: RoomStateSource;
  private readonly mapDocuments: MapDocumentSource;

  constructor(input: {
    assetService?: AssetService;
    rooms: RoomStateSource;
    mapDocuments: MapDocumentSource;
  }) {
    this.assetService = input.assetService;
    this.rooms = input.rooms;
    this.mapDocuments = input.mapDocuments;
  }

  /**
   * Reconcile every LOADED room. Unloaded rooms are deliberately untouched —
   * their claims wait until they load again, or until idle-unload sweeps them
   * on the way out (sweepRoom below).
   */
  async sweepLoadedRooms(): Promise<void> {
    if (!this.assetService) return;
    for (const roomId of this.rooms.listRooms()) {
      // The idle-unload sweep runs concurrently with this one; get() on the
      // registry would resurrect a room it just unloaded (create-on-miss +
      // disk load). has() and get() share one synchronous block, so nothing
      // can unload between them.
      if (!this.rooms.has(roomId)) continue;
      const stateJson = JSON.stringify(this.rooms.get(roomId).getState());
      await this.sweepRoom(roomId, stateJson);
    }
  }

  /** Reconcile one room from an already-serialized state snapshot. */
  async sweepRoom(roomId: string, stateJson: string): Promise<void> {
    if (!this.assetService) return;
    const referenced = collectAssetHashes(
      stateJson,
      JSON.stringify(this.mapDocuments.list(roomId)),
    );
    try {
      const freed = await this.assetService.reclaimRoom(roomId, referenced);
      if (freed > 0) {
        console.log(
          `[AssetReclaim] Freed ${Math.round(freed / 1024)}KB of replaced uploads in "${roomId}"`,
        );
      }
    } catch (error) {
      // Costs disk, not correctness; the next sweep retries.
      console.error(`[AssetReclaim] Reclaim failed for "${roomId}"`, error);
    }
  }
}
