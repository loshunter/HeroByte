import { describe, expect, it } from "vitest";
import { createMapDocument, importMapDocument, paintTerrain } from "../mapStudio.js";
import { applyMapDocumentCommand } from "../mapStudioCommands.js";
import {
  createTerrainMap,
  getTerrainCell,
  sanitizeTerrainMap,
  setTerrainCell,
} from "../terrain.js";

describe("paintTerrain", () => {
  it("paints a stroke of cells into the document terrain in one revision", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });

    const painted = paintTerrain(
      document,
      [
        { x: 0, y: 0, assetId: "terrain:stone-floor" },
        { x: 1, y: 0, assetId: "terrain:stone-floor" },
        { x: 2, y: 0, assetId: "terrain:water" },
      ],
      20,
    );

    expect(painted.revision).toBe(document.revision + 1);
    expect(getTerrainCell(painted.terrain!, 0, 0)).toBe("terrain:stone-floor");
    expect(getTerrainCell(painted.terrain!, 2, 0)).toBe("terrain:water");
    // The source document is untouched.
    expect(document.terrain).toBeUndefined();
  });

  it("erases with null asset ids and drops the terrain field when it empties", () => {
    let document = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });
    document = paintTerrain(document, [{ x: 4, y: 4, assetId: "terrain:grass" }], 20);

    document = paintTerrain(document, [{ x: 4, y: 4, assetId: null }], 30);

    expect(document.terrain).toBeUndefined();
  });

  it("rejects non-integer cells, oversized strokes, and blank asset ids", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });

    expect(() => paintTerrain(document, [{ x: 0.5, y: 0, assetId: "a" }], 20)).toThrow(/integer/i);
    expect(() => paintTerrain(document, [{ x: 0, y: 0, assetId: "  " }], 20)).toThrow(/asset/i);
    expect(() => paintTerrain(document, [{ x: 999999, y: 0, assetId: "a" }], 20)).toThrow(/range/i);
    const oversized = Array.from({ length: 16385 }, (_, index) => ({
      x: index % 128,
      y: Math.floor(index / 128),
      assetId: "a",
    }));
    expect(() => paintTerrain(document, oversized, 20)).toThrow(/at most/i);
    expect(() => paintTerrain(document, [], 20)).toThrow(/at least/i);
  });

  it("refuses to grow the palette past the sanitizer's round-trip cap", () => {
    let document = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });
    const cells512 = Array.from({ length: 512 }, (_, index) => ({
      x: index % 128,
      y: Math.floor(index / 128),
      assetId: `terrain:variant-${index}`,
    }));
    document = paintTerrain(document, cells512, 20);

    expect(() =>
      paintTerrain(document, [{ x: 0, y: 100, assetId: "terrain:one-too-many" }], 30),
    ).toThrow(/at most 512/i);
  });

  it("applies as a paint-terrain command through the shared command pipeline", () => {
    const document = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });

    const applied = applyMapDocumentCommand(
      document,
      {
        commandId: "cmd-1",
        documentId: "map",
        baseRevision: document.revision,
        type: "paint-terrain",
        cells: [{ x: 3, y: 3, assetId: "terrain:stone-floor" }],
      },
      20,
    );

    expect(getTerrainCell(applied.document.terrain!, 3, 3)).toBe("terrain:stone-floor");
  });
});

describe("terrain import sanitization", () => {
  it("round-trips terrain through import", () => {
    let source = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });
    source = paintTerrain(source, [{ x: 2, y: 5, assetId: "terrain:water" }], 20);

    const imported = importMapDocument(source, 30);

    expect(getTerrainCell(imported.terrain!, 2, 5)).toBe("terrain:water");
  });

  it("rejects corrupt terrain payloads on import", () => {
    const source = createMapDocument({ id: "map", name: "Keep", timestamp: 10 });
    const corrupt = {
      ...source,
      terrain: {
        schemaVersion: 1 as const,
        palette: ["terrain:water"],
        chunks: { "0,0": [255, 1] }, // covers 255 cells, not 256
      },
    };

    expect(() => importMapDocument(corrupt, 30)).toThrow(/exactly/i);
  });
});

describe("sanitizeTerrainMap", () => {
  it("accepts a well-formed map and returns a defensive copy", () => {
    let map = createTerrainMap();
    map = setTerrainCell(map, 0, 0, "terrain:stone-floor");

    const sanitized = sanitizeTerrainMap(map);

    expect(sanitized).toEqual(map);
    expect(sanitized).not.toBe(map);
    expect(sanitized.chunks).not.toBe(map.chunks);
  });

  it("rejects bad versions, palettes, chunk keys, and out-of-palette values", () => {
    const good = setTerrainCell(createTerrainMap(), 0, 0, "a");

    expect(() => sanitizeTerrainMap({ ...good, schemaVersion: 2 as unknown as 1 })).toThrow(
      /version/i,
    );
    expect(() => sanitizeTerrainMap({ ...good, palette: [""] })).toThrow(/palette/i);
    expect(() =>
      sanitizeTerrainMap({ ...good, chunks: { "not-a-key": good.chunks["0,0"]! } }),
    ).toThrow(/chunk key/i);
    expect(
      () => sanitizeTerrainMap({ ...good, chunks: { "0,0": [256, 9] } }), // palette has 1 entry
    ).toThrow(/palette/i);
  });

  it("rejects non-canonical ghost chunk keys the codec would never write", () => {
    const good = setTerrainCell(createTerrainMap(), 0, 0, "a");
    const runs = good.chunks["0,0"]!;

    // "00,0" and "-0,0" would render via forEachTerrainCell but be
    // unreachable by get/set — permanent ghost terrain (review repro).
    expect(() => sanitizeTerrainMap({ ...good, chunks: { "00,0": runs } })).toThrow(/chunk key/i);
    expect(() => sanitizeTerrainMap({ ...good, chunks: { "-0,0": runs } })).toThrow(/chunk key/i);
    expect(() => sanitizeTerrainMap({ ...good, chunks: { "1e2,0": runs } })).toThrow(/chunk key/i);
    expect(() => sanitizeTerrainMap({ ...good, chunks: { "999999,0": runs } })).toThrow(/range/i);
    // The canonical key still passes.
    expect(sanitizeTerrainMap(good).chunks["0,0"]).toEqual(runs);
  });
});
