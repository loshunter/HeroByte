// Procedural terrain decoration — pure, dependency-free.
//
// The blob47 atlas draws terrain SHAPE (silhouette + rim). This paints the
// interior DECORATION on top: grass blades, coherent tall-grass blobs, and
// flower clusters. Everything is derived from deterministic value noise keyed
// on the cell's lattice indices, so it is:
//   • spatially COHERENT — low-frequency noise makes detail clump into organic
//     patches (the tall-grass "blobs") instead of uniform per-cell scatter;
//   • CONSISTENT across surfaces (editor / table / export all compute the same
//     noise for the same cell) and stable across redraws;
//   • infinitely varied — no tile repeats, and nothing is baked into the atlas.
//
// Detail scales with `cell.size` (world px), so it stays proportional at any
// zoom. Only the grass family is decorated today; other families no-op.

import type { TerrainCellRect, TileRenderContext2D } from "./tileRenderCore";

const GRASS_ASSET_ID = "terrain:grass";

// Blade + flower palette.
const BLADE_LIGHT = "#9cc85a"; // sparse blades in open grass
const BLADE_DENSE = "#4a8a6a"; // cooler, taller blades inside tall-grass blobs
const PETAL = "#ebebd0";
const PETAL_PINK = "#d68aa8";
const FLOWER_CENTER = "#e6c84f";
const FLOWER_STEM = "#4f8236";

// --- deterministic hash + value noise (0..1) ---
function hash2(x: number, y: number, seed: number): number {
  let h =
    (Math.imul(x | 0, 374761393) ^
      Math.imul(y | 0, 668265263) ^
      Math.imul(seed | 0, 2246822519)) >>>
    0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const smoothstep = (t: number) => t * t * (3 - 2 * t);
function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  const u = smoothstep(xf);
  const v = smoothstep(yf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/** Tall-grass density field (two octaves + a small per-cell dither so blob
 * edges stipple instead of stepping on cell boundaries). */
function grassDensity(cellX: number, cellY: number): number {
  return (
    0.65 * valueNoise(cellX / 7, cellY / 7, 1) +
    0.35 * valueNoise(cellX / 3, cellY / 3, 7) +
    (hash2(cellX, cellY, 99) - 0.5) * 0.09
  );
}

/** Paint decoration for one terrain cell (no-op for families without any). */
export function paintTerrainDetail(
  ctx: TileRenderContext2D,
  cell: TerrainCellRect,
  assetId: string,
): void {
  if (assetId === GRASS_ASSET_ID) paintGrassDetail(ctx, cell);
}

function paintGrassDetail(ctx: TileRenderContext2D, cell: TerrainCellRect): void {
  const { x, y, size, cellX, cellY } = cell;
  // Keep detail in the cell's central region so blades never poke past a
  // rounded silhouette corner into empty space.
  const inset = size * 0.16;
  const span = size - 2 * inset;
  const density = grassDensity(cellX, cellY);
  const tier = density > 0.6 ? 2 : density > 0.46 ? 1 : 0;

  const bladeCount = tier === 2 ? 13 : tier === 1 ? 7 : 3;
  const bladeW = Math.max(1, size * 0.035);
  const bladeH = size * (tier === 2 ? 0.15 : 0.09);
  ctx.fillStyle = tier === 2 ? BLADE_DENSE : BLADE_LIGHT;
  for (let i = 0; i < bladeCount; i += 1) {
    const bx = x + inset + hash2(cellX * 31 + i, cellY * 17 + i, 11) * span;
    const by = y + inset + hash2(cellX * 13 + i, cellY * 29 + i, 12) * span;
    ctx.fillRect(bx, by - bladeH, bladeW, bladeH); // blade grows upward
  }

  // Flower clusters: where a separate sparse noise field peaks, drop 1–3
  // flowers; neighbouring flowering cells cluster them into small bunches.
  if (valueNoise(cellX / 4 + 50, cellY / 4 + 50, 3) > 0.72) {
    const count = 1 + Math.floor(hash2(cellX, cellY, 9) * 3);
    const p = Math.max(1, size * 0.06);
    for (let i = 0; i < count; i += 1) {
      const fx = x + inset + hash2(cellX + i, cellY * 7 + i, 21) * span;
      const fy = y + inset + hash2(cellX * 7 + i, cellY + i, 22) * span;
      ctx.fillStyle = FLOWER_STEM;
      ctx.fillRect(fx, fy, p, p * 2);
      ctx.fillStyle = hash2(cellX + i, cellY + i, 23) > 0.6 ? PETAL_PINK : PETAL;
      ctx.fillRect(fx - p, fy, p, p);
      ctx.fillRect(fx + p, fy, p, p);
      ctx.fillRect(fx, fy - p, p, p);
      ctx.fillRect(fx, fy + p, p, p);
      ctx.fillStyle = FLOWER_CENTER;
      ctx.fillRect(fx, fy, p, p);
    }
  }
}
