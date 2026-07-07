import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetTileAtlasForTests,
  createTileAtlas,
  loadTileAtlas,
  variantIndexForCell,
  type TileAtlasManifest,
} from "../tileAtlas";

const MANIFEST: TileAtlasManifest = {
  version: 1,
  image: "tileset-v1.png",
  tileSize: 128,
  columns: 5,
  families: {
    "terrain:stone-floor": {
      variants: [
        { col: 0, row: 3 },
        { col: 1, row: 3 },
        { col: 2, row: 3 },
        { col: 3, row: 3 },
        { col: 4, row: 3 },
      ],
    },
    "terrain:mono": { variants: [{ col: 2, row: 0 }] },
  },
};

// A manifest whose grass family also carries a quarter-tile (blob47) region.
// Region origin is in TILE units; the region is a 5-wide (variant 0..4) ×
// 4-tall (corner tl,tr,bl,br) grid of 64px quarters (tileSize 128 → q 64).
const BLOB_MANIFEST: TileAtlasManifest = {
  version: 1,
  image: "tileset-v1.png",
  tileSize: 128,
  columns: 5,
  families: {
    "terrain:grass": {
      variants: [{ col: 0, row: 0 }],
      blob47: { col: 2, row: 1 }, // pixel origin (256, 128)
    },
    "terrain:stone-floor": { variants: [{ col: 0, row: 3 }] }, // no blob47
  },
};

describe("variantIndexForCell", () => {
  it("is deterministic and in range, including negative cells", () => {
    for (const [x, y] of [
      [0, 0],
      [7, 3],
      [-4, 12],
      [-9, -9],
      [1000, -1000],
    ]) {
      const index = variantIndexForCell(x!, y!, 5);
      expect(index).toBe(variantIndexForCell(x!, y!, 5));
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(5);
    }
  });

  it("spreads variants across a region instead of picking one", () => {
    const seen = new Set<number>();
    for (let x = 0; x < 10; x += 1) {
      for (let y = 0; y < 10; y += 1) {
        seen.add(variantIndexForCell(x, y, 5));
      }
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("returns 0 for single-variant families", () => {
    expect(variantIndexForCell(42, 17, 1)).toBe(0);
  });
});

describe("createTileAtlas", () => {
  const image = {} as CanvasImageSource;
  const atlas = createTileAtlas(MANIFEST, image);

  it("maps a cell to its variant's pixel rect", () => {
    const rect = atlas.tileForCell("terrain:stone-floor", 0, 0);
    const variant = variantIndexForCell(0, 0, 5);
    expect(rect).toEqual({ x: variant * 128, y: 3 * 128, size: 128 });
  });

  it("returns null for families outside the manifest (water stays flat)", () => {
    expect(atlas.tileForCell("terrain:water", 0, 0)).toBeNull();
    expect(atlas.tileForCell(`upload:${"a".repeat(64)}`, 1, 1)).toBeNull();
  });

  it("always picks the only variant of a single-variant family", () => {
    expect(atlas.tileForCell("terrain:mono", 123, -456)).toEqual({ x: 256, y: 0, size: 128 });
  });

  it("returns no quarter rects for families without a blob47 region", () => {
    expect(atlas.quarterRectsForCell("terrain:stone-floor", 0, 0, 255)).toBeNull();
    expect(atlas.quarterRectsForCell("terrain:water", 0, 0, 0)).toBeNull();
  });
});

describe("createTileAtlas — quarterRectsForCell (blob47)", () => {
  const image = {} as CanvasImageSource;
  const atlas = createTileAtlas(BLOB_MANIFEST, image);
  // Region origin at tile (2,1) → pixel (256, 128); quarter size 64.
  const ORIGIN_X = 256;
  const ORIGIN_Y = 128;
  const Q = 64;
  // Quarters are laid out variant-across (x), corner-down (y): tl=row0, tr=row1,
  // bl=row2, br=row3. Rect x = originX + variant*Q; y = originY + cornerRow*Q.
  const rect = (variant: number, cornerRow: number) => ({
    x: ORIGIN_X + variant * Q,
    y: ORIGIN_Y + cornerRow * Q,
    size: Q,
  });

  it("returns null for families that are not in the manifest", () => {
    expect(atlas.quarterRectsForCell("terrain:lava", 0, 0, 255)).toBeNull();
  });

  it("slices four outer-corner quarters for a fully isolated cell (mask 0)", () => {
    // Every corner is variant 0 (outer corner).
    expect(atlas.quarterRectsForCell("terrain:grass", 0, 0, 0)).toEqual([
      rect(0, 0), // tl
      rect(0, 1), // tr
      rect(0, 2), // bl
      rect(0, 3), // br
    ]);
  });

  it("slices four fill quarters for a fully surrounded cell (mask 255)", () => {
    expect(atlas.quarterRectsForCell("terrain:grass", 3, 7, 255)).toEqual([
      rect(4, 0), // tl fill
      rect(4, 1), // tr fill
      rect(4, 2), // bl fill
      rect(4, 3), // br fill
    ]);
  });

  it("slices per-corner variants for a mixed mask (N only → [2,2,0,0])", () => {
    // North neighbor present: both north corners see a vertical edge (variant 2),
    // both south corners are outer corners (variant 0).
    expect(atlas.quarterRectsForCell("terrain:grass", 0, 0, 1)).toEqual([
      rect(2, 0), // tl vertical edge
      rect(2, 1), // tr vertical edge
      rect(0, 2), // bl outer
      rect(0, 3), // br outer
    ]);
  });

  it("is position-independent — the same mask slices the same rects at any cell", () => {
    expect(atlas.quarterRectsForCell("terrain:grass", 5, -3, 1)).toEqual(
      atlas.quarterRectsForCell("terrain:grass", 0, 0, 1),
    );
  });
});

describe("loadTileAtlas", () => {
  afterEach(() => {
    __resetTileAtlasForTests();
    vi.unstubAllGlobals();
  });

  it("fetches the manifest, loads the image, and resolves a working atlas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(MANIFEST), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const sources: string[] = [];
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        set src(value: string) {
          sources.push(value);
          queueMicrotask(() => this.onload?.());
        }
      },
    );

    const atlas = await loadTileAtlas();

    expect(sources).toEqual(["/tiles/tileset-v1.png"]);
    expect(atlas).not.toBeNull();
    expect(atlas!.tileForCell("terrain:mono", 0, 0)).toEqual({ x: 256, y: 0, size: 128 });
  });

  it("resolves null when the manifest is missing, and caches the result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("gone", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await loadTileAtlas()).toBeNull();
    expect(await loadTileAtlas()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resolves null when the image fails to load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(MANIFEST), { status: 200 })),
    );
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        set src(_value: string) {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );

    expect(await loadTileAtlas()).toBeNull();
  });
});
