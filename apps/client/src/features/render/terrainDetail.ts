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
import type { KeyClusterPalette } from "./terrainPalette";

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

// --- dirt / path "key cluster" detail (Slynyrd "Top Down Tiles" pg-49) ---

/** Key-cluster motifs — offsets in motif-pixels: L, 3-bar, 2x2, nub, diagonal,
 * 2-wide, J. Each is mirrored per placement so a handful of shapes reads as
 * endless variety. Indices 0-3 (the small ones) double as crevice cracks. */
const KEY_CLUSTER_MOTIFS: readonly (readonly (readonly [number, number])[])[] = [
  [
    [0, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  [[0, 0]],
  [
    [0, 0],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
  ],
];
// Dry-dirt coverage: dense key clusters, but the low-frequency `lo` noise term
// still opens airy patches, so one config yields both dry and sparse ground.
const KC_GRID_PER_TILE = 4; // pebble grid points across a cell
const KC_MOTIF_PX = 0.055; // motif-pixel as a fraction of cell size
const KC_COV_BASE = 0.44;
const KC_COV_LO_SCALE = 5; // low-freq (patch) coverage wavelength, in grid units
const KC_COV_HI_SCALE = 2.2; // mid-freq coverage detail
const KC_CREV_BASE = 0.16; // baseline crevice-crack density

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Pick one of the first `n` motifs by hash. Guards the boundary where hash2
 * returns exactly 1 (it divides by 2^32 - 1), which would otherwise index
 * out of bounds. */
const pickMotif = (h: number, n: number): readonly (readonly [number, number])[] =>
  KEY_CLUSTER_MOTIFS[Math.min(n - 1, Math.floor(h * n))]!;

/**
 * Paint dirt/path "key cluster" pebbles over one cell's base fill: a world-space
 * jittered grid of small motifs in three tan shades, each with a 1px crevice
 * shadow for raised form, plus sparse crevice cracks. A coherent coverage-noise
 * field opens dry/dense vs airy/sparse patches. Deterministic on the WORLD
 * lattice (not per-cell), so patches cross cell boundaries seamlessly. The
 * palette is data (see terrainPalette). Kept inset so pebbles never poke past a
 * rounded silhouette edge, mirroring the grass detail.
 */
export function paintKeyClusterDetail(
  ctx: TileRenderContext2D,
  cell: TerrainCellRect,
  palette: KeyClusterPalette,
): void {
  const { x, y, size } = cell;
  const inset = size * 0.1;
  const mp = Math.max(1, Math.round(size * KC_MOTIF_PX));
  const grid = size / KC_GRID_PER_TILE;
  const jitter = grid * 0.62; // > 0.5 breaks the visible grid alignment
  const k0x = Math.ceil((x + inset) / grid);
  const k1x = Math.floor((x + size - inset) / grid);
  const k0y = Math.ceil((y + inset) / grid);
  const k1y = Math.floor((y + size - inset) / grid);
  const place = (bx: number, by: number, dx: number, dy: number, mx: number, my: number): void => {
    const px = clamp(bx + dx * mp * mx, x + inset, x + size - inset - mp);
    const py = clamp(by + dy * mp * my, y + inset, y + size - inset - mp);
    ctx.fillRect(px, py, mp, mp);
  };
  for (let ky = k0y; ky <= k1y; ky += 1) {
    for (let kx = k0x; kx <= k1x; kx += 1) {
      const lo = valueNoise(kx / KC_COV_LO_SCALE, ky / KC_COV_LO_SCALE, 1);
      const hi = valueNoise(kx / KC_COV_HI_SCALE, ky / KC_COV_HI_SCALE, 7);
      const stagger = (ky & 1) === 1 ? grid * 0.5 : 0; // brick-offset odd rows
      const bx = kx * grid + stagger + (hash2(kx, ky, 11) - 0.5) * jitter;
      const by = ky * grid + (hash2(kx, ky, 12) - 0.5) * jitter;
      // (1) sparse crevice cracks, favouring the damper (darker) patches.
      if (hash2(kx, ky, 41) < KC_CREV_BASE + 0.34 * (1 - lo)) {
        const crack = pickMotif(hash2(kx, ky, 42), 4);
        const cmx = hash2(kx, ky, 43) > 0.5 ? -1 : 1;
        const cmy = hash2(kx, ky, 44) > 0.5 ? -1 : 1;
        ctx.fillStyle = palette.crev;
        for (const [dx, dy] of crack) place(bx, by, dx, dy, cmx, cmy);
      }
      // (2) pebble cluster: dense in dry (lighter) patches, sparse in damp ones.
      if (hash2(kx, ky, 5) > KC_COV_BASE + 0.4 * lo + 0.14 * hi) continue;
      const motif = pickMotif(hash2(kx, ky, 21), KEY_CLUSTER_MOTIFS.length);
      const mx = hash2(kx, ky, 22) > 0.5 ? -1 : 1;
      const my = hash2(kx, ky, 23) > 0.5 ? -1 : 1;
      const shade = hash2(kx, ky, 31);
      const color = shade < 0.34 ? palette.dark : shade < 0.74 ? palette.mid : palette.light;
      // shadow (offset half a motif-px down-right) under the pebble, then the pebble.
      ctx.fillStyle = palette.crev;
      for (const [dx, dy] of motif) place(bx + mp * 0.5, by + mp * 0.5, dx, dy, mx, my);
      ctx.fillStyle = color;
      for (const [dx, dy] of motif) place(bx, by, dx, dy, mx, my);
    }
  }
}
