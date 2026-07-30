// The chunked-bake contract (P3): band planning covers the buffer exactly,
// band cell-filtering keeps every painter that can reach a band, and — the
// keystone — the banded field render is BYTE-IDENTICAL to the whole-field
// render, because a band is the same pure world-space sampler with a shifted
// origin. If this pin holds, streaming changes scheduling, never pixels.

import { describe, expect, it } from "vitest";
import { buildProceduralFieldConfig } from "../../../render/proceduralTerrainSurface";
import { renderTerrainField } from "../../../render/proceduralTerrain";
import { VILLAGE_SHADOW_TINT, VILLAGE_TERRAIN } from "../../../render/terrainPalette";
import type { StructuredTerrainLayer, TerrainCellRect } from "../../../render/tileRenderCore";
import { bandLayers, planBakeBands } from "../terrainBakeChunks";

const GRID = { size: 20, offsetX: 0, offsetY: 0 };

function cells(coords: [number, number][]): TerrainCellRect[] {
  return coords.map(([cellX, cellY]) => ({
    x: cellX * GRID.size,
    y: cellY * GRID.size,
    size: GRID.size,
    cellX,
    cellY,
  }));
}

function block(assetId: string, x0: number, y0: number, w: number, h: number) {
  const coords: [number, number][] = [];
  for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) coords.push([x, y]);
  return { assetId, cells: cells(coords), edges: [] } satisfies StructuredTerrainLayer;
}

describe("planBakeBands", () => {
  it("tiles the full height exactly, in order, within the band bounds", () => {
    const bands = planBakeBands(8192, 5000);
    expect(bands[0]!.top).toBe(0);
    for (let i = 1; i < bands.length; i += 1) {
      expect(bands[i]!.top).toBe(bands[i - 1]!.top + bands[i - 1]!.height);
    }
    expect(bands.reduce((sum, band) => sum + band.height, 0)).toBe(5000);
    for (const band of bands.slice(0, -1)) {
      expect(band.height).toBeGreaterThanOrEqual(64);
      expect(band.height).toBeLessThanOrEqual(1024);
    }
  });

  it("keeps a small field in one band", () => {
    expect(planBakeBands(200, 200)).toEqual([{ top: 0, height: 200 }]);
  });
});

describe("bandLayers", () => {
  it("keeps cells within a cell-size margin of the band and drops empty layers", () => {
    const grass = block("terrain:grass", 0, 0, 1, 10); // one column, rows 0..9
    const far = block("terrain:dirt", 0, 30, 1, 1); // far below every band
    const banded = bandLayers([grass, far], 100, 160, GRID.size);
    expect(banded).toHaveLength(1);
    // Band world 100..160 = rows 5..7; the ±1-cell margin (inclusive at the
    // boundary) reaches rows 3..9. Over-keeping is safe — the band context
    // clips exact edges; dropping a reachable painter would not be.
    const ys = banded[0]!.cells.map((cell) => cell.cellY);
    expect(Math.min(...ys)).toBe(3);
    expect(Math.max(...ys)).toBe(9);
  });
});

describe("banded field render parity", () => {
  it("stitched bands are byte-identical to the whole-field render", () => {
    // Grass with a water pond inside — exercises depth bands, underfill and
    // the interleave machinery through the REAL village palette.
    const layers = [block("terrain:grass", 0, 0, 6, 6), block("terrain:water", 2, 2, 2, 2)];
    const built = buildProceduralFieldConfig(layers, GRID, VILLAGE_TERRAIN, VILLAGE_SHADOW_TINT);
    expect(built).not.toBeNull();
    const { config, width, height } = built!;

    const whole = new Uint8ClampedArray(width * height * 4);
    renderTerrainField(whole, width, height, config);

    const stitched = new Uint8ClampedArray(width * height * 4);
    // Force several bands (the field is small) to cross real seams.
    const bandHeight = Math.ceil(height / 3);
    for (let top = 0; top < height; top += bandHeight) {
      const h = Math.min(bandHeight, height - top);
      const band = new Uint8ClampedArray(width * h * 4);
      renderTerrainField(band, width, h, { ...config, originY: config.originY + top });
      stitched.set(band, top * width * 4);
    }

    expect(stitched).toEqual(whole);
  });
});
