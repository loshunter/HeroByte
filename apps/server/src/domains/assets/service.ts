// ============================================================================
// ASSET SERVICE — content-addressed uploads (M3, VISION pillar 2/5)
// ============================================================================
// Uploaded images are sniffed (magic bytes, raster-only), capped, quota-
// checked, and stored on disk under their SHA-256 — identical uploads
// deduplicate to one file. The index persists via the same atomic
// tmp-and-rename + write-queue discipline as the other file stores.
// File-backed is the first-class dev/self-host path; object storage lands
// behind the same interface later.

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveServerPath } from "../../config/serverPaths.js";
import { sniffImageMime } from "./mimeSniff.js";
import {
  planClaimCopy,
  planRoomReclaim,
  planRoomRelease,
  type ClaimPlan,
} from "./assetRoomClaims.js";
import { resolveQuotaLimits, type AssetQuotaLimits } from "./quota.js";
import { loadAssetIndex, writeAssetIndex, type AssetIndex } from "./assetIndexStore.js";
import {
  AssetRejectedError,
  roomsOf,
  type AssetServiceOptions,
  type StoredAsset,
} from "./assetTypes.js";

const HASH_PATTERN = /^[a-f0-9]{64}$/;

export { AssetRejectedError, roomsOf } from "./assetTypes.js";
export type { AssetServiceOptions, StoredAsset } from "./assetTypes.js";

/** Uploads with no room header belong to the default table. */
const DEFAULT_ROOM = "default";

export class AssetService {
  private readonly directory: string;
  private readonly maxAssetBytes: number;
  private readonly quotaOptions: { maxTotalBytes?: number; maxRoomBytes?: number };
  private indexPromise: Promise<AssetIndex> | null = null;
  private limitsPromise: Promise<AssetQuotaLimits> | null = null;
  private mutationQueue: Promise<unknown> = Promise.resolve();

  constructor(options: AssetServiceOptions = {}) {
    // The default is anchored to the package root so uploads land in the same
    // store no matter which directory the server was launched from; explicit
    // option/env paths are the caller's choice and pass through untouched.
    this.directory =
      options.directory ?? process.env.HEROBYTE_ASSET_DIR ?? resolveServerPath("herobyte-assets");
    this.maxAssetBytes = options.maxAssetBytes ?? 5 * 1024 * 1024;
    this.quotaOptions = {
      maxTotalBytes: options.maxTotalBytes,
      maxRoomBytes: options.maxRoomBytes,
    };
  }

  /** Resolved once, lazily — the disk is measured on the first quota check. */
  private limits(index: AssetIndex): Promise<AssetQuotaLimits> {
    if (!this.limitsPromise) {
      this.limitsPromise = resolveQuotaLimits({
        directory: this.directory,
        storeBytes: Object.values(index.assets).reduce((sum, asset) => sum + asset.size, 0),
        options: this.quotaOptions,
      });
    }
    return this.limitsPromise;
  }

