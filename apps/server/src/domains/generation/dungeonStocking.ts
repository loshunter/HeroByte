// ============================================================================
// DUNGEON STOCKING v0 — rooms arrive furnished and keyed, not just drawn
// ============================================================================
// VISION's "stocked, not just drawn": geometry-only generation is the gap every
// competitor has. v0 ships the two cheapest halves of it — a brazier light per
// lit room, and a GM-only marker saying what lives there.
//
// SECRECY: markers are text elements on the "notes"-kind layer, which
// `deriveMapElements` strips from EVERY recipient's snapshot (scenePublish.ts)
// — so they are DM-only by construction, not by filtering after the fact.
// `visibleToPlayers: false` is belt-and-braces on top of that. They are NOT
// `hidden: true`: hidden would also hide them from the DM's own overlay.
//
// Lights compile into CompiledScene today but nothing renders them yet — that
// is deliberate. Authoring them now means every dungeon generated before the
// lighting system ships lights up on the day it does.

import type { MapElement, MapLightElement, MapTextElement, SeededRng } from "@herobyte/shared";
import type { CellRect, DungeonLayout } from "./dungeonLayout.js";
import type { CellBounds, RecipeContext } from "./types.js";

/** Fixed table — indexed by roll, so the stream stays stable if entries move. */
const ROOM_KEYS = [
  "SPAWN: 2d4 skeletons",
  "SPAWN: 3 giant rats",
  "SPAWN: goblin scouts (2)",
  "LOOT: locked chest — DC 12",
  "LOOT: rubble, 3d6 sp",
  "EMPTY — dust and echoes",
  "EMPTY — collapsed ceiling",
  "TRAP: dart panel — DC 13",
] as const;

const BRAZIER_CHANCE = 0.6;
const BRAZIER_COLOR = "#ffb347";
const BRAZIER_INTENSITY = 0.8;
/** Radius in CELLS; scaled to px by the document grid. */
const BRAZIER_RADIUS_CELLS = 3;
const MARKER_COLOR = "#ffd479";
const MARKER_FONT_SIZE = 14;

/**
 * One fixed roll-block per room, drawn BEFORE any conditional so adding a
 * feature later can never shift the stream (plan §4.2):
 *   1. brazier? 2. brazier corner 3. room key
 */
export function emitStocking(
  layout: DungeonLayout,
  bounds: CellBounds,
  ctx: RecipeContext,
  rng: SeededRng,
  nextId: () => string,
): MapElement[] {
  const elements: MapElement[] = [];

  for (const room of layout.rooms) {
    const brazierRoll = rng();
    const cornerRoll = rng();
    const keyRoll = rng();

    if (brazierRoll < BRAZIER_CHANCE) {
      elements.push(brazierFor(room, cornerRoll, bounds, ctx, nextId()));
    }
    elements.push(markerFor(room, keyRoll, bounds, ctx, nextId()));
  }

  return elements;
}

/** A brazier tucked into one of the room's four inside corners. */
function brazierFor(
  room: CellRect,
  cornerRoll: number,
  bounds: CellBounds,
  ctx: RecipeContext,
  id: string,
): MapLightElement {
  const corner = Math.floor(cornerRoll * 4);
  const cellX = corner % 2 === 0 ? room.x : room.x + room.w - 1;
  const cellY = corner < 2 ? room.y : room.y + room.h - 1;

  return {
    id,
    layerId: ctx.layerIds.lighting,
    type: "light",
    locked: false,
    hidden: false,
    transform: {
      // Cell CENTRE: a light is a point source, unlike the corner-lattice walls.
      x: centreX(cellX, bounds, ctx),
      y: centreY(cellY, bounds, ctx),
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    },
    data: {
      radius: BRAZIER_RADIUS_CELLS * ctx.grid.size,
      color: BRAZIER_COLOR,
      intensity: BRAZIER_INTENSITY,
      castsShadows: true,
    },
  };
}

/** The room's key, on the GM Notes layer. Players never receive this. */
function markerFor(
  room: CellRect,
  keyRoll: number,
  bounds: CellBounds,
  ctx: RecipeContext,
  id: string,
): MapTextElement {
  return {
    id,
    layerId: ctx.layerIds.notes,
    type: "text",
    locked: false,
    hidden: false,
    transform: {
      x: centreX(room.x, bounds, ctx),
      y: centreY(room.y, bounds, ctx),
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    },
    data: {
      text: ROOM_KEYS[Math.floor(keyRoll * ROOM_KEYS.length)] ?? ROOM_KEYS[0],
      color: MARKER_COLOR,
      fontSize: MARKER_FONT_SIZE,
      // Redundant with the notes-layer strip, and kept that way on purpose:
      // two independent reasons this never reaches a player.
      visibleToPlayers: false,
    },
  };
}

function centreX(cellX: number, bounds: CellBounds, ctx: RecipeContext): number {
  return (bounds.x + cellX) * ctx.grid.size + ctx.grid.offsetX + ctx.grid.size / 2;
}

function centreY(cellY: number, bounds: CellBounds, ctx: RecipeContext): number {
  return (bounds.y + cellY) * ctx.grid.size + ctx.grid.offsetY + ctx.grid.size / 2;
}
