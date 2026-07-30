// Paired-family interleave + micro-grunge speckle (taxonomy catalog rank 12,
// the last ranked technique). Pins: echo islands actually cross the grass↔dirt
// seam in BOTH directions, the near-family gate keeps islands off unrelated
// seams, members register their OWN-body BFS (never the combined water call),
// knobless configs stay bit-identical, and the speckle darkens sparsely.

import { describe, expect, it } from "vitest";
import {
  createTerrainField,
  renderTerrainField,
  type TerrainFieldConfig,
} from "../proceduralTerrain";
import { buildProceduralFieldConfig } from "../proceduralTerrainSurface";
import { gradeTerrainPalette } from "../terrainNightGrade";
import { VILLAGE_TERRAIN } from "../terrainPalette";
import type { StructuredTerrainLayer, TerrainCellRect } from "../tileRenderCore";

const SIZE = 50;
const GRID = { size: SIZE, offsetX: 0, offsetY: 0 };

const cellRect = (cellX: number, cellY: number): TerrainCellRect => ({
  x: cellX * SIZE,
  y: cellY * SIZE,
  size: SIZE,
  cellX,
  cellY,
});

function block(assetId: string, x0: number, y0: number, x1: number, y1: number) {
  const cells: TerrainCellRect[] = [];
  for (let cy = y0; cy <= y1; cy += 1) {
    for (let cx = x0; cx <= x1; cx += 1) cells.push(cellRect(cx, cy));
  }
  return { assetId, cells, edges: [] } as StructuredTerrainLayer;
}

/** Greenness classifier: VILLAGE grass is g-dominant, dirt/path are r>g. */
const isGrassish = ([r, g]: [number, number, number]): boolean => g > r + 10;
const isDirtish = ([r, g]: [number, number, number]): boolean => r > g + 10;

describe("grass↔dirt interleave (echo islands)", () => {
  // A TALL seam (20 rows ≈ 8 shared-noise cells along it), so both noise
  // tails — the island pockets and the carve pockets — are statistically
  // guaranteed somewhere on the run: grass columns 0–7, dirt columns 8–15.
  const layers = [block("terrain:grass", 0, 0, 7, 19), block("terrain:dirt", 8, 0, 15, 19)];
  const built = buildProceduralFieldConfig(layers, GRID, VILLAGE_TERRAIN)!;
  const field = createTerrainField(built.config);

  const scan = (
    x0: number,
    x1: number,
    predicate: (rgb: [number, number, number]) => boolean,
  ): number => {
    let hits = 0;
    for (let wy = 60; wy < 940; wy += 4) {
      for (let wx = x0; wx < x1; wx += 4) {
        const c = field.colorAt(wx, wy);
        if (c && predicate(c)) hits += 1;
      }
    }
    return hits;
  };

  it("grass islands appear INSIDE dirt, a cell or more past the seam", () => {
    // Strip one to two cells inside dirt (columns 9–10 ⇒ 450–550px).
    expect(scan(455, 545, isGrassish)).toBeGreaterThan(0);
  });

  it("carves dirt through grass DEEPER than the organic seam ever reaches", () => {
    // Discriminating comparison: strip the knob and measure how far dirt
    // penetrates grass either way. The carve must beat every natural bump —
    // that's what makes it an echo hole, not seam wobble.
    const noKnob: Record<string, (typeof VILLAGE_TERRAIN)[string]> = {
      ...VILLAGE_TERRAIN,
      "terrain:grass": { ...VILLAGE_TERRAIN["terrain:grass"]!, interleave: undefined },
    };
    const plain = createTerrainField(buildProceduralFieldConfig(layers, GRID, noKnob)!.config);
    const leftmostDirt = (fld: typeof field): number => {
      let min = Infinity;
      for (let wy = 60; wy < 940; wy += 2) {
        for (let wx = 150; wx < 430; wx += 2) {
          const c = fld.colorAt(wx, wy);
          if (c && isDirtish(c)) {
            if (wx < min) min = wx;
            break;
          }
        }
      }
      return min;
    };
    expect(leftmostDirt(field)).toBeLessThan(leftmostDirt(plain) - 15);
  });

  it("island cores stay solid: deep interiors keep their own family", () => {
    // Interior-only scans: the outer silhouette (vs empty) legitimately shows
    // underfill slivers at its receded bumps — a shipped, unrelated artifact —
    // so stay a full cell clear of every outer edge.
    let dirtInGrassCore = 0;
    let grassInDirtCore = 0;
    for (let wy = 100; wy < 900; wy += 4) {
      for (let wx = 60; wx < 140; wx += 4) {
        const c = field.colorAt(wx, wy);
        if (c && isDirtish(c)) dirtInGrassCore += 1;
      }
      for (let wx = 660; wx < 750; wx += 4) {
        const c = field.colorAt(wx, wy);
        if (c && isGrassish(c)) grassInDirtCore += 1;
      }
    }
    expect(dirtInGrassCore).toBe(0);
    expect(grassInDirtCore).toBe(0);
  });

  it("registers BOTH members as their own BFS bodies", () => {
    expect(built.config.depthOf!("terrain:grass", 3, 5)).toBeGreaterThanOrEqual(2);
    expect(built.config.depthOf!("terrain:dirt", 12, 5)).toBeGreaterThanOrEqual(2);
    expect(built.config.depthOf!("terrain:grass", 12, 5)).toBe(0); // not fused
  });

  it("is deterministic bake to bake", { timeout: 30000 }, () => {
    // A compact seam keeps the double per-pixel bake affordable.
    const small = buildProceduralFieldConfig(
      [block("terrain:grass", 0, 0, 4, 4), block("terrain:dirt", 5, 0, 9, 4)],
      GRID,
      VILLAGE_TERRAIN,
    )!;
    const render = () => {
      const pixels = new Uint8ClampedArray(small.width * small.height * 4);
      renderTerrainField(pixels, small.width, small.height, small.config);
      return pixels;
    };
    expect(render()).toEqual(render());
  });
});

