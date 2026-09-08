// ============================================================================
// BUILDING DRESSING — keys the DM reads, furniture the players see
// ============================================================================
// Kind-specific room keys on the notes layer (DM-only by construction: the
// notes-kind layer is stripped from every recipient by deriveMapElements, and
// visibleToPlayers is the second, independent lock), and stamps on the objects
// layer from the shared recipe vocabulary.
//
// Nothing is placed on a door cell or on the arrival strip: a crate in the
// doorway is a door that will not open, and a table where the party lands is a
// party standing inside the furniture.
//
// Roll discipline: ONE fixed pair of rolls per room — the key, then a
// variation — drawn before any conditional (plan §4.2).

import {
  RECIPE_OBJECT_ASSETS,
  type BuildingRecipeParams,
  type MapElement,
  type MapStampElement,
  type MapTextElement,
  type SeededRng,
} from "@herobyte/shared";
import type { BuildingLayout } from "./buildingLayout.js";
import { cellKey, type CellRect } from "./dungeonLayout.js";
import { centreX, centreY, pxX, pxY } from "./geometryLattice.js";
import type { CellBounds, RecipeContext } from "./types.js";

/** Fixed tables — indexed by roll, so the stream survives an entry moving. */
const ROOM_KEYS: Record<BuildingRecipeParams["kind"], readonly string[]> = {
  tavern: [
    "PATRONS: 2d4 locals, one of them listening",
    "THE KEEPER: knows every rumour, sells none cheap",
    "A BRAWL waiting — two mercenaries, one tab",
    "EMPTY — closed for the night, the fire still warm",
    "LOOT: strongbox under the counter — DC 14",
  ],
  shop: [
    "THE SHOPKEEP: honest prices, dishonest scales",
    "LOOT: strongbox under the counter — DC 14",
    "STOCK: 1d4 mundane items are actually magical",
    "EMPTY — closed for the night",
    "A THIEF is here already, mid-job",
  ],
  warehouse: [
    "CARGO: 3d6 crates, one marked with the Guild's seal",
    "GUARDS: 2 dockhands paid to look away",
    "EMPTY — dust, rats, and one recent footprint",
    "TRAP: a rigged stack — DC 13 to notice",
    "LOOT: a smuggler's cache under the floorboards",
  ],
  house: [
    "THE FAMILY is home — and afraid of something",
    "EMPTY — left in a hurry, the meal still on the table",
    "A LETTER on the mantel names a name the party knows",
    "SOMEONE is hiding in the back room",
    "LOOT: 2d10 gp in a jar — and a collector's mark on the door",
  ],
};

const MARKER_COLOR = "#ffd479";
const MARKER_FONT_SIZE = 14;

type ObjectAsset = (typeof RECIPE_OBJECT_ASSETS)[keyof typeof RECIPE_OBJECT_ASSETS];

export function emitBuildingDressing(
  layout: BuildingLayout,
  kind: BuildingRecipeParams["kind"],
  bounds: CellBounds,
  ctx: RecipeContext,
  rng: SeededRng,
  nextId: () => string,
): MapElement[] {
  const keys = ROOM_KEYS[kind];
  const reserved = reservedCells(layout);
  const elements: MapElement[] = [];
  const areaOrder = layout.rooms
    .map((room, index) => ({ index, area: room.w * room.h }))
    .sort((a, b) => b.area - a.area || a.index - b.index);
  const largest = areaOrder[0]?.index ?? -1;
  const smallest = areaOrder[areaOrder.length - 1]?.index ?? -1;

  layout.rooms.forEach((room, index) => {
    const keyRoll = rng();
    const variationRoll = rng();
    const key = keys[Math.floor(keyRoll * keys.length)] ?? keys[0]!;
    elements.push(markerFor(room, key, bounds, ctx, nextId()));
    for (const piece of furnitureFor(
      kind,
      room,
      index,
      { largest, smallest },
      layout,
      reserved,
      variationRoll,
    )) {
      elements.push(stampAt(piece.asset, piece.cell, bounds, ctx, nextId()));
    }
  });
  return elements;
}

/** Door cells and the arrival strip: never furnished. */
function reservedCells(layout: BuildingLayout): Set<string> {
  const reserved = new Set<string>();
  for (const site of layout.doorSites) {
    const { x, y, orientation } = site.edge;
    // A site's edge separates two cells; both are kept clear so a door swings.
    reserved.add(cellKey(x, y));
    reserved.add(orientation === "h" ? cellKey(x, y - 1) : cellKey(x - 1, y));
  }
  for (const cell of layout.arrivalCells) reserved.add(cellKey(cell.x, cell.y));
  return reserved;
}

interface Piece {
  asset: ObjectAsset;
  /** Top-left cell of the footprint. */
  cell: { x: number; y: number };
}

