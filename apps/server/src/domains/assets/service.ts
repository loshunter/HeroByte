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
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveServerPath } from "../../config/serverPaths.js";
import { sniffImageMime } from "./mimeSniff.js";

const HASH_PATTERN = /^[a-f0-9]{64}$/;

export interface StoredAsset {
  hash: string;
  mime: string;
  extension: string;
  size: number;
  createdAt: number;
}

export class AssetRejectedError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "AssetRejectedError";
    this.statusCode = statusCode;
  }
}

interface AssetIndex {
  schemaVersion: 1;
  assets: Record<string, StoredAsset>;
}

export interface AssetServiceOptions {
  directory?: string;
  /** Per-asset ceiling. Default 5MB. */
  maxAssetBytes?: number;
  /** Total storage quota. Default 200MB (the free-tier number). */
  maxTotalBytes?: number;
}

export class AssetService {
  private readonly directory: string;
  private readonly maxAssetBytes: number;
  private readonly maxTotalBytes: number;
  private indexPromise: Promise<AssetIndex> | null = null;
  private mutationQueue: Promise<unknown> = Promise.resolve();

  constructor(options: AssetServiceOptions = {}) {
    // The default is anchored to the package root so uploads land in the same
    // store no matter which directory the server was launched from; explicit
    // option/env paths are the caller's choice and pass through untouched.
    this.directory =
      options.directory ?? process.env.HEROBYTE_ASSET_DIR ?? resolveServerPath("herobyte-assets");
    this.maxAssetBytes = options.maxAssetBytes ?? 5 * 1024 * 1024;
    this.maxTotalBytes = options.maxTotalBytes ?? 200 * 1024 * 1024;
  }

  /** Sniff, cap, quota-check, and persist one upload. Throws AssetRejectedError. */
  async store(
    bytes: Buffer,
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
      if (existing) {
        return { asset: existing, deduplicated: true };
      }

      const total = Object.values(index.assets).reduce((sum, asset) => sum + asset.size, 0);
      if (total + bytes.length > this.maxTotalBytes) {
        throw new AssetRejectedError("Asset storage quota exceeded", 507);
      }

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

  private loadIndex(): Promise<AssetIndex> {
    if (!this.indexPromise) {
      this.indexPromise = (async (): Promise<AssetIndex> => {
        try {
          const raw = await readFile(path.join(this.directory, "index.json"), "utf-8");
          const parsed = JSON.parse(raw) as AssetIndex;
          if (parsed?.schemaVersion === 1 && parsed.assets && typeof parsed.assets === "object") {
            return parsed;
          }
        } catch {
          // Missing or corrupt index: start fresh; stored files re-attach on
          // re-upload thanks to content addressing.
        }
        return { schemaVersion: 1, assets: {} };
      })();
    }
    return this.indexPromise;
  }

  // Callers hold the mutation lock, so a plain atomic write is safe here.
  private async writeIndex(index: AssetIndex): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const indexPath = path.join(this.directory, "index.json");
    const tmpPath = `${indexPath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(index, null, 2));
    await rename(tmpPath, indexPath);
  }
}
