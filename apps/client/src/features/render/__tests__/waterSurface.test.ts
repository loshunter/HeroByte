// Water II shore grammar (S1 foam lace + S2 sunlit shallows + S3 caustic web).
// Field-level: the foam collar hugs the shore and dissolves before the first
// band, the caustic web tints only the shallows, and neither term may touch a
// pixel beyond its reach — families without the knobs stay bit-identical
// (their arithmetic is pinned by the proceduralTerrain suite).

import { describe, expect, it } from "vitest";
import { createTerrainField, type TerrainFieldFamily } from "../proceduralTerrain";
import { causticWeightAt, foamMaskAt } from "../terrainFieldColor";
import { VILLAGE_TERRAIN } from "../terrainPalette";

const CELL = 16;
const GRASS = "terrain:grass";
const WATER = "terrain:test-water";
const FOAM = "#e0f0f0";
const CAUSTIC = "#c0e8e0";
const BAND_SHALLOW = "#60a0b0";
const BAND_DEEP = "#204060";

const hexToRgb = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

const GRASS_FAMILY: TerrainFieldFamily = {
  assetId: GRASS,
  priority: 3,
  base: "#7cb04a",
  rim: "#4a764e",
};

/** Mottle-free banded water so every rendered colour is exact and assertable. */
const waterFamily = (extra: Partial<TerrainFieldFamily>): TerrainFieldFamily => ({
  assetId: WATER,
  priority: 3.5,
  base: BAND_DEEP,
  rim: "#a0e0e0",
  edgeAmp: 0,
  rimWidth: 0.05,
  depthBands: [
    { maxCells: 2.5, base: BAND_SHALLOW },
    { maxCells: 4.5, base: BAND_DEEP },
  ],
  ...extra,
});

// A 14×14 pool inside a grass shore; cell depths mirror the Chebyshev
// distance transform (min distance to the pool edge + 1).
const POOL = { x0: 3, y0: 3, w: 14, h: 14 };
const depthOf = (assetId: string, cx: number, cy: number): number => {
  if (assetId !== WATER) return 0;
  if (cx < POOL.x0 || cx >= POOL.x0 + POOL.w || cy < POOL.y0 || cy >= POOL.y0 + POOL.h) return 0;
  const dx = Math.min(cx - POOL.x0, POOL.x0 + POOL.w - 1 - cx);
  const dy = Math.min(cy - POOL.y0, POOL.y0 + POOL.h - 1 - cy);
  return Math.min(dx, dy) + 1;
};

function poolField(extra: Partial<TerrainFieldFamily>) {
  const familyAt = (cx: number, cy: number): string | null => {
    if (cx < 0 || cy < 0 || cx >= 20 || cy >= 20) return null;
    return cx >= POOL.x0 && cx < POOL.x0 + POOL.w && cy >= POOL.y0 && cy < POOL.y0 + POOL.h
      ? WATER
      : GRASS;
  };
  return createTerrainField({
    familyAt,
    families: [GRASS_FAMILY, waterFamily(extra)],
    cellSize: CELL,
    originX: 0,
    originY: 0,
    depthOf,
  });
}

const sameRgb = (a: readonly number[] | null, hex: string): boolean => {
  const [r, g, b] = hexToRgb(hex);
  return a !== null && a[0] === r && a[1] === g && a[2] === b;
};

describe("foam lace collar (S1)", () => {
  it("paints foam pixels in the shallowest shore zone, keeping holes to the band colour", () => {
    const field = poolField({ foam: { color: FOAM, reach: 0.8 } });
    let foam = 0;
    let hole = 0;
    // The outer half of the first water row along the pool's top edge:
    // bilinear depth ≈ 0.5–0.8 — the collar zone.
    for (let wx = (POOL.x0 + 1) * CELL; wx < (POOL.x0 + POOL.w - 1) * CELL; wx += 1) {
      for (let wy = POOL.y0 * CELL; wy < POOL.y0 * CELL + CELL / 2; wy += 1) {
        const c = field.colorAt(wx + 0.5, wy + 0.5);
        if (sameRgb(c, FOAM)) foam += 1;
        else if (sameRgb(c, BAND_SHALLOW)) hole += 1;
      }
    }
    expect(foam).toBeGreaterThan(0); // the web exists
    expect(hole).toBeGreaterThan(0); // with holes punched through to the water
  });

  it("dissolves to nothing past its reach — deep pixels are pure band colours", () => {
    const field = poolField({ foam: { color: FOAM, reach: 0.8 } });
    for (let cy = POOL.y0 + 3; cy < POOL.y0 + POOL.h - 3; cy += 1) {
      for (let cx = POOL.x0 + 3; cx < POOL.x0 + POOL.w - 3; cx += 1) {
        const c = field.colorAt(cx * CELL + CELL / 2, cy * CELL + CELL / 2);
        expect(sameRgb(c, FOAM)).toBe(false);
      }
    }
  });

  it("does not disturb any pixel beyond its reach (bit-parity past the collar)", () => {
    const plain = poolField({});
    const foamy = poolField({ foam: { color: FOAM, reach: 0.8 } });
    // Depth ≥ 2 cells everywhere in this window — beyond reach 0.8 plus the
    // bilinear smoothing's one-cell support.
    for (let cy = POOL.y0 + 2; cy < POOL.y0 + POOL.h - 2; cy += 1) {
      for (let cx = POOL.x0 + 2; cx < POOL.x0 + POOL.w - 2; cx += 1) {
        const wx = cx * CELL + CELL / 2;
        const wy = cy * CELL + CELL / 2;
        expect(foamy.colorAt(wx, wy)).toEqual(plain.colorAt(wx, wy));
      }
    }
  });
});

