import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "../../domains/auth/service.js";
import { AssetService } from "../../domains/assets/service.js";
import { RateLimiter } from "../../middleware/rateLimit.js";
import { createRoutes } from "../routes.js";

const TMP_ROOT = path.join(process.cwd(), ".tmp", "asset-routes-test");
const SECRET_PATH = path.join(TMP_ROOT, "secret.json");
const ASSET_DIR = path.join(TMP_ROOT, "assets");

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function pngBytes(payload: string): Buffer {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from(payload),
  ]);
}

function upload(body: Buffer, secret: string, roomId?: string) {
  const headers: Record<string, string> = {
    "content-type": "application/octet-stream",
    "content-length": String(body.length),
    "x-herobyte-secret": secret,
  };
  if (roomId) headers["x-herobyte-room"] = roomId;
  return new Request("http://test/assets", {
    method: "POST",
    headers,
    body: new Uint8Array(body),
  });
}

describe("asset HTTP routes", () => {
  beforeEach(() => mkdirSync(TMP_ROOT, { recursive: true }));

  afterEach(() => {
    if (existsSync(TMP_ROOT)) rmSync(TMP_ROOT, { recursive: true, force: true });
  });

  // A generous default limiter keeps the non-throttling tests untouched; the
  // rate-limit tests inject their own tightly-tuned instance.
  function makeApp(uploadLimiter?: RateLimiter, authService?: AuthService) {
    const auth = authService ?? new AuthService({ storagePath: SECRET_PATH });
    const assetService = new AssetService({ directory: ASSET_DIR });
    return createRoutes(auth, undefined, assetService, uploadLimiter);
  }

  it("rejects uploads without valid room credentials", async () => {
    const app = makeApp();

    const missing = await app.request(upload(pngBytes("x"), ""));
    expect(missing.status).toBe(401);

    const wrong = await app.request(upload(pngBytes("x"), "not-the-password"));
    expect(wrong.status).toBe(401);
  });

  it("stores a valid upload, deduplicates repeats, and serves it back immutably", async () => {
    const app = makeApp();
    const bytes = pngBytes("pixels");

    const created = await app.request(upload(bytes, "Fun1"));
    expect(created.status).toBe(201);
    const body = (await created.json()) as { hash: string; url: string; deduplicated: boolean };
    expect(body.deduplicated).toBe(false);
    expect(body.url).toBe(`/assets/${body.hash}`);

    const repeat = await app.request(upload(bytes, "Fun1"));
    expect(repeat.status).toBe(200);
    expect(((await repeat.json()) as { deduplicated: boolean }).deduplicated).toBe(true);

    const served = await app.request(new Request(`http://test/assets/${body.hash}`));
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
    expect(served.headers.get("cache-control")).toContain("immutable");
    expect(served.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await served.arrayBuffer()).equals(bytes)).toBe(true);
  });

  it("rejects non-image payloads", async () => {
    const app = makeApp();

    const html = Buffer.from("<script>alert(1)</script>");
    const sniffed = await app.request(upload(html, "Fun1"));
    expect(sniffed.status).toBe(415);
  });

  it("requires a Content-Length header (missing => 411)", async () => {
    const app = makeApp();

    const noLength = await app.request(
      new Request("http://test/assets", {
        method: "POST",
        headers: { "x-herobyte-secret": "Fun1" },
        body: new Uint8Array(pngBytes("no-length")),
      }),
    );
    expect(noLength.status).toBe(411);
  });

  it("fast-rejects an upload whose Content-Length exceeds the cap, before reading a byte", async () => {
    const app = makeApp();

    const res = await app.request(
      new Request("http://test/assets", {
        method: "POST",
        headers: {
          "x-herobyte-secret": "Fun1",
          "content-length": String(MAX_UPLOAD_BYTES + 1),
        },
        body: new Uint8Array(pngBytes("tiny")),
      }),
    );
    expect(res.status).toBe(413);
  });

  it("rejects an oversized body even when the Content-Length header understates it (streaming cap)", async () => {
    const app = makeApp();

    // The header lies — it claims 100 bytes — but the body is over the cap.
    // Content-Length is not trusted as the cap; the streaming byte count is.
    const oversized = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    oversized.set(pngBytes("x").subarray(0, 8), 0); // valid magic, still too big
    const res = await app.request(
      new Request("http://test/assets", {
        method: "POST",
        headers: { "x-herobyte-secret": "Fun1", "content-length": "100" },
        body: oversized,
      }),
    );
    expect(res.status).toBe(413);
  });

  it("throttles a burst of uploads then recovers after the window", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(1_000_000);
      const limiter = new RateLimiter({ maxMessages: 2, windowMs: 60_000 });
      const app = makeApp(limiter);

      expect((await app.request(upload(pngBytes("a"), "Fun1"))).status).toBe(201);
      expect((await app.request(upload(pngBytes("b"), "Fun1"))).status).toBe(201);

      const limited = await app.request(upload(pngBytes("c"), "Fun1"));
      expect(limited.status).toBe(429);
      expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);

      // Advance past the window: the credential's budget refills.
      vi.setSystemTime(1_000_000 + 61_000);
      const recovered = await app.request(upload(pngBytes("d"), "Fun1"));
      expect(recovered.status).toBe(201);
    } finally {
      vi.useRealTimers();
    }
  });

  it("meters uploads per credential, not globally", async () => {
    const limiter = new RateLimiter({ maxMessages: 1, windowMs: 60_000 });
    const auth = new AuthService({ storagePath: SECRET_PATH });
    auth.update("room-a-secret", "room-a"); // room-a now has its own credential
    const app = makeApp(limiter, auth);

    // Credential A (default room password) spends its single allowance.
    expect((await app.request(upload(pngBytes("a"), "Fun1"))).status).toBe(201);
    expect((await app.request(upload(pngBytes("a2"), "Fun1"))).status).toBe(429);

    // Credential B (room-a's own password) is on a separate bucket, unaffected.
    expect((await app.request(upload(pngBytes("b"), "room-a-secret", "room-a"))).status).toBe(201);
  });

  it("404s unknown and malformed asset hashes", async () => {
    const app = makeApp();

    expect((await app.request(new Request(`http://test/assets/${"a".repeat(64)}`))).status).toBe(
      404,
    );
    expect((await app.request(new Request("http://test/assets/not-a-hash"))).status).toBe(404);
  });
});