  /**
   * Sniff, cap, quota-check, and persist one upload. Throws AssetRejectedError.
   *
   * `roomId` is the room the upload belongs to — already verified by the route
   * (authService.verify(secret, roomId)), so it is trustworthy here. It exists
   * because the store used to have NO room concept at all, which made two things
   * shared that should not be:
   *
   *   QUOTA. One table filling the whole store returned 507 to every OTHER
   *   table. On the old free tier that self-healed on the 15-minute spin-down;
   *   on the persistent disk it would be permanent.
   *
   *   DEDUP. `deduplicated: true` answered "do these exact bytes exist ANYWHERE
   *   on this server?" — a cross-room existence oracle for anyone who could
   *   guess a file. It is now scoped to the asking room.
   *
   * Reads stay public and unauthenticated on purpose: the URL is a capability,
   * `<img>` cannot send headers, and the bytes are player-facing by intent.
   */
  async store(
    bytes: Buffer,
    roomId: string = DEFAULT_ROOM,
    timestamp: number = Date.now(),
  ): Promise<{ asset: StoredAsset; deduplicated: boolean }> {
    // Stateless checks run outside the lock (no shared state, no yield needed).
    if (bytes.length > this.maxAssetBytes) {
      throw new AssetRejectedError(
        `Asset is too large: ${bytes.length} bytes (limit ${this.maxAssetBytes})`,
        413,
      );
    }
    const sniffed = sniffImageMime(bytes);
    if (!sniffed) {
      throw new AssetRejectedError("Upload is not a supported image (png, jpeg, gif, webp)", 415);
    }
    const hash = createHash("sha256").update(bytes).digest("hex");

    // Everything that reads-then-mutates shared state runs serialized, so the
    // quota check, dedup, file write, and index write are atomic against other
    // stores. This closes three confirmed races at once (found by adversarial
    // review): a quota TOCTOU overshoot, an identical-upload tmp-path collision
    // crashing one request, and — since there is no separate write-queue — the
    // poison-on-first-failure that used to wedge all future uploads.
    return this.runExclusive(async () => {
      const index = await this.loadIndex();
      const existing = index.assets[hash];

      // Already ours: a true no-op, and the only case that reports dedup.
      if (existing && roomsOf(existing).includes(roomId)) {
        return { asset: existing, deduplicated: true };
      }

      // The bytes exist but this room has not claimed them. Charge this room's
      // quota and record the claim — but do NOT report deduplicated, which would
      // tell the caller these bytes exist in some OTHER room.
      if (existing) {
        const claimed = { ...existing, rooms: [...roomsOf(existing), roomId] };
        this.assertQuota(index, bytes.length, roomId, await this.limits(index));
        await this.writeIndex({
          schemaVersion: 1,
          assets: { ...index.assets, [hash]: claimed },
        });
        index.assets[hash] = claimed;
        return { asset: claimed, deduplicated: false };
      }

      this.assertQuota(index, bytes.length, roomId, await this.limits(index));

      await mkdir(this.directory, { recursive: true });
      const filePath = path.join(this.directory, `${hash}.${sniffed.extension}`);
      const tmpPath = `${filePath}.tmp`;
      await writeFile(tmpPath, bytes);
      await rename(tmpPath, filePath);

      const asset: StoredAsset = {
        hash,
        mime: sniffed.mime,
        extension: sniffed.extension,
        size: bytes.length,
        createdAt: timestamp,
        rooms: [roomId],
      };
      // Persist the index BEFORE committing to the in-memory copy, so a failed
      // write leaves both the on-disk index and memory consistent (the orphan
      // file re-attaches on the next identical upload via content addressing).
      const nextIndex: AssetIndex = {
        schemaVersion: 1,
        assets: { ...index.assets, [hash]: asset },
      };
      await this.writeIndex(nextIndex);
      index.assets[hash] = asset;
      return { asset, deduplicated: false };
    });
  }

  /**
   * Refuse an upload that would bust either ceiling.
   *
   * TWO quotas, and both are load-bearing. The per-room one is fairness: without
   * it one table's uploads returned 507 to every other table. The whole-store
   * one is physics: the disk is finite no matter how the rooms divide it.
   *
   * Called INSIDE runExclusive, which is what keeps the read-then-write atomic —
   * checking outside the lock would reintroduce the quota TOCTOU that an earlier
   * review already found here once.
   */
  private assertQuota(
    index: AssetIndex,
    incoming: number,
    roomId: string,
    limits: AssetQuotaLimits,
  ): void {
    const assets = Object.values(index.assets);
    const total = assets.reduce((sum, asset) => sum + asset.size, 0);
    if (total + incoming > limits.maxTotalBytes) {
      throw new AssetRejectedError("Asset storage quota exceeded", 507);
    }
    const roomTotal = assets
      .filter((asset) => roomsOf(asset).includes(roomId))
      .reduce((sum, asset) => sum + asset.size, 0);
    if (roomTotal + incoming > limits.maxRoomBytes) {
      throw new AssetRejectedError("This table's asset storage is full", 507);
    }
  }