describe("caustic web (S3)", () => {
  const knob = { caustics: { color: CAUSTIC, reach: 2, strength: 0.5 } };

  it("tints some shallow pixels between the band and the caustic colour", () => {
    const plain = poolField({});
    const lit = poolField(knob);
    const caustic = hexToRgb(CAUSTIC);
    let tinted = 0;
    for (let wx = (POOL.x0 + 1) * CELL; wx < (POOL.x0 + POOL.w - 1) * CELL; wx += 2) {
      const wy = POOL.y0 * CELL + CELL / 2; // first water row: d ≈ 1, fade ≈ ½
      const a = plain.colorAt(wx + 0.5, wy)!;
      const b = lit.colorAt(wx + 0.5, wy)!;
      if (a[0] === b[0] && a[1] === b[1] && a[2] === b[2]) continue;
      tinted += 1;
      // The web only ever mixes TOWARD the caustic colour.
      for (const ch of [0, 1, 2] as const) {
        const lo = Math.min(a[ch], caustic[ch]);
        const hi = Math.max(a[ch], caustic[ch]);
        expect(b[ch]).toBeGreaterThanOrEqual(lo);
        expect(b[ch]).toBeLessThanOrEqual(hi);
      }
    }
    expect(tinted).toBeGreaterThan(0);
  });

  it("fades to zero past its reach — the deeps render bit-identically", () => {
    const plain = poolField({});
    const lit = poolField(knob);
    for (let cy = POOL.y0 + 4; cy < POOL.y0 + POOL.h - 4; cy += 1) {
      for (let cx = POOL.x0 + 4; cx < POOL.x0 + POOL.w - 4; cx += 1) {
        const wx = cx * CELL + CELL / 2;
        const wy = cy * CELL + CELL / 2;
        expect(lit.colorAt(wx, wy)).toEqual(plain.colorAt(wx, wy));
      }
    }
  });
});

describe("degenerate knob values never NaN into the mix", () => {
  it("foam with a reach at/below the solid-collar depth is simply off", () => {
    for (const reach of [0, 0.1, 0.3]) {
      for (let i = 0; i < 50; i += 1) {
        expect(foamMaskAt(i * 3.7, i * 5.1, 42, 6, 0.05, reach)).toBe(false);
      }
    }
  });

  it("caustics with reach 0 weigh zero everywhere (no NaN)", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(causticWeightAt(i * 3.7, i * 5.1, 42, 12, 0, 0)).toBe(0);
      expect(causticWeightAt(i * 3.7, i * 5.1, 42, 12, 2, 0)).toBe(0);
    }
  });
});

describe("village water data (S2 sunlit shallows)", () => {
  const water = VILLAGE_TERRAIN["terrain:water"]!;
  const luma = (hex: string): number => {
    const [r, g, b] = hexToRgb(hex);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  it("pins the retuned first band: saturated sunlit turquoise, still shallow→deep ordered", () => {
    const bands = water.depthBands!;
    expect(bands[0]!.base).toBe("#4fbfae"); // deliberate S2 retune — change knowingly
    for (let i = 1; i < bands.length; i += 1) {
      expect(luma(bands[i]!.base)).toBeLessThan(luma(bands[i - 1]!.base));
    }
  });

  it("arms the foam collar inside the first band and the caustic web over the shallows", () => {
    expect(water.foam).toBeDefined();
    expect(water.foam!.reach).toBeLessThanOrEqual(water.depthBands![0]!.maxCells);
    expect(water.caustics).toBeDefined();
    expect(water.caustics!.reach).toBeLessThanOrEqual(
      water.depthBands![water.depthBands!.length - 1]!.maxCells,
    );
    expect(water.caustics!.strength).toBeGreaterThan(0);
    expect(water.caustics!.strength).toBeLessThan(1);
  });
});
