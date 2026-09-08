// ============================================================================
// GEOMETRY LATTICE — bounds-local cells and edges -> document pixels
// ============================================================================
// The coordinate conversions every recipe's geometry shares. Split out of
// dungeonGeometry.ts (which sat 10 lines under the structural ceiling) so the
// building recipe reuses them rather than growing a second spelling of the
// same arithmetic — two spellings of a lattice is how a door ends up half a
// cell from its wall.

import type { LayoutEdge } from "./dungeonLayout.js";
import type { CellBounds, RecipeContext } from "./types.js";

/** A merged, maximal line of wall edges along one lattice line. */
export interface WallRun {
  orientation: "h" | "v";
  /** Row for "h", column for "v". */
  line: number;
  /** Inclusive edge positions along the line. */
  from: number;
  to: number;
}

export function pxX(cellX: number, bounds: CellBounds, ctx: RecipeContext): number {
  return (bounds.x + cellX) * ctx.grid.size + ctx.grid.offsetX;
}

export function pxY(cellY: number, bounds: CellBounds, ctx: RecipeContext): number {
  return (bounds.y + cellY) * ctx.grid.size + ctx.grid.offsetY;
}

/** Cell CENTRE in document px — a point source (a light, a marker), not a corner. */
export function centreX(cellX: number, bounds: CellBounds, ctx: RecipeContext): number {
  return pxX(cellX, bounds, ctx) + ctx.grid.size / 2;
}

export function centreY(cellY: number, bounds: CellBounds, ctx: RecipeContext): number {
  return pxY(cellY, bounds, ctx) + ctx.grid.size / 2;
}

export function parseCell(key: string): [number, number] {
  const [x, y] = key.split(",").map(Number);
  return [x!, y!];
}

export function edgeKey(edge: LayoutEdge): string {
  return `${edge.orientation}:${edge.x},${edge.y}`;
}

export function lineOf(edge: LayoutEdge): number {
  return edge.orientation === "h" ? edge.y : edge.x;
}

export function positionOf(edge: LayoutEdge): number {
  return edge.orientation === "h" ? edge.x : edge.y;
}

export function minYOf(run: WallRun): number {
  return run.orientation === "h" ? run.line : run.from;
}

export function minXOf(run: WallRun): number {
  return run.orientation === "h" ? run.from : run.line;
}