  /**
   * Serialize a mutation against every other mutation. Rejection-resilient: a
   * failed op resolves the queue so the NEXT op still runs (a bare
   * `.then(op)` chain would poison every future upload on one transient error).
   */
  private runExclusive<T>(op: () => Promise<T>): Promise<T> {
    const result = this.mutationQueue.then(op, op);
    this.mutationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /** Bytes + mime for a stored hash; null for malformed or unknown hashes. */
  async read(hash: string): Promise<{ bytes: Buffer; mime: string } | null> {
    if (!HASH_PATTERN.test(hash)) return null;
    const index = await this.loadIndex();
    const asset = index.assets[hash];
    if (!asset) return null;
    try {
      const bytes = await readFile(path.join(this.directory, `${hash}.${asset.extension}`));
      return { bytes, mime: asset.mime };
    } catch {
      return null;
    }
  }

  async totalBytes(): Promise<number> {
    const index = await this.loadIndex();
    return Object.values(index.assets).reduce((sum, asset) => sum + asset.size, 0);
  }

  /** Bytes currently charged to one room's quota. */
  async roomBytes(roomId: string): Promise<number> {
    const index = await this.loadIndex();
    return Object.values(index.assets)
      .filter((asset) => roomsOf(asset).includes(roomId))
      .reduce((sum, asset) => sum + asset.size, 0);
  }

  /**
   * Add `toRoomId` as a co-claimant of everything `fromRoomId` holds — what a
   * table fork needs. Without it the copy references images it does not own,
   * and the next sweep of the source table releases the last claim and deletes
   * the bytes out from under it.
   *
   * Returns the number of assets the target now additionally claims.
   */
  async copyClaims(fromRoomId: string, toRoomId: string): Promise<number> {
    if (fromRoomId === toRoomId) return 0;
    return this.runExclusive(async () => {
      const index = await this.loadIndex();
      const plan = planClaimCopy(index.assets, fromRoomId, toRoomId);
      if (plan.claimed === 0) return 0;
      await this.writeIndex({ schemaVersion: 1, assets: plan.assets });
      index.assets = plan.assets;
      return plan.claimed;
    });
  }

  /**
   * Drop a room's claim on its uploads, deleting the bytes only once NO room
   * claims them. Content addressing means two tables can share one file, so
   * this un-claims rather than deleting outright — otherwise clearing the
   * public table would pull an image out from under a private one that
   * happened to upload the same bytes.
   *
   * Returns the bytes actually freed from disk.
   */
  async releaseRoom(roomId: string): Promise<number> {
    return this.runExclusive(async () => {
      const index = await this.loadIndex();
      return this.applyClaimPlan(index, planRoomRelease(index.assets, roomId));
    });
  }

  /**
   * Reconcile a room's claims against what its state references right now —
   * the replacement-leak fix. `referenced` comes from the caller's scan of the
   * room's serialized state + map documents (see assetReferences.ts); the
   * three-way mark/keep/un-claim split lives in planRoomReclaim.
   *
   * Returns the bytes actually freed from disk.
   */
  async reclaimRoom(roomId: string, referenced: ReadonlySet<string>): Promise<number> {
    return this.runExclusive(async () => {
      const index = await this.loadIndex();
      return this.applyClaimPlan(index, planRoomReclaim(index.assets, roomId, referenced));
    });
  }

  /** Persist a claim plan. Callers hold the mutation lock. */
  private async applyClaimPlan(index: AssetIndex, plan: ClaimPlan): Promise<number> {
    if (!plan.changed) return 0;

    // Index first, then unlink — the same ordering store() uses and for the
    // same reason: an index that no longer names a file is harmless (the
    // orphan re-attaches on the next identical upload), whereas a file
    // deleted while still indexed 404s forever.
    await this.writeIndex({ schemaVersion: 1, assets: plan.assets });
    index.assets = plan.assets;

    for (const asset of plan.orphaned) {
      await unlink(path.join(this.directory, `${asset.hash}.${asset.extension}`)).catch(() => {
        // Already gone, or the disk refused: the index no longer references
        // it, so this is a stray file at worst — never a broken reference.
      });
    }
    return plan.freed;
  }

  private loadIndex(): Promise<AssetIndex> {
    if (!this.indexPromise) {
      this.indexPromise = loadAssetIndex(this.directory);
    }
    return this.indexPromise;
  }

  private writeIndex(index: AssetIndex): Promise<void> {
    return writeAssetIndex(this.directory, index);
  }
}
