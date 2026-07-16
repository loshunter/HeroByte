// Floor interior detail — plank grain and flagstone slab seams, pure fillRect
// art (split out of terrainDetail to respect the 350-LOC cap).
//
// The bake's clip context (proceduralTerrainSurface.makeClipCtx) forwards ONLY
// fillStyle + fillRect, so everything here — seams, joints, grain, knots,
// chips — is a filled rect, like the grass/pebble painters. All geometry
// derives from the cell's WORLD lattice indices via the shared deterministic
// hash, so board rows and slab courses continue seamlessly across cell
// boundaries on every surface and redraw, while each cell paints strictly
// inside its own bounds (the detail pass composes neighbours' output).

import type { TerrainCellRect, TileRenderContext2D } from "./tileRenderCore";
import type { FloorDetail, KeyClusterPalette } from "./terrainPalette";
import { hash2 } from "./valueNoise";

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Route one floor cell to its material painter. */
export function paintFloorDetail(
  ctx: TileRenderContext2D,
  cell: TerrainCellRect,
  floor: FloorDetail,
): void {
  const scale = floor.scale ?? 1;
  if (floor.kind === "plank") paintPlankDetail(ctx, cell, floor.palette, scale);
  else paintFlagstoneDetail(ctx, cell, floor.palette, scale);
}

// Boards per cell at scale 1: three ≈17px boards on the default 50px grid.
const PLANK_ROWS = 3;
// Potential butt-joint slots per cell width (a half-cell lattice), thinned by
// hash so board lengths vary from half a cell to several cells.
const PLANK_JOINT_SLOTS = 2;
const PLANK_JOINT_CHANCE = 0.34;
const PLANK_KNOT_CHANCE = 0.14;

/**
 * Wood planks: horizontal board rows with a seam along each row top, sparse
 * staggered butt joints, thin grain streaks, and the occasional knot. Row
 * indices are world-lattice (`cellY * rows + i`), so joints and knots differ
 * per row yet the board courses line up cell to cell.
 */
function paintPlankDetail(
  ctx: TileRenderContext2D,
  cell: TerrainCellRect,
  pal: KeyClusterPalette,
  scale: number,
): void {
  const { x, y, size, cellX, cellY } = cell;
  const rows = Math.max(2, Math.round(PLANK_ROWS / scale));
  const rowH = size / rows;
  const seam = Math.max(1, size * 0.03);
  const streakH = Math.max(1, size * 0.02);

  for (let i = 0; i < rows; i += 1) {
    const rowTop = y + i * rowH;
    const row = cellY * rows + i;

    // Board seam along the row top (the row below draws the shared boundary).
    ctx.fillStyle = pal.crev;
    ctx.fillRect(x, rowTop, size, seam);

    // Butt joints on the half-cell world lattice.
    for (let k = 0; k < PLANK_JOINT_SLOTS; k += 1) {
      if (hash2(cellX * PLANK_JOINT_SLOTS + k, row, 51) >= PLANK_JOINT_CHANCE) continue;
      const jx = clamp(x + (k * size) / PLANK_JOINT_SLOTS, x, x + size - seam);
      ctx.fillRect(jx, rowTop, seam, Math.min(rowH, y + size - rowTop));
    }

    // Grain streaks: 2–4 thin light/dark strokes inside the board.
    const streaks = 2 + Math.floor(hash2(cellX, row, 61) * 2.999);
    for (let s = 0; s < streaks; s += 1) {
      const sx = x + hash2(cellX * 7 + s, row * 5 + s, 62) * size * 0.7;
      const sw = Math.min(size * (0.15 + hash2(cellX * 3 + s, row, 63) * 0.3), x + size - sx);
      const sy = clamp(
        rowTop + seam + hash2(cellX + s, row * 11, 64) * (rowH - seam - streakH),
        y,
        y + size - streakH,
      );
      ctx.fillStyle = hash2(cellX * 13 + s, row, 65) > 0.5 ? pal.light : pal.dark;
      ctx.fillRect(sx, sy, sw, streakH);
    }

    // Knot: a mid-tone halo around a crev core, sparse.
    if (hash2(cellX, row, 71) < PLANK_KNOT_CHANCE) {
      const kp = Math.max(1, size * 0.04);
      const kx = clamp(x + (0.15 + hash2(cellX, row, 72) * 0.7) * size, x, x + size - 2 * kp);
      const ky = clamp(rowTop + rowH * (0.25 + hash2(cellX, row, 73) * 0.4), y, y + size - 2 * kp);
      ctx.fillStyle = pal.mid;
      ctx.fillRect(kx, ky, 2 * kp, 2 * kp);
      ctx.fillStyle = pal.crev;
      ctx.fillRect(kx + kp / 2, ky + kp / 2, kp, kp);
    }
  }
}

