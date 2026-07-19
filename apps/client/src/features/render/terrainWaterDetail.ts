// Water interior detail — deep-water dash flocks and sunken-structure algae,
// pure fillRect art (own file per the 350-LOC cap; terrainFloorDetail and
// terrainRoofDetail are the dry-land twins).
//
// The Czepeku deeps aren't flat: sparse flocks of short parallel current
// dashes drift over the open water, every flock in a region sharing one
// diagonal heading. Like every detail painter this is fillRect-only (the
// bake's clip ctx forwards nothing else) and world-lattice deterministic via
// the shared hash, so the same cell always grows the same dashes. Diagonals
// are stepped p×p squares — the pixel-art line idiom — since the clip context
// forwards no path API.

import type { TerrainCellRect, TileRenderContext2D } from "./tileRenderCore";
import type { WaterDetail } from "./terrainPaletteTypes";
import { hash2 } from "./valueNoise";

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Dashes only past this shore distance (cells) — the flocks live in the open
 * deeps, past the caustic shallows. */
export const DASH_MIN_DEPTH = 3;
/** Every dash inside one region of this many cells shares a heading. */
const REGION_CELLS = 6;
/** Per-cell flock chance — ≈5–15 dashes per deep 6×6 region at 1–2 a cell. */
const DASH_CHANCE = 0.28;

/**
 * The shared heading for a dash region: a unit step on one of the two diagonal
 * quadrants (25°–65° below or above horizontal), hash-picked per region so
 * neighbouring regions drift differently while every dash within one agrees.
 */
export function dashHeadingFor(regionX: number, regionY: number): { dx: number; dy: number } {
  const angle = ((25 + hash2(regionX, regionY, 161) * 40) * Math.PI) / 180;
  const sign = hash2(regionX, regionY, 162) < 0.5 ? 1 : -1;
  return { dx: Math.cos(angle), dy: Math.sin(angle) * sign };
}

/**
 * Deep-water dash flocks for one water cell: nothing at all unless the cell
 * sits deeper than DASH_MIN_DEPTH; then 1–2 short dashes on a sparse hash
 * gate, each a run of p×p squares stepping along the region heading, clamped
 * strictly inside the cell (the detail pass composes neighbours' output).
 */
export function paintWaterDetail(
  ctx: TileRenderContext2D,
  cell: TerrainCellRect,
  water: WaterDetail,
  depth: number,
): void {
  if (depth <= DASH_MIN_DEPTH) return;
  const { x, y, size, cellX, cellY } = cell;
  if (hash2(cellX, cellY, 163) >= DASH_CHANCE) return;
  const heading = dashHeadingFor(
    Math.floor(cellX / REGION_CELLS),
    Math.floor(cellY / REGION_CELLS),
  );
  const p = Math.max(1, size * 0.04);
  const dashes = hash2(cellX, cellY, 164) < 0.35 ? 2 : 1;
  ctx.fillStyle = water.dash;
  for (let d = 0; d < dashes; d += 1) {
    const sx = x + hash2(cellX * 5 + d, cellY * 3 + d, 165) * size;
    const sy = y + hash2(cellX * 3 + d, cellY * 7 + d, 166) * size;
    const steps = 4 + Math.floor(hash2(cellX + d, cellY - d, 167) * 5); // 4–8 squares
    for (let i = 0; i < steps; i += 1) {
      const px = sx + i * p * heading.dx;
      const py = sy + i * p * heading.dy;
      if (px < x || px + p > x + size || py < y || py + p > y + size) continue;
      ctx.fillRect(px, py, p, p);
    }
  }
}

/** Algae grows only this close to land (cells) — the sunlit contact zone. */
export const ALGAE_MAX_DEPTH = 1.5;
const ALGAE_CHANCE = 0.6;

/**
 * Olive algae ticks on a shallow drowned cell: 1–3 small L-shaped tufts —
 * a short base with a sprout — scattered on the world lattice. The caller
 * gates by ALGAE_MAX_DEPTH; the painter only scatters.
 */
export function paintAlgaeTicks(
  ctx: TileRenderContext2D,
  cell: TerrainCellRect,
  color: string,
): void {
  const { x, y, size, cellX, cellY } = cell;
  if (hash2(cellX, cellY, 171) >= ALGAE_CHANCE) return;
  const count = 1 + Math.floor(hash2(cellX, cellY, 172) * 3);
  const p = Math.max(1, size * 0.04);
  ctx.fillStyle = color;
  for (let i = 0; i < count; i += 1) {
    const tx = clamp(x + hash2(cellX * 5 + i, cellY * 3 + i, 173) * size, x, x + size - 3 * p);
    const ty = clamp(y + hash2(cellX * 7 + i, cellY * 11 + i, 174) * size, y, y + size - 2 * p);
    ctx.fillRect(tx, ty + p, 3 * p, p);
    ctx.fillRect(tx + p, ty, p, p);
  }
}
