// ============================================================================
// DUNGEON RECIPE — seed + region -> a playable, stocked dungeon
// ============================================================================
// Pure and total: the same (seed, bounds, params, ctx) always yields the same
// rooms, corridors, doors, walls, floor, lights, and keys. That contract is what
// makes Cartridge Codes possible, so nothing here may touch Math.random,
// Date.now, or crypto ids (plan §4.1).

import { createSeededRng, type PlayerStagingZone } from "@herobyte/shared";
import { generateLayout, type CellRect } from "./dungeonLayout.js";
import { emitGeometry, type GeometryMaterials } from "./dungeonGeometry.js";
import { shuffleIds } from "./recipeIds.js";
import { emitStocking } from "./dungeonStocking.js";
import { makeIdFactory } from "./types.js";
import type { CellBounds, DungeonParams, RecipeContext, RecipeOutput } from "./types.js";

/**
 * Stream salts (FROZEN — part of the determinism contract). Each stage draws
 * from its OWN generator so a roll-count change inside one stage can never
 * shift the output of the stages after it. (Geometry has no stream: it draws no
 * rolls now that no generated door is secret — see dungeonGeometry.emitDoors.
 * 0x1f123bb5 was its salt; keep it reserved if that ever returns.)
 */
const STOCKING_STREAM = 0x6a09e667;
const ID_STREAM = 0x85ebca6b;

/** The dungeon's two themes, each a floor and the wall band around it. */
const THEME_MATERIALS: Record<DungeonParams["theme"], GeometryMaterials> = {
  stone: { floorAssetId: "terrain:stone-floor", wallAssetId: "terrain:wall-stone" },
  wood: { floorAssetId: "terrain:wood-floor", wallAssetId: "terrain:wall-timber" },
};

export function dungeonRecipe(
  seed: number,
  bounds: CellBounds,
  params: DungeonParams,
  ctx: RecipeContext,
): RecipeOutput {
  const nextId = makeIdFactory(ctx.idPrefix);
  const layout = generateLayout(createSeededRng(seed), bounds.cols, bounds.rows, params.density);
  const geometry = emitGeometry(layout, bounds, THEME_MATERIALS[params.theme], ctx, nextId);
  const stocking = emitStocking(
    layout,
    bounds,
    ctx,
    createSeededRng(seed ^ STOCKING_STREAM),
    nextId,
  );

  return {
    cells: geometry.cells,
    elements: shuffleIds(
      [...geometry.elements, ...stocking],
      ctx.idPrefix,
      createSeededRng(seed ^ ID_STREAM),
    ),
    arrival: arrivalZone(layout.rooms[0], bounds),
  };
}

/**
 * The entrance is the FIRST room (placement order is seeded and stable), as
 * a center-anchored zone in ABSOLUTE document cells: a room covering cells
 * x..x+w-1 has its center at x + (w-1)/2, which is the cell whose center
 * pixel ((x + 0.5) × grid) the staging-zone renderer and camera use.
 */
function arrivalZone(
  room: CellRect | undefined,
  bounds: CellBounds,
): PlayerStagingZone | undefined {
  if (!room) return undefined;
  return {
    x: bounds.x + room.x + (room.w - 1) / 2,
    y: bounds.y + room.y + (room.h - 1) / 2,
    width: room.w,
    height: room.h,
    rotation: 0,
  };
}
