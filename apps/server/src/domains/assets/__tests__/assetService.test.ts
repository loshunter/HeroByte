import { createHash } from "node:crypto";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AssetRejectedError, AssetService } from "../service.js";

const TMP_DIR = path.join(process.cwd(), ".tmp", "asset-service-test");

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

    const result = await service.store(bytes, 1000);

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
    const first = await service.store(bytes, 1000);
    const second = await service.store(bytes, 2000);

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

    await expect(service.store(Buffer.from("<svg onload=alert(1)>"), 1)).rejects.toThrow(
      AssetRejectedError,
    );
    await expect(service.store(Buffer.alloc(0), 1)).rejects.toThrow(/not a supported image/i);
  });

  it("enforces the per-asset size cap and the total quota", async () => {
    const service = new AssetService({
      directory: TMP_DIR,
      maxAssetBytes: 32,
      maxTotalBytes: 48,
    });

    await expect(service.store(pngBytes("x".repeat(64)), 1)).rejects.toThrow(/large/i);

    await service.store(pngBytes("first-asset-under-cap!"), 1); // 30 bytes
    await expect(service.store(pngBytes("second-asset-tips-it"), 2)).rejects.toThrow(/quota/i);
  });

  it("serializes concurrent stores so the total quota is never overshot", async () => {
    // Room for 3 of these ~30-byte blobs; fire 10 at once.
    const service = new AssetService({ directory: TMP_DIR, maxTotalBytes: 96 });
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, index) =>
        service.store(pngBytes(`distinct-blob-number-${index}`), index),
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
    await service.store(pngBytes("first"), 1);

    // Poison one index write, then confirm the queue recovered.
    const failingDir = path.join(TMP_DIR, "index.json");
    rmSync(failingDir, { force: true });
    const spy = vi
      .spyOn(service as unknown as { writeIndex: () => Promise<void> }, "writeIndex")
      .mockRejectedValueOnce(new Error("simulated ENOSPC"));

    await expect(service.store(pngBytes("second"), 2)).rejects.toThrow(/ENOSPC/);
    spy.mockRestore();

    // A later upload must still succeed — the queue is not permanently poisoned.
    const recovered = await service.store(pngBytes("third"), 3);
    expect(recovered.deduplicated).toBe(false);
  });

  it("refuses malformed or unknown hashes on read — no path traversal", async () => {
    const service = new AssetService({ directory: TMP_DIR });
    await service.store(pngBytes("real"), 1);

    expect(await service.read("../../etc/passwd")).toBeNull();
    expect(await service.read("..%2f..%2fsecrets")).toBeNull();
    expect(await service.read("a".repeat(64))).toBeNull(); // well-formed, unknown
  });
});
