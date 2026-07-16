// ============================================================================
// TERRAIN BUDGET — the accumulation cap
// ============================================================================
// A single stroke is capped at 16384 cells, but nothing used to cap the TOTAL:
// enough scattered strokes shipped a 936KB snapshot past the server's 750KB
// guard (which only warns), and two perfectly legal strokes could cross the
// import chunk cap — a document that could not round-trip through its own
// backup. Paint and import now enforce the same budget (assertTerrainBudget),
// so a paintable document is always an importable one.

import { describe, expect, it } from "vitest";
import {
  MAX_TERRAIN_WIRE_BYTES,
  createTerrainMap,
  setTerrainCells,
  sanitizeTerrainMap,
  terrainWireBytes,
  type TerrainMap,
} from "../terrain.js";
import {
  createMapDocument,
  importMapDocument,
  paintTerrain,
  type TerrainPaintCell,
} from "../mapStudio.js";
import type { MapDocument } from "../mapStudioTypes.js";

const STROKE_CELL_CAP = 16384;

/** The RLE-hostile scatter from the snapshot-size measurements: ~22% fill,
 * no two painted cells adjacent, so nearly every cell is its own run pair. */
function scatterCells(side: number): TerrainPaintCell[] {
  const cells: TerrainPaintCell[] = [];
  for (let x = 0; x < side; x++) {
    for (let y = 0; y < side; y++) {
      if ((x * 7 + y * 13) % 9 < 2) {
        cells.push({ x, y, assetId: (x + y) % 2 ? "terrain:stone" : "terrain:wood" });
      }
    }
  }
  return cells;
}

/** One painted cell in each of `count` distinct chunks. */
function oneCellPerChunk(count: number): TerrainPaintCell[] {
  const cells: TerrainPaintCell[] = [];
  for (let index = 0; index < count; index++) {
    cells.push({ x: (index % 128) * 16, y: Math.floor(index / 128) * 16, assetId: "grass" });
  }
  return cells;
}

function paintInStrokes(document: MapDocument, cells: TerrainPaintCell[]): MapDocument {
  for (let offset = 0; offset < cells.length; offset += STROKE_CELL_CAP) {
    document = paintTerrain(document, cells.slice(offset, offset + STROKE_CELL_CAP), offset + 2);
  }
  return document;
}

describe("terrain budget", () => {
  it("rejects the stroke that would cross the import chunk cap (round-trip asymmetry)", () => {
    // Two legal strokes used to yield 16385 chunks — importable-cap + 1 — so
    // the backup of a legal document failed to restore.
    let document = createMapDocument({ id: "map-1", name: "Chunks", timestamp: 1 });
    document = paintTerrain(document, oneCellPerChunk(STROKE_CELL_CAP), 2);
    expect(Object.keys(document.terrain!.chunks)).toHaveLength(16384);

    expect(() =>
      paintTerrain(document, [{ x: 128 * 16, y: 199 * 16, assetId: "grass" }], 3),
    ).toThrow("Terrain map has too many chunks");

    // The map at the cap still round-trips through its own backup.
    const backup = JSON.parse(JSON.stringify(document)) as MapDocument;
    const restored = importMapDocument({ ...backup, id: "map-1b" }, 10);
    expect(Object.keys(restored.terrain!.chunks)).toHaveLength(16384);
  });

  it("rejects accumulated strokes once the wire budget is exceeded, and the last good map imports", () => {
    // Each individual stroke is legal; it is the TOTAL that used to grow
    // unbounded (~116k scattered cells shipped a 936KB snapshot).
    let document = createMapDocument({ id: "map-2", name: "Scatter", timestamp: 1 });
    const cells = scatterCells(724);
    let rejected: unknown;
    for (let offset = 0; offset < cells.length; offset += STROKE_CELL_CAP) {
      try {
        document = paintTerrain(document, cells.slice(offset, offset + STROKE_CELL_CAP), offset);
      } catch (error) {
        rejected = error;
        break;
      }
    }
    expect(String(rejected)).toMatch(/size budget/);
    expect(terrainWireBytes(document.terrain!)).toBeLessThanOrEqual(MAX_TERRAIN_WIRE_BYTES);

    const backup = JSON.parse(JSON.stringify(document)) as MapDocument;
    expect(() => importMapDocument({ ...backup, id: "map-2b" }, 10)).not.toThrow();
  });

  it("keeps the documented comfortable case paintable (384x384 scatter)", () => {
    let document = createMapDocument({ id: "map-3", name: "Roomy", timestamp: 1 });
    document = paintInStrokes(document, scatterCells(384));
    expect(terrainWireBytes(document.terrain!)).toBeLessThan(MAX_TERRAIN_WIRE_BYTES);
  });

  it("sanitizeTerrainMap rejects an over-budget map outright", () => {
    // Built with the raw codec, which is deliberately uncapped — the budget
    // belongs to the document boundaries (paint, import), not the codec.
    const oversized = setTerrainCells(createTerrainMap(), scatterCells(724));
    expect(terrainWireBytes(oversized)).toBeGreaterThan(MAX_TERRAIN_WIRE_BYTES);
    expect(() => sanitizeTerrainMap(oversized)).toThrow(/size budget/);
  });

  it("always lets a stroke SHRINK an over-budget legacy map — erasing is the way back under", () => {
    // The map store file persisted documents before the budget existed and
    // loads them unsanitized; a DM must be able to erase their way out.
    const oversized: TerrainMap = setTerrainCells(createTerrainMap(), scatterCells(724));
    const legacy: MapDocument = {
      ...createMapDocument({ id: "map-4", name: "Legacy", timestamp: 1 }),
      terrain: oversized,
    };

    const erase: TerrainPaintCell[] = scatterCells(724)
      .slice(0, STROKE_CELL_CAP)
      .map((cell) => ({ ...cell, assetId: null }));
    const shrunk = paintTerrain(legacy, erase, 2);
    expect(terrainWireBytes(shrunk.terrain!)).toBeLessThan(terrainWireBytes(oversized));

    // Growing it while over budget still throws.
    expect(() => paintTerrain(legacy, [{ x: 9000, y: 9000, assetId: "terrain:new" }], 3)).toThrow(
      /size budget/,
    );
  });
});
