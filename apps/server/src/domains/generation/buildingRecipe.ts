// ============================================================================
// BUILDING RECIPE — seed + region -> a sealed, entered, furnished interior
// ============================================================================
// Pure and total, like the dungeon: the same (seed, bounds, params, ctx) yields
// the same rooms, partitions, doors, lights, keys and furniture. Each stage
// draws from its OWN seeded stream, so a roll-count change in one can never
// shift the stages after it; the layout's rolls come from the base seed and the
// salts below are FROZEN with the determinism contract (plan §4.1).

import {
  createSeededRng,
  RECIPE_FLOOR_ASSETS,
  RECIPE_WALL_ASSETS,
  type BuildingRecipeParams,
  type MapLightElement,
  type PlayerStagingZone,
} from "@herobyte/shared";
import { emitBuildingDressing } from "./buildingDressing.js";
import { generateBuildingLayout, type BuildingLayout } from "./buildingLayout.js";
import { emitGeometry, type GeometryMaterials } from "./dungeonGeometry.js";
import { centreX, centreY } from "./geometryLattice.js";
import { shuffleIds } from "./recipeIds.js";
import { makeIdFactory } from "./types.js";
import type { CellBounds, RecipeContext, RecipeOutput } from "./types.js";

/** Stream salts (FROZEN — part of the determinism contract). */
const DRESSING_STREAM = 0x3c6ef372;
const ID_STREAM = 0xa54ff53a;

const ROOM_LIGHT_COLOR = "#ffd58a";
const ROOM_LIGHT_INTENSITY = 0.7;
/** Radius in CELLS; scaled to px by the document grid. */
const ROOM_LIGHT_RADIUS_CELLS = 4;

/** Kind → the floor it is laid with and the wall band around it. */
const KIND_MATERIALS: Record<BuildingRecipeParams["kind"], GeometryMaterials> = {
  tavern: { floorAssetId: RECIPE_FLOOR_ASSETS.woodFloor, wallAssetId: RECIPE_WALL_ASSETS.timber },
  shop: { floorAssetId: RECIPE_FLOOR_ASSETS.stoneCobble, wallAssetId: RECIPE_WALL_ASSETS.brick },
  warehouse: { floorAssetId: RECIPE_FLOOR_ASSETS.woodGrey, wallAssetId: RECIPE_WALL_ASSETS.dark },
  house: { floorAssetId: RECIPE_FLOOR_ASSETS.woodWalnut, wallAssetId: RECIPE_WALL_ASSETS.timber },
};

export function buildingRecipe(
  seed: number,
  bounds: CellBounds,
  params: BuildingRecipeParams,
  ctx: RecipeContext,
): RecipeOutput {
  const nextId = makeIdFactory(ctx.idPrefix);
  const layout = generateBuildingLayout(
    createSeededRng(seed),
    bounds.cols,
    bounds.rows,
    params.entrySide ?? "south",
  );
  // The layout's OWN index, not one derived from `rooms`: a punched door cell
  // sits outside every room rect, and deriving would wall it on both sides.
  const geometry = emitGeometry(
    layout,
    bounds,
    KIND_MATERIALS[params.kind],
    ctx,
    nextId,
    layout.roomIndexByCell,
  );
  const lights = emitRoomLights(layout, bounds, ctx, nextId);
  const dressing = emitBuildingDressing(
    layout,
    params.kind,
    bounds,
    ctx,
    createSeededRng(seed ^ DRESSING_STREAM),
    nextId,
  );

  return {
    cells: geometry.cells,
    elements: shuffleIds(
      [...geometry.elements, ...lights, ...dressing],
      ctx.idPrefix,
      createSeededRng(seed ^ ID_STREAM),
    ),
    arrival: arrivalZone(layout, bounds),
  };
}

/** A warm light at every room's centre — a building is lived in. */
function emitRoomLights(
  layout: BuildingLayout,
  bounds: CellBounds,
  ctx: RecipeContext,
  nextId: () => string,
): MapLightElement[] {
  return layout.rooms.map((room) => ({
    id: nextId(),
    layerId: ctx.layerIds.lighting,
    type: "light" as const,
    locked: false,
    hidden: false,
    transform: {
      x: centreX(room.x + Math.floor((room.w - 1) / 2), bounds, ctx),
      y: centreY(room.y + Math.floor((room.h - 1) / 2), bounds, ctx),
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    },
    data: {
      radius: ROOM_LIGHT_RADIUS_CELLS * ctx.grid.size,
      color: ROOM_LIGHT_COLOR,
      intensity: ROOM_LIGHT_INTENSITY,
      castsShadows: true,
    },
  }));
}

/**
 * The entrance: the strip of entry-room cells just inside the front door, as a
 * center-anchored zone in ABSOLUTE document cells (the staging-zone convention
 * — x/y is the centre cell, so a strip of three is width 3, height 1).
 */
function arrivalZone(layout: BuildingLayout, bounds: CellBounds): PlayerStagingZone {
  const xs = layout.arrivalCells.map((c) => c.x);
  const ys = layout.arrivalCells.map((c) => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: bounds.x + (minX + maxX) / 2,
    y: bounds.y + (minY + maxY) / 2,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    rotation: 0,
  };
}
