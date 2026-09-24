import type { MapGridSettings } from "@herobyte/shared";
import type { RoomBounds } from "./roomBuilder";

/** The recipe's region, in document-grid CELLS (what the wire expects). */
export interface CellBounds {
  x: number;
  y: number;
  cols: number;
  rows: number;
}

/**
 * Mirrors the server resolver's MIN_RECIPE_COLS/ROWS. Below this you get one
 * sealed room rather than a dungeon — see the measurement in the server's
 * generation/types.ts. Keep the two in step.
 */
const MIN_REGION_SIDE = 20;
/** Mirrors MAX_TERRAIN_PAINT_CELLS — the server refuses more in one command. */
const MAX_REGION_CELLS = 16384;

/** Document pixels → grid cells, the same lattice the recipe lays out on. */
export function toCellBounds(bounds: RoomBounds, grid: MapGridSettings): CellBounds {
  return {
    x: Math.round((bounds.x - grid.offsetX) / grid.size),
    y: Math.round((bounds.y - grid.offsetY) / grid.size),
    cols: Math.max(1, Math.round(bounds.width / grid.size)),
    rows: Math.max(1, Math.round(bounds.height / grid.size)),
  };
}

export function regionProblem(bounds: CellBounds | null): string | null {
  if (!bounds) return null;
  if (bounds.cols < MIN_REGION_SIDE || bounds.rows < MIN_REGION_SIDE) {
    return `Drag at least ${MIN_REGION_SIDE}×${MIN_REGION_SIDE} cells — a dungeon needs room for rooms AND the halls between them.`;
  }
  if (bounds.cols * bounds.rows > MAX_REGION_CELLS) {
    return `That area is too big (max ${MAX_REGION_CELLS} cells) — drag a smaller region.`;
  }
  return null;
}
