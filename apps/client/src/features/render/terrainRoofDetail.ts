// Roof and stairs interior detail — the LEVELS illusion, pure fillRect art
// (own file to respect the 350-LOC cap; terrainWallDetail is the wall twin).
//
// Czepeku fakes height top-down with three cues this module supplies two of:
// an elevated plane gets its own dense material rows (shingles / treads), a
// bright trim at its edge (the palette's light fascia rim, drawn by the field
// pass), and a hard cast shadow onto the level below (the field's per-family
// shadow strength). Like every detail painter this is fillRect-only (the
// bake's clip ctx forwards nothing else) and world-lattice deterministic, so
// rows continue seamlessly across cells.

import { NEIGHBOR_BITS } from "./blobAutotile";
import type { TerrainCellRect, TileRenderContext2D } from "./tileRenderCore";
import type { WallDetail } from "./terrainPalette";
import { hash2 } from "./valueNoise";

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

// Shingle rows per cell — denser than plank rows so the surface reads scaled
// like roofing, not decking.
const ROOF_ROWS = 4;
const ROOF_STAGGER_SLOTS = 3;
const ROOF_CHIP_CHANCE = 0.3;
// Stair treads per cell along the run.
const STAIR_TREADS = 4;

/**
 * Roof: horizontal shingle courses — a crevice shadow line along each row top,
 * brick-staggered vertical joints, and sparse slipped-shingle chips. Rows are
 * world-lattice (`cellY * rows + i`) so courses run unbroken across a roof
 * plane of any footprint.
 */
export function paintRoofDetail(
  ctx: TileRenderContext2D,
  cell: TerrainCellRect,
  roof: WallDetail,
): void {
  const { x, y, size, cellX, cellY } = cell;
  const pal = roof.palette;
  const rowH = size / ROOF_ROWS;
  const seam = Math.max(1, size * 0.03);

  for (let i = 0; i < ROOF_ROWS; i += 1) {
    const row = cellY * ROOF_ROWS + i;
    const rowTop = y + i * rowH;

    // Row shadow line: the course above overlaps this one.
    ctx.fillStyle = pal.crev;
    ctx.fillRect(x, rowTop, size, seam);

    // Staggered shingle joints on a third-cell world lattice.
    const stagger = (row & 1) === 1 ? 0.5 : 0;
    for (let k = 0; k < ROOF_STAGGER_SLOTS; k += 1) {
      const jx = clamp(x + ((k + stagger) * size) / ROOF_STAGGER_SLOTS, x, x + size - seam);
      ctx.fillRect(jx, rowTop, seam, Math.min(rowH, y + size - rowTop));
    }

    // Slipped / sun-caught shingle: one small tone patch per row, sparse.
    if (hash2(cellX, row, 141) < ROOF_CHIP_CHANCE) {
      const shade = hash2(cellX, row, 142);
      ctx.fillStyle = shade < 0.4 ? pal.dark : shade < 0.8 ? pal.mid : pal.light;
      const w = size / ROOF_STAGGER_SLOTS - seam;
      const px = clamp(x + hash2(cellX, row, 143) * (size - w), x, x + size - w);
      ctx.fillRect(px, rowTop + seam, w, Math.max(1, rowH - 2 * seam));
    }
  }
}

/**
 * Stairs: riser shadow bars perpendicular to the run with a light nosing strip
 * above each — Czepeku's tread rhythm. Run direction comes from the same-family
 * neighbour mask (a strip of stairs runs somewhere); an ambiguous cell (blob,
 * isolated) defaults to horizontal treads, which is how a landing reads.
 */
export function paintStairsDetail(
  ctx: TileRenderContext2D,
  cell: TerrainCellRect,
  stairs: WallDetail,
): void {
  const { x, y, size, cellX, cellY } = cell;
  const pal = stairs.palette;
  const mask = cell.neighborMask ?? 0;
  const n = (mask & NEIGHBOR_BITS.N) !== 0;
  const e = (mask & NEIGHBOR_BITS.E) !== 0;
  const s = (mask & NEIGHBOR_BITS.S) !== 0;
  const w = (mask & NEIGHBOR_BITS.W) !== 0;
  // Treads sit perpendicular to travel: an east-west run gets vertical bars;
  // a north-south run — or an ambiguous landing/blob — gets horizontal ones.
  const horizontalRun = (e || w) && !(n || s);

  const bar = Math.max(1, size * 0.045);
  const nose = Math.max(1, size * 0.03);
  const step = size / STAIR_TREADS;
  for (let i = 0; i < STAIR_TREADS; i += 1) {
    const tread = (horizontalRun ? cellX : cellY) * STAIR_TREADS + i;
    const jitter = (hash2(tread, horizontalRun ? cellY : cellX, 151) - 0.5) * step * 0.2;
    const at = clamp(i * step + jitter, 0, size - bar - nose);
    if (horizontalRun) {
      ctx.fillStyle = pal.crev;
      ctx.fillRect(x + at + nose, y, bar, size);
      ctx.fillStyle = pal.light;
      ctx.fillRect(x + at, y, nose, size);
    } else {
      ctx.fillStyle = pal.crev;
      ctx.fillRect(x, y + at + nose, size, bar);
      ctx.fillStyle = pal.light;
      ctx.fillRect(x, y + at, size, nose);
    }
  }

  // Wear mottle: one mid/dark scuff per cell, sparse.
  if (hash2(cellX, cellY, 152) < 0.4) {
    const p = Math.max(1, size * 0.05);
    ctx.fillStyle = hash2(cellX, cellY, 153) < 0.5 ? pal.dark : pal.mid;
    const sx = clamp(x + hash2(cellX, cellY, 154) * (size - p), x, x + size - p);
    const sy = clamp(y + hash2(cellX, cellY, 155) * (size - p), y, y + size - p);
    ctx.fillRect(sx, sy, p, p);
  }
}
