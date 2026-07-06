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