// Slabs per axis per cell at scale 1: 2 (≈ half-cell flagstones). Cobblestone
// passes scale 0.5 → 4 per axis (quarter-cell stones).
const SLABS_PER_CELL = 2;
const SLAB_SPECKLE_CHANCE = 0.55;
const SLAB_SECOND_CHIP_CHANCE = 0.35;

/**
 * Flagstones: a brick-staggered slab lattice whose seam segments wobble
 * per-slab (hand-drawn irregularity), plus chip/lichen speckle inside slabs.
 * Slab indices are world-lattice (`cellX/Y * slabs + i/j`), so courses read
 * continuously across cells while every cell stays inside its bounds.
 */
function paintFlagstoneDetail(
  ctx: TileRenderContext2D,
  cell: TerrainCellRect,
  pal: KeyClusterPalette,
  scale: number,
): void {
  const { x, y, size, cellX, cellY } = cell;
  const slabs = Math.max(2, Math.round(SLABS_PER_CELL / scale));
  const g = size / slabs;
  const seam = Math.max(1, size * 0.03);
  const p = Math.max(1, size * 0.03);

  for (let j = 0; j < slabs; j += 1) {
    const gy = cellY * slabs + j;
    const rowTop = y + j * g;
    const stagger = (gy & 1) === 1 ? 0.5 : 0; // brick-offset odd courses
    for (let i = 0; i < slabs; i += 1) {
      const gx = cellX * slabs + i;

      // Horizontal seam segment with a per-slab vertical wobble.
      const wobble = (hash2(gx, gy, 81) - 0.5) * g * 0.3;
      const segTop = clamp(rowTop + wobble, y, y + size - seam);
      ctx.fillStyle = pal.crev;
      ctx.fillRect(x + i * g, segTop, g, seam);

      // Vertical joint, brick-staggered with a horizontal jitter.
      const jx = clamp(
        x + (i + stagger) * g + (hash2(gx, gy, 82) - 0.5) * g * 0.25,
        x,
        x + size - seam,
      );
      ctx.fillRect(jx, rowTop, seam, Math.min(g, y + size - rowTop));

      // Chip / lichen speckle inside the slab.
      if (hash2(gx, gy, 83) < SLAB_SPECKLE_CHANCE) {
        const shade = hash2(gx, gy, 86);
        ctx.fillStyle = shade < 0.33 ? pal.dark : shade < 0.66 ? pal.mid : pal.light;
        const sx = clamp(x + i * g + hash2(gx, gy, 84) * (g - p), x, x + size - p);
        const sy = clamp(rowTop + seam + hash2(gx, gy, 85) * (g - seam - p), y, y + size - p);
        ctx.fillRect(sx, sy, p, p);
        if (hash2(gx, gy, 87) < SLAB_SECOND_CHIP_CHANCE) {
          const s2x = clamp(x + i * g + hash2(gx, gy, 88) * (g - p), x, x + size - p);
          const s2y = clamp(rowTop + seam + hash2(gx, gy, 89) * (g - seam - p), y, y + size - p);
          ctx.fillRect(s2x, s2y, p, p);
        }
      }
    }
  }
}
