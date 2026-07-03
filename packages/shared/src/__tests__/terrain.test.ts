import { describe, expect, it } from "vitest";
import {
  TERRAIN_CHUNK_SIZE,
  createTerrainMap,
  decodeTerrainChunk,
  encodeTerrainChunk,
  forEachTerrainCell,
  getTerrainCell,
  setTerrainCell,
} from "../terrain.js";

describe("terrain chunk codec", () => {
  it("round-trips a dense chunk through RLE", () => {
    const cells = new Array<number>(TERRAIN_CHUNK_SIZE * TERRAIN_CHUNK_SIZE).fill(0);
    cells[0] = 1;
    cells[1] = 1;
    cells[2] = 2;
    cells[255] = 3;

    const runs = encodeTerrainChunk(cells);
    expect(decodeTerrainChunk(runs)).toEqual(cells);
  });

  it("encodes uniform chunks as a single run", () => {
    const cells = new Array<number>(256).fill(5);
    expect(encodeTerrainChunk(cells)).toEqual([256, 5]);
  });

  it("rejects runs that do not cover exactly one chunk", () => {
    expect(() => decodeTerrainChunk([255, 1])).toThrow(/exactly/i);
    expect(() => decodeTerrainChunk([200, 1, 57, 0])).toThrow(/exactly/i);
    expect(() => decodeTerrainChunk([256, -1])).toThrow(/negative/i);
    expect(() => decodeTerrainChunk([0, 1, 256, 0])).toThrow(/positive/i);
  });
});

describe("terrain map", () => {
  it("stores and reads back painted cells, including negative coordinates", () => {
    let map = createTerrainMap();
    map = setTerrainCell(map, 3, 4, "terrain:stone-floor");
    map = setTerrainCell(map, -1, -1, "terrain:water");

    expect(getTerrainCell(map, 3, 4)).toBe("terrain:stone-floor");
    expect(getTerrainCell(map, -1, -1)).toBe("terrain:water");
    expect(getTerrainCell(map, 0, 0)).toBeNull();
  });

  it("reuses palette entries and overwrites cells immutably", () => {
    let map = createTerrainMap();
    map = setTerrainCell(map, 0, 0, "terrain:stone-floor");
    const before = map;
    map = setTerrainCell(map, 1, 0, "terrain:stone-floor");
    map = setTerrainCell(map, 0, 0, "terrain:water");

    expect(map.palette).toEqual(["terrain:stone-floor", "terrain:water"]);
    expect(getTerrainCell(map, 0, 0)).toBe("terrain:water");
    expect(getTerrainCell(before, 0, 0)).toBe("terrain:stone-floor");
    expect(getTerrainCell(before, 1, 0)).toBeNull();
  });

  it("erases cells and prunes chunks that empty out", () => {
    let map = createTerrainMap();
    map = setTerrainCell(map, 20, 20, "terrain:grass");
    expect(Object.keys(map.chunks)).toHaveLength(1);

    map = setTerrainCell(map, 20, 20, null);

    expect(getTerrainCell(map, 20, 20)).toBeNull();
    expect(Object.keys(map.chunks)).toHaveLength(0);
  });

  it("keeps one chunk per 16x16 region", () => {
    let map = createTerrainMap();
    map = setTerrainCell(map, 0, 0, "terrain:stone-floor");
    map = setTerrainCell(map, 15, 15, "terrain:stone-floor");
    map = setTerrainCell(map, 16, 0, "terrain:stone-floor");

    expect(Object.keys(map.chunks).sort()).toEqual(["0,0", "1,0"]);
  });

  it("iterates every painted cell exactly once", () => {
    let map = createTerrainMap();
    map = setTerrainCell(map, 1, 2, "terrain:stone-floor");
    map = setTerrainCell(map, 31, 2, "terrain:water");
    map = setTerrainCell(map, -5, 40, "terrain:grass");

    const seen: Array<[number, number, string]> = [];
    forEachTerrainCell(map, (cellX, cellY, assetId) => {
      seen.push([cellX, cellY, assetId]);
    });

    expect(seen).toHaveLength(3);
    expect(seen).toContainEqual([1, 2, "terrain:stone-floor"]);
    expect(seen).toContainEqual([31, 2, "terrain:water"]);
    expect(seen).toContainEqual([-5, 40, "terrain:grass"]);
  });

  it("golden: a painted plaza serializes to the pinned wire format", () => {
    // The determinism contract: this exact JSON is what travels and what
    // cartridges store. Changing it is a schema migration, not a refactor.
    let map = createTerrainMap();
    for (let x = 0; x < 4; x += 1) {
      for (let y = 0; y < 2; y += 1) {
        map = setTerrainCell(map, x, y, "terrain:stone-floor");
      }
    }
    map = setTerrainCell(map, 2, 1, "terrain:water");

    expect(JSON.stringify(map)).toBe(
      '{"schemaVersion":1,"palette":["terrain:stone-floor","terrain:water"],' +
        '"chunks":{"0,0":[4,1,12,0,2,1,1,2,1,1,236,0]}}',
    );
  });
});
