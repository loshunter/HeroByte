import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { AuthService } from "../../domains/auth/service.js";
import { AssetService } from "../../domains/assets/service.js";
import { createRoutes } from "../routes.js";

const TMP_ROOT = path.join(process.cwd(), ".tmp", "asset-routes-test");
const SECRET_PATH = path.join(TMP_ROOT, "secret.json");
const ASSET_DIR = path.join(TMP_ROOT, "assets");

function pngBytes(payload: string): Buffer {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from(payload),
  ]);
}

function upload(body: Buffer, secret: string) {
  return new Request("http://test/assets", {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "content-length": String(body.length),
      "x-herobyte-secret": secret,
    },
    body: new Uint8Array(body),
  });
}

describe("asset HTTP routes", () => {
  beforeAll(() => mkdirSync(TMP_ROOT, { recursive: true }));

  afterEach(() => {
    if (existsSync(TMP_ROOT)) rmSync(TMP_ROOT, { recursive: true, force: true });
  });

  function makeApp() {
    const authService = new AuthService({ storagePath: SECRET_PATH });
    const assetService = new AssetService({ directory: ASSET_DIR });
    return createRoutes(authService, undefined, assetService);
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

  it("rejects non-image payloads and missing content-length", async () => {
    const app = makeApp();

    const html = Buffer.from("<script>alert(1)</script>");
    const sniffed = await app.request(upload(html, "Fun1"));
    expect(sniffed.status).toBe(415);

    const noLength = await app.request(
      new Request("http://test/assets", {
        method: "POST",
        headers: { "x-herobyte-secret": "Fun1" },
        body: new Uint8Array(pngBytes("x")),
      }),
    );
    expect(noLength.status).toBe(411);
  });

  it("404s unknown and malformed asset hashes", async () => {
    const app = makeApp();

    expect((await app.request(new Request(`http://test/assets/${"a".repeat(64)}`))).status).toBe(
      404,
    );
    expect((await app.request(new Request("http://test/assets/not-a-hash"))).status).toBe(404);
  });
});