describe("the near-family gate (no islands on unrelated seams)", () => {
  it("a grass echo never spawns beside a dirt↔path seam with no grass in sight", () => {
    // Dirt meets PATH far from any grass: grass columns 0–2, a 3-column gap
    // of path, then dirt 6–13 meeting path again at columns 14–15.
    const layers = [
      block("terrain:grass", 0, 0, 2, 9),
      block("terrain:path", 3, 0, 5, 9),
      block("terrain:dirt", 6, 0, 13, 9),
      block("terrain:path", 14, 0, 15, 9),
    ];
    const built = buildProceduralFieldConfig(layers, GRID, VILLAGE_TERRAIN)!;
    const field = createTerrainField(built.config);
    // The dirt↔path seam at column 13/14 sits 11 cells from the nearest
    // grass; scan dirt columns 12–13 (600–700px) for any grass green.
    let grassHits = 0;
    for (let wy = 60; wy < 440; wy += 4) {
      for (let wx = 605; wx < 695; wx += 4) {
        const c = field.colorAt(wx, wy);
        if (c && isGrassish(c)) grassHits += 1;
      }
    }
    expect(grassHits).toBe(0);
  });
});

describe("micro-grunge speckle", () => {
  const bake = (config: TerrainFieldConfig, w: number, h: number) => {
    const pixels = new Uint8ClampedArray(w * h * 4);
    renderTerrainField(pixels, w, h, config);
    return pixels;
  };
  const base = (speckle?: { amp: number; chance: number }): TerrainFieldConfig => ({
    familyAt: (cx, cy) => (cx >= 0 && cx < 8 && cy >= 0 && cy < 8 ? "d" : null),
    families: [
      {
        assetId: "d",
        priority: 2,
        base: "#60482e",
        rim: "#4a3420",
        mottle: { amp: 0.05, scale: 4 },
        ...(speckle ? { speckle } : {}),
      },
    ],
    cellSize: SIZE,
    originX: 0,
    originY: 0,
  });

  it("darkens a sparse fraction of pixels and nothing else", () => {
    const w = 8 * SIZE;
    const plain = bake(base(), w, w);
    const speckled = bake(base({ amp: 0.1, chance: 0.05 }), w, w);
    let differing = 0;
    let brightened = 0;
    for (let o = 0; o < plain.length; o += 4) {
      if (plain[o + 3] === 0) continue;
      const same =
        plain[o] === speckled[o] &&
        plain[o + 1] === speckled[o + 1] &&
        plain[o + 2] === speckled[o + 2];
      if (same) continue;
      differing += 1;
      const darker =
        speckled[o]! <= plain[o]! &&
        speckled[o + 1]! <= plain[o + 1]! &&
        speckled[o + 2]! <= plain[o + 2]!;
      if (!darker) brightened += 1;
    }
    const painted = (w * w * 3) / 4; // interior estimate, ignores rim overhang
    expect(differing).toBeGreaterThan(0);
    expect(differing / painted).toBeLessThan(0.1); // sparse, not a wash
    expect(brightened).toBe(0); // speckle only ever darkens
  });

  // Two full 400px parity bakes — legitimately ~4s, and the default 5s
  // budget flakes under batched-run parallelism (island benchmark arc).
  it("chance 0 (or no knob) is bit-identical — the parity default", () => {
    expect(bake(base(), 8 * SIZE, 8 * SIZE)).toEqual(
      bake(base({ amp: 0.1, chance: 0 }), 8 * SIZE, 8 * SIZE),
    );
  }, 20_000);
});

describe("structural knobs survive the night grade", () => {
  it("interleave, speckle, scatter/row data pass through ungraded", () => {
    const night = gradeTerrainPalette(VILLAGE_TERRAIN, 1);
    expect(night["terrain:grass"]!.interleave).toEqual(
      VILLAGE_TERRAIN["terrain:grass"]!.interleave,
    );
    expect(night["terrain:dirt"]!.speckle).toEqual(VILLAGE_TERRAIN["terrain:dirt"]!.speckle);
  });
});
