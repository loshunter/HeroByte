// ============================================================================
// SESSION ASSETS — the bytes, not just the reference
// ============================================================================
// The gap these close: an `upload:<hash>` reference round-trips through a
// session file perfectly while the bytes it points at die with the server's
// ephemeral disk. Every field test passes; the DM restores and every custom
// token is a broken image.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionFile } from "@herobyte/shared";
import { collectAssetHashes, collectSessionAssets, restoreSessionAssets } from "../sessionAssets";
import { uploadAssetFile } from "../../map-studio/uploads/assetUpload";

vi.mock("../../map-studio/uploads/assetUpload", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  uploadAssetFile: vi.fn(),
}));

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function sessionFile(overrides: Partial<SessionFile> = {}): SessionFile {
  return {
    schemaVersion: 1,
    savedAt: 1,
    snapshot: { gridSize: 50 } as SessionFile["snapshot"],
    mapDocuments: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("collectAssetHashes", () => {
  it("finds references wherever they hide, without a field whitelist", () => {
    // The reason this is a generic scan: upload refs live in token.imageUrl,
    // prop.imageUrl, character.portrait/tokenImage, player.portrait, element
    // data.assetId, terrain cells and mapBackground — and that list grows.
    // Enumerating them is the whitelist mistake that lost the map once already.
    const file = sessionFile({
      snapshot: {
        gridSize: 50,
        mapBackground: `http://server/assets/${HASH_A}`,
        tokens: [{ id: "t", imageUrl: `http://server/assets/${HASH_B}` }],
        characters: [{ id: "c", portrait: `upload:${HASH_A}` }],
      } as never,
      mapDocuments: [
        { id: "d", elements: [{ id: "e", data: { assetId: `upload:${HASH_B}` } }] } as never,
      ],
    });

    expect(collectAssetHashes(file).sort()).toEqual([HASH_A, HASH_B].sort());
  });

  it("finds nothing in a session that only uses external image URLs", () => {
    // The imgur path — the primary one today. It needs no inlining at all.
    const file = sessionFile({
      snapshot: { gridSize: 50, mapBackground: "https://i.imgur.com/abc.png" } as never,
    });

    expect(collectAssetHashes(file)).toEqual([]);
  });

  it("does not mine its own inlined bytes for references", () => {
    // base64 can contain 64 hex chars by chance; re-collecting from the assets
    // array would invent hashes that were never referenced.
    const file = sessionFile({
      assets: [{ hash: HASH_A, mime: "image/png", bytes: btoa("x".repeat(200)) }],
    });

    expect(collectAssetHashes(file)).toEqual([]);
  });
});

describe("collectSessionAssets", () => {
  it("inlines the bytes behind every reference", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "image/png" },
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    vi.stubGlobal("fetch", fetchMock);

    const file = sessionFile({
      snapshot: { gridSize: 50, mapBackground: `http://s/assets/${HASH_A}` } as never,
    });
    const { assets, skipped } = await collectSessionAssets(file, "ws://s");

    expect(skipped).toEqual([]);
    expect(assets).toHaveLength(1);
    expect(assets[0]?.hash).toBe(HASH_A);
    expect(assets[0]?.mime).toBe("image/png");
    // Decode back to the exact bytes rather than compare a base64 string — binary
    // image data is the point, and a literal control char in an assertion is
    // invisible in a diff (this line originally read as an empty string).
    expect([...atob(assets[0]!.bytes)].map((c) => c.charCodeAt(0))).toEqual([1, 2, 3]);
  });

  it("skips an asset the server no longer has, rather than failing the save", async () => {
    // Its bytes are already gone. Refusing to save would deny the DM the rest of
    // their table over art they have lost either way — but it must be REPORTED.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    const file = sessionFile({
      snapshot: { gridSize: 50, mapBackground: `http://s/assets/${HASH_A}` } as never,
    });
    const { assets, skipped } = await collectSessionAssets(file, "ws://s");

    expect(assets).toEqual([]);
    expect(skipped).toEqual([HASH_A]);
  });
});

describe("restoreSessionAssets", () => {
  it("re-uploads through the real, credential-gated path", async () => {
    // A session file is DM-supplied input like any other: it must not get a
    // private door around the MIME sniffing, caps and quota the endpoint applies.
    vi.mocked(uploadAssetFile).mockResolvedValue({
      hash: HASH_A,
      url: `/assets/${HASH_A}`,
      mime: "image/png",
      size: 3,
      deduplicated: false,
    });

    const failed = await restoreSessionAssets(
      [{ hash: HASH_A, mime: "image/png", bytes: btoa("abc") }],
      { secret: "s", roomId: "r" },
      "ws://s",
    );

    expect(failed).toEqual([]);
    expect(uploadAssetFile).toHaveBeenCalledWith(
      expect.any(File),
      { secret: "s", roomId: "r" },
      "ws://s",
    );
  });

  it("reports a hash that came back different — every reference would dangle", async () => {
    // Content-addressing is the whole contract: same bytes, same id, so no
    // reference needs rewriting. A different hash means the bytes changed, and
    // silently "succeeding" would leave the DM with broken art and no warning.
    vi.mocked(uploadAssetFile).mockResolvedValue({
      hash: HASH_B,
      url: `/assets/${HASH_B}`,
      mime: "image/png",
      size: 3,
      deduplicated: false,
    });

    const failed = await restoreSessionAssets(
      [{ hash: HASH_A, mime: "image/png", bytes: btoa("abc") }],
      { secret: "s" },
      "ws://s",
    );

    expect(failed).toEqual([HASH_A]);
  });

  it("reports a failed upload rather than throwing away the whole load", async () => {
    vi.mocked(uploadAssetFile).mockRejectedValue(new Error("quota"));

    const failed = await restoreSessionAssets(
      [{ hash: HASH_A, mime: "image/png", bytes: btoa("abc") }],
      { secret: "s" },
      "ws://s",
    );

    expect(failed).toEqual([HASH_A]);
  });
});
