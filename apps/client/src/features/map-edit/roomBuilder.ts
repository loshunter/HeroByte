// Pure geometry for the Room tool: a document-space rectangle → the floor
// terrain cells + a painted wall RING around them + the single wall-perimeter
// element that `place-room` applies as ONE undo step. Kept React-free so the
// risky cell/perimeter math is unit-testable in isolation.

import type {
  MapGridSettings,
  MapLayer,
  MapWallElement,
  TerrainMap,
  TerrainPaintCell,
} from "@herobyte/shared";
import { getTerrainCell } from "@herobyte/shared";
import { generateUUID } from "../../utils/uuid";
import { findWallsLayer } from "../map-studio/components/wallDoorDrafts";
import { INTERIOR_FLOOR_ASSET_IDS } from "./mapEditFamilies";
import type { MapEditFloorFamily, MapEditWallFamily } from "./mapEditTypes";

/** The paint-terrain / place-room cell cap; a room past it is refused. */
export const MAX_ROOM_CELLS = 16384;

export interface RoomBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoomCommand {
  cells: TerrainPaintCell[];
  elements: MapWallElement[];
}

export interface RoomBuildResult {
  command: RoomCommand | null;
  /** Set when the room was refused (too large, or no walls layer). */
  error: string | null;
}

export interface RoomWallRingOptions {
  /** Paint a one-cell wall band around the floor, or "none" to skip it. */
  wallFamily: MapEditWallFamily | "none";
  /** Current terrain, so the ring never overwrites a neighbouring room's laid
   * interior floor (see INTERIOR_FLOOR_ASSET_IDS). Null ⇒ nothing to protect. */
  terrain: TerrainMap | null;
}

/**
 * Build the place-room payload for a document-space rectangle. Returns
 * command=null with an error when the room has no walls layer to hold its
 * perimeter, or exceeds the cell cap. Floor cells are the integer grid cells
 * the bounds cover; `ring` adds the painted one-cell wall band around them
 * (the Czepeku look); the perimeter is one closed 5-point wall polyline
 * (zeroed transform) that compiles to the 4 blocking edges.
 */
export function buildRoomCommand(
  bounds: RoomBounds,
  family: MapEditFloorFamily,
  grid: MapGridSettings,
  layers: Map<string, MapLayer>,
  ring: RoomWallRingOptions = { wallFamily: "none", terrain: null },
): RoomBuildResult {
  const wallsLayer = findWallsLayer(layers);
  if (!wallsLayer) {
    return { command: null, error: "No walls layer to hold the room perimeter." };
  }

  const size = grid.size;
  const firstX = Math.round((bounds.x - grid.offsetX) / size);
  const firstY = Math.round((bounds.y - grid.offsetY) / size);
  const cols = Math.max(1, Math.round(bounds.width / size));
  const rows = Math.max(1, Math.round(bounds.height / size));

  const withRing = ring.wallFamily !== "none";
  const cellBudget = withRing ? (cols + 2) * (rows + 2) : cols * rows;
  if (cellBudget > MAX_ROOM_CELLS) {
    return { command: null, error: `Room is too large (max ${MAX_ROOM_CELLS} cells).` };
  }

  const assetId = `terrain:${family}`;
  const cells: TerrainPaintCell[] = [];
  for (let dy = 0; dy < rows; dy += 1) {
    for (let dx = 0; dx < cols; dx += 1) {
      cells.push({ x: firstX + dx, y: firstY + dy, assetId });
    }
  }

  if (withRing) {
    // One-cell wall band around the floor. Skip cells holding a neighbouring
    // room's interior floor — abutting rooms then share a single wall band,
    // and painting floor later still carves doorways (paint-over-wall wins).
    const wallAssetId = `terrain:${ring.wallFamily}`;
    const keepsFloor = (cx: number, cy: number): boolean =>
      ring.terrain !== null &&
      INTERIOR_FLOOR_ASSET_IDS.has(getTerrainCell(ring.terrain, cx, cy) ?? "");
    for (let dy = -1; dy <= rows; dy += 1) {
      for (let dx = -1; dx <= cols; dx += 1) {
        if (dy >= 0 && dy < rows && dx >= 0 && dx < cols) continue; // interior
        const cx = firstX + dx;
        const cy = firstY + dy;
        if (!keepsFloor(cx, cy)) cells.push({ x: cx, y: cy, assetId: wallAssetId });
      }
    }
  }

  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  const perimeter: MapWallElement = {
    id: generateUUID(),
    layerId: wallsLayer.id,
    type: "wall",
    locked: false,
    hidden: false,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: {
      points: [
        { x: bounds.x, y: bounds.y },
        { x: right, y: bounds.y },
        { x: right, y: bottom },
        { x: bounds.x, y: bottom },
        { x: bounds.x, y: bounds.y },
      ],
      blocksMovement: true,
      blocksVision: true,
    },
  };

  return { command: { cells, elements: [perimeter] }, error: null };
}
