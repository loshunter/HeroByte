// ============================================================================
// DUNGEON RECIPE — G1 placeholder
// ============================================================================
// The real brain arrives in G2 (layout) and G3 (geometry emission). This G1
// placeholder proves the rails end-to-end with the simplest sealed output: a
// fully-floored region enclosed by one perimeter wall. Pure and deterministic:
// the seed is plumbed (G2 derives the RNG streams from it) but unused here.

import type { MapWallElement, TerrainPaintCell } from "@herobyte/shared";
import { makeIdFactory, type CellBounds, type DungeonParams, type RecipeContext } from "./types.js";
import type { RecipeOutput } from "./types.js";

export function dungeonRecipe(
  _seed: number,
  bounds: CellBounds,
  params: DungeonParams,
  ctx: RecipeContext,
): RecipeOutput {
  const nextId = makeIdFactory(ctx.idPrefix);
  const assetId = params.theme === "wood" ? "terrain:wood-floor" : "terrain:stone-floor";

  // Floors: every cell in bounds, emitted in scan order (y, then x) so the
  // output is order-stable for goldens.
  const cells: TerrainPaintCell[] = [];
  for (let row = 0; row < bounds.rows; row++) {
    for (let col = 0; col < bounds.cols; col++) {
      cells.push({ x: bounds.x + col, y: bounds.y + row, assetId });
    }
  }

  // One closed perimeter wall on the cell-corner lattice (document px).
  const { size, offsetX, offsetY } = ctx.grid;
  const left = bounds.x * size + offsetX;
  const top = bounds.y * size + offsetY;
  const right = (bounds.x + bounds.cols) * size + offsetX;
  const bottom = (bounds.y + bounds.rows) * size + offsetY;
  const perimeter: MapWallElement = {
    id: nextId(),
    layerId: ctx.layerIds.walls,
    type: "wall",
    locked: false,
    hidden: false,
    // Identity transform (plan §4.1b): points carry the geometry; scale 0
    // would be rejected by sanitizeElement and abort the whole command.
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: {
      points: [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
        { x: left, y: top },
      ],
      blocksMovement: true,
      blocksVision: true,
    },
  };

  return { cells, elements: [perimeter] };
}
