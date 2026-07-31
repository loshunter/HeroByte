// ============================================================================
// ASSET ROOM CLAIMS
// ============================================================================
// Pure index transforms behind AssetService.copyClaims / releaseRoom. Split out
// so the service stays under the structural size guard, and so the ownership
// rules are testable without touching a disk.
//
// Assets are content-addressed: two tables uploading the same image share ONE
// file, so ownership is a SET of rooms, not a field. Everything here follows
// from that — a room leaving is an un-claim, and bytes only die once the set
// empties.

import type { StoredAsset } from "./service.js";

type Assets = Record<string, StoredAsset>;

function roomsOf(asset: StoredAsset): string[] {
  return asset.rooms ?? [];
}

/** Add `toRoomId` alongside `fromRoomId` on every asset the source claims. */
export function planClaimCopy(
  assets: Assets,
  fromRoomId: string,
  toRoomId: string,
): { assets: Assets; claimed: number } {
  const next: Assets = {};
  let claimed = 0;

  for (const [hash, asset] of Object.entries(assets)) {
    const rooms = roomsOf(asset);
    if (rooms.includes(fromRoomId) && !rooms.includes(toRoomId)) {
      next[hash] = { ...asset, rooms: [...rooms, toRoomId] };
      claimed += 1;
    } else {
      next[hash] = asset;
    }
  }

  return { assets: next, claimed };
}

/**
 * Drop `roomId`'s claim. Assets another room still claims survive untouched —
 * which is what stops clearing the public table from deleting an image a
 * private table forked from it is still using.
 */
export function planRoomRelease(
  assets: Assets,
  roomId: string,
): { assets: Assets; orphaned: StoredAsset[]; freed: number; changed: boolean } {
  const next: Assets = {};
  const orphaned: StoredAsset[] = [];
  let freed = 0;
  let changed = false;

  for (const [hash, asset] of Object.entries(assets)) {
    const rooms = roomsOf(asset);
    if (!rooms.includes(roomId)) {
      next[hash] = asset;
      continue;
    }
    changed = true;
    const remaining = rooms.filter((room) => room !== roomId);
    if (remaining.length > 0) {
      next[hash] = { ...asset, rooms: remaining };
    } else {
      orphaned.push(asset);
      freed += asset.size;
    }
  }

  return { assets: next, orphaned, freed, changed };
}
