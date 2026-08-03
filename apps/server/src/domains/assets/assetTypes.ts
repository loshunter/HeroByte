// ============================================================================
// ASSET STORE TYPES
// ============================================================================
// Shared by the service, the index store, and the claim planners. Split from
// the service so it stays under the structural size guard, and so the index
// store no longer type-imports from the module that imports it.

export interface StoredAsset {
  hash: string;
  mime: string;
  extension: string;
  size: number;
  createdAt: number;
  /**
   * Rooms that have uploaded these bytes. Content addressing means two rooms
   * uploading the same image share ONE file — so ownership is a set, not a
   * field, and the asset lives until no room claims it.
   *
   * Optional: an index written before this existed has none, and those assets
   * are treated as unclaimed (see roomsOf).
   */
  rooms?: string[];
  /**
   * Rooms whose state has been OBSERVED referencing this asset (by the
   * reclaim sweep). A claim that was marked here and later stops being
   * referenced was replaced, and gets un-claimed; a claim never marked is an
   * in-flight upload or palette stock and is never touched. Absent = no room
   * observed yet. See planRoomReclaim.
   */
  referencedBy?: string[];
  /**
   * When the reclaim sweep dropped this asset's LAST claim. A condemned
   * entry keeps serving (it stays in the index) until the grace window
   * passes — references the scan cannot see (a My Stuff shelf, a saved
   * player file, another table's pasted URL) get that long to come back, and
   * a room that references it again re-claims it (see planRoomReclaim's
   * resurrection branch). Absent on anything still claimed, and on legacy
   * unclaimed assets — those were never condemned and are never expired.
   */
  unreferencedAt?: number;
}

export class AssetRejectedError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "AssetRejectedError";
    this.statusCode = statusCode;
  }
}

export interface AssetServiceOptions {
  directory?: string;
  /** Per-asset ceiling. Default 5MB (mirrored client-side; change both or neither). */
  maxAssetBytes?: number;
  /** Whole-store quota. Default: derived from the real disk — see quota.ts. */
  maxTotalBytes?: number;
  /** Per-room quota, so one table cannot spend the whole store. Default: a
   * quarter of the resolved total, floored at 50MB. */
  maxRoomBytes?: number;
}

/**
 * An asset's claiming rooms. An index written before rooms existed has none —
 * those assets count against the whole-store quota (they are on the disk) but
 * against no room's, which is the right way round: charging them to a room that
 * may not have uploaded them would be a guess.
 */
export function roomsOf(asset: StoredAsset): string[] {
  return asset.rooms ?? [];
}
