// Wall-top interior detail — stone course ticks, quoin blocks and lit/shaded
// edge lips, pure fillRect art (own file to respect the 350-LOC cap; see
// terrainFloorDetail for the floor twin).
//
// The Czepeku study (candle-workshop): a top-down wall reads TALL when its top
// is the lightest surface in view, its edges carry a thin dark outline, the
// band is broken into irregular stone courses, and corners get chunkier quoin
// blocks. The field pass already paints the light base, the thin dark rim and
// the deep cast shadow (terrainPalette WALL_RIM / WALL_SHADOW); this painter
// adds everything INSIDE the band. Like the floor painters it is fillRect-only
// (the bake's clip ctx forwards nothing else) and world-lattice deterministic,
// so courses continue seamlessly across cells on every surface and redraw.
//
// A SET `neighborMask` bit means that side's neighbour is the same wall family
// (terrainRender builds the mask); cleared bits face non-wall. A run cell
// (wall left+right or up+down, nothing across) draws courses along the band;
// anything else — corners, junctions, ends, isolated posts — draws a quoin
// frame instead.

import { NEIGHBOR_BITS } from "./blobAutotile";
import type { TerrainCellRect, TileRenderContext2D } from "./tileRenderCore";
import type { KeyClusterPalette, WallDetail } from "./terrainPalette";
import { hash2 } from "./valueNoise";

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

// Course-tick slots per cell along a run (half-cell world lattice) and the
// chance each slot draws — blocks end up ½–2 cells long, like the reference.
const COURSE_SLOTS = 2;
const COURSE_CHANCE = 0.62;
// Chip mottle per cell.
const CHIP_TRIES = 3;
const CHIP_CHANCE = 0.5;
// Geometry, as fractions of the cell. EDGE_INSET must land the lips PAST the
// detail clip (which drops rects whose centre is inside the field rim,
// terrainPalette WALL_RIM) or they vanish at the seam — 0.09 clears it with
// slack at the default 50px grid (verified visually).
const EDGE_INSET = 0.09;
const LIP = 0.05;
const TICK = 0.045;
const QUOIN_INSET = 0.2;

/** Paint one wall cell's top-face detail. */
export function paintWallDetail(
  ctx: TileRenderContext2D,
  cell: TerrainCellRect,
  wall: WallDetail,
): void {
  const mask = cell.neighborMask ?? 0;
  const n = (mask & NEIGHBOR_BITS.N) !== 0;
  const e = (mask & NEIGHBOR_BITS.E) !== 0;
  const s = (mask & NEIGHBOR_BITS.S) !== 0;
  const w = (mask & NEIGHBOR_BITS.W) !== 0;

  const horizontalRun = e && w && !n && !s;
  const verticalRun = n && s && !e && !w;
  if (horizontalRun) paintCourses(ctx, cell, wall.palette, "h");
  else if (verticalRun) paintCourses(ctx, cell, wall.palette, "v");
  else paintQuoin(ctx, cell, wall.palette);

  paintEdgeLips(ctx, cell, wall.palette, { n, e, s, w });
  paintChips(ctx, cell, wall.palette);
}

/**
 * Lit/shaded lips along EXPOSED edges (sides facing non-wall), just inside the
 * field's dark rim. Light comes from the top-right (the field's convention):
 * N/E lips are light, S/W lips are crevice-dark — the two-tone height cue.
 */
function paintEdgeLips(
  ctx: TileRenderContext2D,
  cell: TerrainCellRect,
  pal: KeyClusterPalette,
  same: { n: boolean; e: boolean; s: boolean; w: boolean },
): void {
  const { x, y, size } = cell;
  const inset = size * EDGE_INSET;
  const lip = Math.max(1, size * LIP);
  if (!same.n) {
    ctx.fillStyle = pal.light;
    ctx.fillRect(x, y + inset, size, lip);
  }
  if (!same.e) {
    ctx.fillStyle = pal.light;
    ctx.fillRect(x + size - inset - lip, y, lip, size);
  }
  if (!same.s) {
    ctx.fillStyle = pal.crev;
    ctx.fillRect(x, y + size - inset - lip, size, lip);
  }
  if (!same.w) {
    ctx.fillStyle = pal.crev;
    ctx.fillRect(x + inset, y, lip, size);
  }
}

/**
 * Course ticks across a straight run: short crevice-dark bars perpendicular to
 * the band, on the half-cell world lattice with per-tick jitter, so the band
 * reads as laid stone blocks that continue seamlessly cell to cell.
 */
function paintCourses(
  ctx: TileRenderContext2D,
  cell: TerrainCellRect,
  pal: KeyClusterPalette,
  dir: "h" | "v",
): void {
  const { x, y, size, cellX, cellY } = cell;
  const along = dir === "h" ? cellX : cellY;
  const across = dir === "h" ? cellY : cellX;
  const inset = size * EDGE_INSET;
  const tick = Math.max(1, size * TICK);
  ctx.fillStyle = pal.crev;
  for (let k = 0; k < COURSE_SLOTS; k += 1) {
    const slot = along * COURSE_SLOTS + k;
    if (hash2(slot, across, 121) >= COURSE_CHANCE) continue;
    const jitter = (hash2(slot, across, 122) - 0.5) * (size / COURSE_SLOTS) * 0.5;
    const at = clamp((k * size) / COURSE_SLOTS + jitter, 0, size - tick);
    if (dir === "h") ctx.fillRect(x + at, y + inset, tick, size - 2 * inset);
    else ctx.fillRect(x + inset, y + at, size - 2 * inset, tick);
  }
}

/**
 * Quoin block for corners, junctions, ends and isolated posts: an inset
 * crevice-dark frame with a light cap inside it, reading as a chunkier bonded
 * cornerstone (the reference's corner piers).
 */
function paintQuoin(ctx: TileRenderContext2D, cell: TerrainCellRect, pal: KeyClusterPalette): void {
  const { x, y, size } = cell;
  const inset = size * QUOIN_INSET;
  const t = Math.max(1, size * TICK);
  const span = size - 2 * inset;
  ctx.fillStyle = pal.crev;
  ctx.fillRect(x + inset, y + inset, span, t);
  ctx.fillRect(x + inset, y + size - inset - t, span, t);
  ctx.fillRect(x + inset, y + inset, t, span);
  ctx.fillRect(x + size - inset - t, y + inset, t, span);
  ctx.fillStyle = pal.light;
  ctx.fillRect(x + inset + t, y + inset + t, span - 2 * t, t);
}

/** Sparse chip/weathering mottle inside the band, world-lattice deterministic. */
function paintChips(ctx: TileRenderContext2D, cell: TerrainCellRect, pal: KeyClusterPalette): void {
  const { x, y, size, cellX, cellY } = cell;
  const p = Math.max(1, size * 0.05);
  const lo = size * (EDGE_INSET + LIP);
  const hi = size - lo - p;
  if (hi <= lo) return;
  for (let i = 0; i < CHIP_TRIES; i += 1) {
    if (hash2(cellX * CHIP_TRIES + i, cellY, 131) >= CHIP_CHANCE) continue;
    const shade = hash2(cellX, cellY * CHIP_TRIES + i, 132);
    ctx.fillStyle = shade < 0.4 ? pal.dark : shade < 0.8 ? pal.mid : pal.light;
    const cx = clamp(x + lo + hash2(cellX + i, cellY, 133) * (hi - lo), x, x + size - p);
    const cy = clamp(y + lo + hash2(cellX, cellY + i, 134) * (hi - lo), y, y + size - p);
    ctx.fillRect(cx, cy, p, p);
  }
}