function furnitureFor(
  kind: BuildingRecipeParams["kind"],
  room: CellRect,
  index: number,
  rank: { largest: number; smallest: number },
  layout: BuildingLayout,
  reserved: Set<string>,
  variationRoll: number,
): Piece[] {
  const fits = (asset: ObjectAsset, cell: { x: number; y: number }): boolean => {
    for (let dy = 0; dy < asset.rows; dy += 1) {
      for (let dx = 0; dx < asset.columns; dx += 1) {
        const key = cellKey(cell.x + dx, cell.y + dy);
        const inRoom =
          cell.x + dx >= room.x &&
          cell.x + dx < room.x + room.w &&
          cell.y + dy >= room.y &&
          cell.y + dy < room.y + room.h;
        if (!inRoom || !layout.floor.has(key) || reserved.has(key)) return false;
      }
    }
    return true;
  };
  const place = (asset: ObjectAsset, cells: { x: number; y: number }[]): Piece[] => {
    const pieces: Piece[] = [];
    for (const cell of cells) {
      if (!fits(asset, cell)) continue;
      pieces.push({ asset, cell });
      for (let dy = 0; dy < asset.rows; dy += 1) {
        for (let dx = 0; dx < asset.columns; dx += 1) {
          reserved.add(cellKey(cell.x + dx, cell.y + dy));
        }
      }
    }
    return pieces;
  };
  const inset = (margin: number): { x: number; y: number }[] => {
    const cells: { x: number; y: number }[] = [];
    for (let y = room.y + margin; y < room.y + room.h - margin; y += 1) {
      for (let x = room.x + margin; x < room.x + room.w - margin; x += 1) cells.push({ x, y });
    }
    return cells;
  };
  const perimeter = () =>
    inset(0).filter(
      (c) =>
        c.x === room.x ||
        c.x === room.x + room.w - 1 ||
        c.y === room.y ||
        c.y === room.y + room.h - 1,
    );
  const phase = variationRoll < 0.5 ? 0 : 1;

  switch (kind) {
    case "tavern":
      if (index === rank.largest) {
        // Tables on a spaced grid: every third column, every other row.
        return place(
          RECIPE_OBJECT_ASSETS.table,
          inset(1).filter((c) => (c.x - room.x + phase) % 3 === 0 && (c.y - room.y) % 2 === 0),
        );
      }
      if (index === rank.smallest) {
        return place(
          RECIPE_OBJECT_ASSETS.crate,
          perimeter().filter((_, i) => i % 2 === phase),
        );
      }
      return [];
    case "warehouse":
      return place(
        RECIPE_OBJECT_ASSETS.crate,
        perimeter().filter((_, i) => i % 2 === phase),
      );
    case "shop":
      if (index === layout.entryRoomIndex) {
        // The counter: a row of tables across the room, two cells in from the
        // wall the party enters through.
        const horizontal = layout.frontDoor.edge.orientation === "h";
        const anchor = layout.arrivalCells[0];
        if (!anchor) return [];
        const line = horizontal
          ? anchor.y + (anchor.y - room.y < room.h / 2 ? 2 : -2)
          : anchor.x + (anchor.x - room.x < room.w / 2 ? 2 : -2);
        return place(
          RECIPE_OBJECT_ASSETS.table,
          inset(0).filter((c) =>
            horizontal
              ? c.y === line && (c.x - room.x) % 2 === 0
              : c.x === line && (c.y - room.y) % 2 === 0,
          ),
        );
      }
      return [];
    case "house":
      return index === rank.largest ? place(RECIPE_OBJECT_ASSETS.table, inset(1).slice(0, 1)) : [];
  }
}

/** A stamp covering the asset's footprint from a top-left cell, in document px. */
function stampAt(
  asset: ObjectAsset,
  cell: { x: number; y: number },
  bounds: CellBounds,
  ctx: RecipeContext,
  id: string,
): MapStampElement {
  const width = asset.columns * ctx.grid.size;
  const height = asset.rows * ctx.grid.size;
  return {
    id,
    layerId: ctx.layerIds.objects,
    type: "stamp",
    locked: false,
    hidden: false,
    transform: {
      // A stamp's origin is its CENTRE (the palette's free-stamp convention).
      x: pxX(cell.x, bounds, ctx) + width / 2,
      y: pxY(cell.y, bounds, ctx) + height / 2,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    },
    data: { assetId: asset.id, width, height },
  };
}

/** The room's key, on the GM Notes layer. Never SENT to a player — but the
 * key roll shares a stream with player-visible dressing, and every stream
 * derives from one 32-bit seed, so it is not secret against someone who
 * knows this source. See dungeonStocking.ts's secrecy note and plan §7. */
function markerFor(
  room: CellRect,
  text: string,
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
    data: { text, color: MARKER_COLOR, fontSize: MARKER_FONT_SIZE, visibleToPlayers: false },
  };
}
