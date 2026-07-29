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

import { NEIGHBOR_BITS } from "./blobAutotile";
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
  else if (floor.kind === "bridge") paintBridgeDetail(ctx, cell, floor.palette);
  else if (floor.kind === "furrow") paintFurrowDetail(ctx, cell, floor.palette);
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

// Deck boards per cell along the run; the sliver gap between boards lets the
// family's dark water-shadow base show through, and a sparse skip leaves a
// missing board entirely (structure treatments — dock and bridge ribbons).
const BRIDGE_PLANKS = 5;
const BRIDGE_SKIP_CHANCE = 0.06;

/**
 * Bridge deck: boards PERPENDICULAR to the run with water slivers between,
 * edge stringers wherever the deck meets open air (mask-driven, so a 2-wide
 * deck only rails its outer edges), and post blocks on the corners of a run
 * end. Run direction comes from the same-family neighbour mask exactly like
 * the stairs painter; an ambiguous cell defaults to a north-south run.
 */
function paintBridgeDetail(
  ctx: TileRenderContext2D,
  cell: TerrainCellRect,
  pal: KeyClusterPalette,
): void {
  const { x, y, size, cellX, cellY } = cell;
  const mask = cell.neighborMask ?? 0;
  const n = (mask & NEIGHBOR_BITS.N) !== 0;
  const e = (mask & NEIGHBOR_BITS.E) !== 0;
  const s = (mask & NEIGHBOR_BITS.S) !== 0;
  const w = (mask & NEIGHBOR_BITS.W) !== 0;
  const horizontalRun = (e || w) && !(n || s);

  const gap = Math.max(1, size * 0.045);
  const step = size / BRIDGE_PLANKS;
  for (let i = 0; i < BRIDGE_PLANKS; i += 1) {
    const plank = (horizontalRun ? cellX : cellY) * BRIDGE_PLANKS + i;
    const other = horizontalRun ? cellY : cellX;
    if (hash2(plank, other, 171) < BRIDGE_SKIP_CHANCE) continue; // missing board
    const shade = hash2(plank, other, 172);
    ctx.fillStyle = shade < 0.3 ? pal.dark : shade < 0.75 ? pal.mid : pal.light;
    // Slight per-board mis-set along the run keeps the deck hand-laid.
    const at = clamp(
      i * step + gap / 2 + (hash2(plank, other, 173) - 0.5) * gap,
      0,
      size - step + gap,
    );
    const span = step - gap;
    if (horizontalRun) ctx.fillRect(x + at, y, span, size);
    else ctx.fillRect(x, y + at, size, span);
  }

  // Stringers along every deck edge that faces open air.
  const rail = Math.max(1, size * 0.06);
  ctx.fillStyle = pal.dark;
  if (horizontalRun) {
    if (!n) ctx.fillRect(x, y, size, rail);
    if (!s) ctx.fillRect(x, y + size - rail, size, rail);
  } else {
    if (!w) ctx.fillRect(x, y, rail, size);
    if (!e) ctx.fillRect(x + size - rail, y, rail, size);
  }

  // Post blocks on the corners of a run end (dock-pile terminals), placed on
  // the open end — the side with no same-family neighbour.
  const degree = (n ? 1 : 0) + (e ? 1 : 0) + (s ? 1 : 0) + (w ? 1 : 0);
  if (degree <= 1) {
    const post = Math.max(2, size * 0.14);
    ctx.fillStyle = pal.crev;
    if (horizontalRun) {
      const ex = w ? x + size - post : x;
      ctx.fillRect(ex, y, post, post);
      ctx.fillRect(ex, y + size - post, post, post);
    } else {
      const ey = n ? y + size - post : y;
      ctx.fillRect(x, ey, post, post);
      ctx.fillRect(x + size - post, ey, post, post);
    }
  }
}

// Furrow ridges per cell (≈0.33t pitch) and the sparse crop ticks riding
// each ridge top (island benchmark arc — the tilled-plot read).
const FURROW_ROWS = 3;
const FURROW_CROP_CHANCE = 0.55;

/**
 * Tilled furrows: trench/ridge rows running ALONG the plot with a lit ridge
 * line and sparse crop ticks on top. Rows default horizontal and only turn
 * vertical on a clearly vertical 1-wide strip, so a square plot ploughs one
 * way edge to edge. Row indices are world-lattice, so furrows continue
 * seamlessly across cells.
 */
function paintFurrowDetail(
  ctx: TileRenderContext2D,
  cell: TerrainCellRect,
  pal: KeyClusterPalette,
): void {
  const { x, y, size, cellX, cellY } = cell;
  const mask = cell.neighborMask ?? 0;
  const n = (mask & NEIGHBOR_BITS.N) !== 0;
  const e = (mask & NEIGHBOR_BITS.E) !== 0;
  const s = (mask & NEIGHBOR_BITS.S) !== 0;
  const w = (mask & NEIGHBOR_BITS.W) !== 0;
  const verticalRows = (n || s) && !(e || w);

  const rowH = size / FURROW_ROWS;
  const trench = Math.max(1, size * 0.05);
  const ridgeLine = Math.max(1, size * 0.03);
  const crop = Math.max(1, size * 0.05);
  for (let i = 0; i < FURROW_ROWS; i += 1) {
    const row = (verticalRows ? cellX : cellY) * FURROW_ROWS + i;
    const other = verticalRows ? cellY : cellX;
    const at = i * rowH;
    // Trench shadow along the row top, lit ridge line mid-row.
    ctx.fillStyle = pal.crev;
    if (verticalRows) ctx.fillRect(x + at, y, trench, size);
    else ctx.fillRect(x, y + at, size, trench);
    ctx.fillStyle = hash2(row, other, 181) < 0.5 ? pal.mid : pal.dark;
    if (verticalRows) ctx.fillRect(x + at + rowH * 0.45, y, ridgeLine, size);
    else ctx.fillRect(x, y + at + rowH * 0.45, size, ridgeLine);
    // Crop ticks marching along the ridge top.
    ctx.fillStyle = pal.light;
    for (let k = 0; k < 3; k += 1) {
      if (hash2(row * 3 + k, other, 182) >= FURROW_CROP_CHANCE) continue;
      const along = (k + 0.2 + hash2(row, other * 7 + k, 183) * 0.5) * (size / 3);
      if (verticalRows) ctx.fillRect(x + at + rowH * 0.4, y + along, crop, crop);
      else ctx.fillRect(x + along, y + at + rowH * 0.4, crop, crop);
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
