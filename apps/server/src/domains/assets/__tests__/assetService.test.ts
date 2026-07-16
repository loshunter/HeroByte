import { createHash } from "node:crypto";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AssetRejectedError, AssetService } from "../service.js";

const TMP_DIR = path.join(process.cwd(), ".tmp", "asset-service-test");

/**
 * The room these tests upload as. Uploads are room-scoped now — a room's quota
 * and its dedup answers are its own — so every store() has to say who is asking.
 */
const ROOM = "room-a";

function pngBytes(payload: string): Buffer {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from(payload),
  ]);
}

describe("AssetService", () => {
  beforeAll(() => mkdirSync(path.dirname(TMP_DIR), { recursive: true }));

  afterEach(() => {
    if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it("stores a sniffed image under its SHA-256 content address", async () => {
    const service = new AssetService({ directory: TMP_DIR });
    const bytes = pngBytes("pixels");

    const result = await service.store(bytes, ROOM, 1000);

    const expectedHash = createHash("sha256").update(bytes).digest("hex");
    expect(result.deduplicated).toBe(false);
    expect(result.asset).toMatchObject({
      hash: expectedHash,
      mime: "image/png",
      extension: "png",
      size: bytes.length,
      createdAt: 1000,
    });
    expect(existsSync(path.join(TMP_DIR, `${expectedHash}.png`))).toBe(true);

    const read = await service.read(expectedHash);
    expect(read?.mime).toBe("image/png");
    expect(read?.bytes.equals(bytes)).toBe(true);
  });

  it("deduplicates identical uploads and survives a reload", async () => {
    const service = new AssetService({ directory: TMP_DIR });
    const bytes = pngBytes("same");
    const first = await service.store(bytes, ROOM, 1000);
    const second = await service.store(bytes, ROOM, 2000);

    expect(second.deduplicated).toBe(true);
    expect(second.asset.hash).toBe(first.asset.hash);
    expect(second.asset.createdAt).toBe(1000); // original record kept
    expect(await service.totalBytes()).toBe(bytes.length); // counted once

    const reloaded = new AssetService({ directory: TMP_DIR });
    expect((await reloaded.read(first.asset.hash))?.bytes.equals(bytes)).toBe(true);
    expect(await reloaded.totalBytes()).toBe(bytes.length);
  });

  it("rejects content that fails the raster sniff, whatever it claims to be", async () => {
    const service = new AssetService({ directory: TMP_DIR });

    await expect(service.store(Buffer.from("<svg onload=alert(1)>"), ROOM, 1)).rejects.toThrow(
      AssetRejectedError,
    );
    await expect(service.store(Buffer.alloc(0), ROOM, 1)).rejects.toThrow(/not a supported image/i);
  });

  it("enforces the per-asset size cap and the total quota", async () => {
    const service = new AssetService({
      directory: TMP_DIR,
      maxAssetBytes: 32,
      maxTotalBytes: 48,
    });

    await expect(service.store(pngBytes("x".repeat(64)), ROOM, 1)).rejects.toThrow(/large/i);

    await service.store(pngBytes("first-asset-under-cap!"), ROOM, 1); // 30 bytes
    await expect(service.store(pngBytes("second-asset-tips-it"), ROOM, 2)).rejects.toThrow(
      /quota/i,
    );
  });

  it("serializes concurrent stores so the total quota is never overshot", async () => {
    // Room for 3 of these ~30-byte blobs; fire 10 at once.
    const service = new AssetService({ directory: TMP_DIR, maxTotalBytes: 96 });
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, index) =>
        service.store(pngBytes(`distinct-blob-number-${index}`), ROOM, index),
      ),
    );

    const accepted = results.filter((r) => r.status === "fulfilled").length;
    const rejected = results.filter((r) => r.status === "rejected").length;
    expect(accepted).toBeGreaterThan(0);
    expect(rejected).toBeGreaterThan(0);
    expect(await service.totalBytes()).toBeLessThanOrEqual(96);
  });

  it("deduplicates concurrent identical uploads without a tmp-path collision", async () => {
    const service = new AssetService({ directory: TMP_DIR });
    const bytes = pngBytes("the-same-bytes-many-times");

    const results = await Promise.all(Array.from({ length: 8 }, () => service.store(bytes)));

    // Exactly one real write; the rest dedup. No ENOENT crash.
    expect(results.filter((r) => !r.deduplicated)).toHaveLength(1);
    expect(results.every((r) => r.asset.hash === results[0]!.asset.hash)).toBe(true);
    expect(await service.totalBytes()).toBe(bytes.length);
  });

  it("keeps accepting uploads after a transient index-write failure", async () => {
    const service = new AssetService({ directory: TMP_DIR });
    await service.store(pngBytes("first"), ROOM, 1);

    // Poison one index write, then confirm the queue recovered.
    const failingDir = path.join(TMP_DIR, "index.json");
    rmSync(failingDir, { force: true });
    const spy = vi
      .spyOn(service as unknown as { writeIndex: () => Promise<void> }, "writeIndex")
      .mockRejectedValueOnce(new Error("simulated ENOSPC"));

    await expect(service.store(pngBytes("second"), ROOM, 2)).rejects.toThrow(/ENOSPC/);
    spy.mockRestore();

    // A later upload must still succeed — the queue is not permanently poisoned.
    const recovered = await service.store(pngBytes("third"), ROOM, 3);
    expect(recovered.deduplicated).toBe(false);
  });

  describe("room scoping", () => {
    // The store had NO room concept at all, so two things were shared that
    // should not have been: the quota and the dedup answer.

    it("does not let one room's uploads fill another room's quota", async () => {
      // THE BUG. One table filling the store returned 507 to every other table.
      // Today that self-heals on the free tier's 15-minute wipe; on a persistent
      // disk it is permanent — so this gets worse exactly when the disk lands.
      const service = new AssetService({
        directory: TMP_DIR,
        maxRoomBytes: 40,
        maxTotalBytes: 10_000,
      });

      await service.store(pngBytes("room-a-fills-its-own"), "room-a", 1); // ~28 bytes
      await expect(service.store(pngBytes("room-a-goes-over-now"), "room-a", 2)).rejects.toThrow(
        /room's asset storage is full/i,
      );

      // room-b is untouched by room-a's spending.
      const b = await service.store(pngBytes("room-b-is-unaffected"), "room-b", 3);
      expect(b.deduplicated).toBe(false);
    });

    it("still enforces the whole-store quota — the disk is finite", async () => {
      // Per-room fairness must not become a way to bust the actual disk: ten
      // rooms with generous personal quotas still share one filesystem.
      const service = new AssetService({
        directory: TMP_DIR,
        maxRoomBytes: 10_000,
        maxTotalBytes: 40,
      });

      await service.store(pngBytes("first-room-takes-it"), "room-a", 1);
      await expect(service.store(pngBytes("second-room-tips-it"), "room-b", 2)).rejects.toThrow(
        /storage quota exceeded/i,
      );
    });

    it("does not tell one room whether another room has the same bytes", async () => {
      // The dedup oracle: `deduplicated: true` used to answer "do these exact
      // bytes exist ANYWHERE on this server?" — across every room, to anyone who
      // could guess a file. Scoped to the asking room now.
      const service = new AssetService({ directory: TMP_DIR });
      const bytes = pngBytes("a-shared-image");

      const a = await service.store(bytes, "room-a", 1);
      const b = await service.store(bytes, "room-b", 2);

      expect(a.deduplicated).toBe(false);
      expect(b.deduplicated).toBe(false); // room-b learns nothing about room-a
      // ...but the DISK still holds one copy — content addressing is intact.
      expect(await service.totalBytes()).toBe(bytes.length);
      expect(b.asset.hash).toBe(a.asset.hash);
    });

    it("still reports dedup to the room that already uploaded it", async () => {
      // The control: scoping must not break dedup for its real purpose, which is
      // telling a room it already has this file.
      const service = new AssetService({ directory: TMP_DIR });
      const bytes = pngBytes("my-own-image");

      await service.store(bytes, "room-a", 1);
      const again = await service.store(bytes, "room-a", 2);

      expect(again.deduplicated).toBe(true);
    });

    it("charges a shared asset to every room that claims it", async () => {
      // Both rooms have the file, so both pay for it. Otherwise whoever uploaded
      // second would get it free, and a room could park its art in another room.
      const service = new AssetService({
        directory: TMP_DIR,
        maxRoomBytes: 40,
        maxTotalBytes: 10_000,
      });
      const shared = pngBytes("shared-between-rooms");

      await service.store(shared, "room-a", 1);
      await service.store(shared, "room-b", 2);

      // room-b's quota is now spent, even though the bytes were already on disk.
      await expect(service.store(pngBytes("room-b-second-file"), "room-b", 3)).rejects.toThrow(
        /room's asset storage is full/i,
      );
    });
  });

  it("refuses malformed or unknown hashes on read — no path traversal", async () => {
    const service = new AssetService({ directory: TMP_DIR });
    await service.store(pngBytes("real"), ROOM, 1);

    expect(await service.read("../../etc/passwd")).toBeNull();
    expect(await service.read("..%2f..%2fsecrets")).toBeNull();
    expect(await service.read("a".repeat(64))).toBeNull(); // well-formed, unknown
  });
});
