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
        /table's asset storage is full/i,
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
        /table's asset storage is full/i,
      );
    });
  });

  describe("copyClaims (table fork)", () => {
    it("survives the source table being cleared afterwards", () => {
      // The whole point. A forked table references the same content-addressed
      // bytes; without a claim of its own, the next hourly sweep of the test
      // table drops the last claim and deletes the images the copy is using.
      return (async () => {
        const service = new AssetService({ directory: TMP_DIR });
        const bytes = pngBytes("uploaded-on-the-test-table");
        const { asset } = await service.store(bytes, "default", 1);

        await service.copyClaims("default", "table-keeper");
        const freed = await service.releaseRoom("default"); // the hourly wipe

        expect(freed).toBe(0); // nothing left the disk
        expect(await service.read(asset.hash)).not.toBeNull();
        expect(await service.roomBytes("table-keeper")).toBe(bytes.length);
        expect(await service.roomBytes("default")).toBe(0);
      })();
    });

    it("ignores assets the source room does not claim", async () => {
      const service = new AssetService({ directory: TMP_DIR });
      await service.store(pngBytes("belongs-to-another-table"), "room-other", 1);

      expect(await service.copyClaims("default", "table-keeper")).toBe(0);
      expect(await service.roomBytes("table-keeper")).toBe(0);
    });

    it("is a no-op when copying a room onto itself", async () => {
      const service = new AssetService({ directory: TMP_DIR });
      await service.store(pngBytes("some-image"), "default", 1);

      expect(await service.copyClaims("default", "default")).toBe(0);
    });
  });

  describe("releaseRoom", () => {
    // Clearing the public table has to give its quota back, without disturbing
    // any other table that happens to hold the same bytes.

    it("deletes bytes no other room claims and frees the room's quota", async () => {
      const service = new AssetService({ directory: TMP_DIR });
      const bytes = pngBytes("only-the-public-table-has-this");
      const { asset } = await service.store(bytes, "default", 1);
      const file = path.join(TMP_DIR, `${asset.hash}.png`);
      expect(existsSync(file)).toBe(true);

      const freed = await service.releaseRoom("default");

      expect(freed).toBe(bytes.length);
      expect(existsSync(file)).toBe(false);
      expect(await service.totalBytes()).toBe(0);
      expect(await service.roomBytes("default")).toBe(0);
    });

    it("keeps bytes another room still claims, un-claiming only the cleared one", async () => {
      // Content addressing means two tables can share ONE file. Clearing the
      // public table must not pull an image out from under a private game.
      const service = new AssetService({ directory: TMP_DIR });
      const shared = pngBytes("uploaded-by-both-tables");
      const { asset } = await service.store(shared, "default", 1);
      await service.store(shared, "table-private", 2);
      const file = path.join(TMP_DIR, `${asset.hash}.png`);

      const freed = await service.releaseRoom("default");

      expect(freed).toBe(0); // nothing left the disk
      expect(existsSync(file)).toBe(true);
      expect(await service.roomBytes("default")).toBe(0); // quota given back
      expect(await service.roomBytes("table-private")).toBe(shared.length);
      expect(await service.read(asset.hash)).not.toBeNull(); // still serves
    });

    it("is a no-op for a room with no uploads", async () => {
      const service = new AssetService({ directory: TMP_DIR });
      await service.store(pngBytes("belongs-to-someone-else"), "room-a", 1);

      expect(await service.releaseRoom("default")).toBe(0);
      expect(await service.roomBytes("room-a")).toBeGreaterThan(0);
    });

    it("lets the room upload again afterwards, quota restored", async () => {
      // The point of the whole exercise: a table whose quota was full can be
      // used again after it is cleared.
      const service = new AssetService({
        directory: TMP_DIR,
        maxRoomBytes: 40,
        maxTotalBytes: 10_000,
      });
      await service.store(pngBytes("fills-the-small-quota"), "default", 1);
      await expect(service.store(pngBytes("over-the-quota-line"), "default", 2)).rejects.toThrow(
        /table's asset storage is full/i,
      );

      await service.releaseRoom("default");

      const after = await service.store(pngBytes("works-after-clearing"), "default", 3);
      expect(after.deduplicated).toBe(false);
    });
  });

  describe("reclaimRoom (replacement leak, arc §7.3)", () => {
    const GRACE = 7 * 24 * 60 * 60 * 1000;

    it("condemns a replaced upload, still serves it, then expires it after the grace", async () => {
      const service = new AssetService({ directory: TMP_DIR });
      const bytes = pngBytes("the-old-map-background");
      const { asset } = await service.store(bytes, "default", 1);
      const file = path.join(TMP_DIR, `${asset.hash}.png`);

      // Sweep 1: the state references it → the claim gets marked, not touched.
      expect(await service.reclaimRoom("default", new Set([asset.hash]), 1000)).toBe(0);
      expect(existsSync(file)).toBe(true);

      // Sweep 2: replaced. The room's quota is freed, but the bytes stay and
      // keep serving — references no scan can see get the grace to come back.
      expect(await service.reclaimRoom("default", new Set(), 2000)).toBe(0);
      expect(await service.roomBytes("default")).toBe(0);
      expect(existsSync(file)).toBe(true);
      expect(await service.read(asset.hash)).not.toBeNull();

      // Inside the grace: nothing expires. After it: the bytes leave the disk.
      expect(await service.expireCondemned(2000 + GRACE - 1)).toBe(0);
      const freed = await service.expireCondemned(2000 + GRACE);
      expect(freed).toBe(bytes.length);
      expect(existsSync(file)).toBe(false);
    });

    it("resurrects a condemned upload the room references again before expiry", async () => {
      const service = new AssetService({ directory: TMP_DIR });
      const bytes = pngBytes("undo-brings-me-back");
      const { asset } = await service.store(bytes, "default", 1);
      await service.reclaimRoom("default", new Set([asset.hash]), 1000); // mark
      await service.reclaimRoom("default", new Set(), 2000); // condemn

      // Undo restored the reference: the next sweep re-claims it.
      await service.reclaimRoom("default", new Set([asset.hash]), 3000);

      expect(await service.roomBytes("default")).toBe(bytes.length);
      // The pardon sticks: expiry far in the future no longer touches it.
      expect(await service.expireCondemned(3000 + GRACE * 10)).toBe(0);
      expect(await service.read(asset.hash)).not.toBeNull();
    });

    it("a re-upload of condemned bytes clears the expiry stamp", async () => {
      const service = new AssetService({ directory: TMP_DIR });
      const bytes = pngBytes("re-uploaded-in-time");
      const { asset } = await service.store(bytes, "default", 1);
      await service.reclaimRoom("default", new Set([asset.hash]), 1000);
      await service.reclaimRoom("default", new Set(), 2000); // condemn

      await service.store(bytes, "table-b", 3000); // same bytes, new table

      expect(await service.expireCondemned(2000 + GRACE * 10)).toBe(0);
      expect(await service.roomBytes("table-b")).toBe(bytes.length);
    });

    it("never deletes an upload the state has not referenced yet", async () => {
      // Palette stock and in-flight applies: claimed, never observed
      // referenced. Reclaim must leave them alone no matter how often it runs.
      const service = new AssetService({ directory: TMP_DIR });
      const { asset } = await service.store(pngBytes("my-stuff-palette-item"), "default", 1);

      await service.reclaimRoom("default", new Set(), 1000);
      await service.reclaimRoom("default", new Set(), 2000);

      expect(await service.read(asset.hash)).not.toBeNull();
      expect(await service.roomBytes("default")).toBeGreaterThan(0);
    });

    it("keeps shared bytes another room still claims", async () => {
      const service = new AssetService({ directory: TMP_DIR });
      const shared = pngBytes("both-tables-use-this");
      const { asset } = await service.store(shared, "default", 1);
      await service.store(shared, "table-b", 2);
      await service.reclaimRoom("default", new Set([asset.hash]), 1000);
      await service.reclaimRoom("table-b", new Set([asset.hash]), 1000);

      const freed = await service.reclaimRoom("default", new Set(), 2000);

      expect(freed).toBe(0);
      expect(await service.read(asset.hash)).not.toBeNull();
      expect(await service.roomBytes("table-b")).toBe(shared.length);
      expect(await service.roomBytes("default")).toBe(0);
      // Still claimed by table-b: nothing is condemned, nothing ever expires.
      expect(await service.expireCondemned(2000 + GRACE * 10)).toBe(0);
    });

    it("gives the quota back so the room can upload again", async () => {
      const service = new AssetService({
        directory: TMP_DIR,
        maxRoomBytes: 40,
        maxTotalBytes: 10_000,
      });
      const { asset } = await service.store(pngBytes("fills-the-small-quota"), "default", 1);
      await service.reclaimRoom("default", new Set([asset.hash]), 1000); // mark
      await expect(service.store(pngBytes("over-the-quota-line"), "default", 2)).rejects.toThrow(
        /table's asset storage is full/i,
      );

      await service.reclaimRoom("default", new Set(), 2000); // replaced

      const after = await service.store(pngBytes("works-after-reclaim"), "default", 3);
      expect(after.deduplicated).toBe(false);
    });

    it("survives an index round-trip: marks and condemnation stamps persist to disk", async () => {
      const first = new AssetService({ directory: TMP_DIR });
      const { asset } = await first.store(pngBytes("marked-then-reloaded"), "default", 1);
      await first.reclaimRoom("default", new Set([asset.hash]), 1000);

      // A fresh service (fresh index load) must still see the mark…
      const second = new AssetService({ directory: TMP_DIR });
      await second.reclaimRoom("default", new Set(), 2000); // condemns
      // …and a third must still see the condemnation stamp to expire it.
      const third = new AssetService({ directory: TMP_DIR });
      expect(await third.expireCondemned(2000 + GRACE)).toBeGreaterThan(0);
      expect(await third.read(asset.hash)).toBeNull();
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
