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

import type { StoredAsset } from "./assetTypes.js";

type Assets = Record<string, StoredAsset>;

export interface ClaimPlan {
  assets: Assets;
  orphaned: StoredAsset[];
  freed: number;
  changed: boolean;
}

function roomsOf(asset: StoredAsset): string[] {
  return asset.rooms ?? [];
}

function referencedByOf(asset: StoredAsset): string[] {
  return asset.referencedBy ?? [];
}

/** Empty arrays serialize as absent, keeping the index shape stable. */
function orUndefined(rooms: string[]): string[] | undefined {
  return rooms.length > 0 ? rooms : undefined;
}

/**
 * Add `toRoomId` alongside `fromRoomId` on every asset the source claims. The
 * referenced-by mark copies too: the fork starts with the source's exact state,
 * so everything the source referenced, the fork references — without the copy,
 * a fork that replaced an image before the first sweep observed it would leave
 * the old claim unreclaimed forever.
 */
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
      const refs = referencedByOf(asset);
      next[hash] = {
        ...asset,
        rooms: [...rooms, toRoomId],
        referencedBy: orUndefined(refs.includes(fromRoomId) ? [...refs, toRoomId] : refs),
      };
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
export function planRoomRelease(assets: Assets, roomId: string): ClaimPlan {
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
      next[hash] = {
        ...asset,
        rooms: remaining,
        referencedBy: orUndefined(referencedByOf(asset).filter((room) => room !== roomId)),
      };
    } else {
      orphaned.push(asset);
      freed += asset.size;
    }
  }

  return { assets: next, orphaned, freed, changed };
}

/**
 * Reconcile `roomId`'s claims against the set of hashes its state actually
 * references right now — the replacement-leak fix (arc §7.3): before this,
 * releasing a claim required clearing the whole room, so every replaced
 * background/portrait/prop image stayed claimed forever.
 *
 * The split, driven by the per-room referenced-by mark:
 *
 *   referenced now            → mark the claim. A later disappearance is then
 *                               a replacement or removal, not a fresh upload.
 *   referenced, unclaimed,    → RESURRECT. A condemned asset some room still
 *   condemned                   (or again — Undo, another table's pasted URL)
 *                               references gets re-claimed by that room.
 *   marked, not referenced    → un-claim. On the LAST claim the entry is not
 *                               deleted but CONDEMNED (`unreferencedAt`): it
 *                               keeps serving through the grace window, so
 *                               references no scan can see — My Stuff
 *                               shelves, saved player files — survive, and
 *                               planCondemnedExpiry deletes the bytes only
 *                               once the grace passes with nobody coming
 *                               back. (Adversarial review: the immediate
 *                               delete this replaced broke Undo and the
 *                               shelf's "bytes live on the server" promise.)
 *   unmarked, not referenced  → NOT ours to take. An upload the state has
 *                               not caught up with, or palette stock. The
 *                               cost is that an upload abandoned before any
 *                               sweep observed it referenced leaks until the
 *                               room is cleared — bounded by the room quota.
 *
 * Resurrection deliberately skips legacy unclaimed assets (no
 * `unreferencedAt`): charging those to a room that may not have uploaded
 * them would be a guess — see roomsOf.
 */
export function planRoomReclaim(
  assets: Assets,
  roomId: string,
  referenced: ReadonlySet<string>,
  now: number,
): ClaimPlan {
  const next: Assets = {};
  let changed = false;

  for (const [hash, asset] of Object.entries(assets)) {
    const rooms = roomsOf(asset);
    const marked = referencedByOf(asset).includes(roomId);
    if (!rooms.includes(roomId)) {
      if (referenced.has(hash) && rooms.length === 0 && asset.unreferencedAt !== undefined) {
        next[hash] = {
          ...asset,
          rooms: [roomId],
          referencedBy: [roomId],
          unreferencedAt: undefined,
        };
        changed = true;
      } else {
        next[hash] = asset;
      }
      continue;
    }
    if (referenced.has(hash)) {
      if (!marked) {
        next[hash] = { ...asset, referencedBy: [...referencedByOf(asset), roomId] };
        changed = true;
      } else {
        next[hash] = asset;
      }
      continue;
    }
    if (!marked) {
      next[hash] = asset;
      continue;
    }
    changed = true;
    const remaining = rooms.filter((room) => room !== roomId);
    if (remaining.length > 0) {
      next[hash] = {
        ...asset,
        rooms: remaining,
        referencedBy: orUndefined(referencedByOf(asset).filter((room) => room !== roomId)),
      };
    } else {
      next[hash] = { ...asset, rooms: undefined, referencedBy: undefined, unreferencedAt: now };
    }
  }

  return { assets: next, orphaned: [], freed: 0, changed };
}

/**
 * Delete condemned assets whose grace has passed. Only entries stamped by
 * planRoomReclaim expire — a legacy unclaimed asset (no stamp) is never
 * touched, and anything re-claimed had its stamp cleared.
 */
export function planCondemnedExpiry(assets: Assets, now: number, graceMs: number): ClaimPlan {
  const next: Assets = {};
  const orphaned: StoredAsset[] = [];
  let freed = 0;
  let changed = false;

  for (const [hash, asset] of Object.entries(assets)) {
    const expired =
      roomsOf(asset).length === 0 &&
      asset.unreferencedAt !== undefined &&
      now - asset.unreferencedAt >= graceMs;
    if (expired) {
      changed = true;
      orphaned.push(asset);
      freed += asset.size;
    } else {
      next[hash] = asset;
    }
  }

  return { assets: next, orphaned, freed, changed };
}
