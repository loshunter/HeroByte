// Pure geometry for the Hallway tool: an axis-dominant drag → a corridor of
// floor cells plus TWO wall polylines along its long sides (open ends, so a
// hallway junctions cleanly with the rooms it connects), plus painted wall
// RIBBONS along those sides when a wall family is armed. Emitted through the
// same `place-room` command the Room tool uses (floor + walls as ONE undo).
// React-free so the corridor math is unit-testable.

import type { MapGridSettings, MapLayer, MapWallElement, TerrainPaintCell } from "@herobyte/shared";
import { getTerrainCell } from "@herobyte/shared";
import { generateUUID } from "../../utils/uuid";
import { findWallsLayer } from "../map-studio/components/wallDoorDrafts";
import { INTERIOR_FLOOR_ASSET_IDS } from "./mapEditFamilies";
import {
  MAX_ROOM_CELLS,
  type RoomBounds,
  type RoomCommand,
  type RoomWallRingOptions,
} from "./roomBuilder";
import type { MapEditFloorFamily } from "./mapEditTypes";

/** Corridor width is DM-chosen in cells; clamp to a sane 1–4. */
export const MIN_HALLWAY_WIDTH = 1;
export const MAX_HALLWAY_WIDTH = 4;

export interface HallwayBuildResult {
  command: RoomCommand | null;
  /** The corridor's document-space bounds (for POPULATE / onRegionPlaced). */
  bounds: RoomBounds | null;
  error: string | null;
}

interface Drag {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

/** The subset of grid settings the corridor math needs (MapGridSettings fits). */
interface GridSpacing {
  size: number;
  offsetX: number;
  offsetY: number;
}

interface HallwayGeometry {
  horizontal: boolean;
  aMin: number;
  aMax: number;
  cLow: number;
  width: number;
  bounds: RoomBounds;
}

function cellIndex(px: number, offset: number, size: number): number {
  return Math.round((px - offset) / size);
}

function clampWidth(widthCells: number): number {
  return Math.min(MAX_HALLWAY_WIDTH, Math.max(MIN_HALLWAY_WIDTH, Math.round(widthCells)));
}

/**
 * Solve the corridor in "along axis" (a) / "cross axis" (c) cell space so one
 * branch handles both orientations, then map back to x/y bounds. The drag's
 * dominant axis picks the direction; the band is `widthCells` cells across,
 * centered on the cross-cell the drag began in.
 */
function hallwayGeometry(drag: Drag, widthCells: number, grid: GridSpacing): HallwayGeometry {
  const width = clampWidth(widthCells);
  const { size, offsetX, offsetY } = grid;
  const horizontal = Math.abs(drag.end.x - drag.start.x) >= Math.abs(drag.end.y - drag.start.y);

  const alongStart = horizontal ? drag.start.x : drag.start.y;
  const alongEnd = horizontal ? drag.end.x : drag.end.y;
  const alongOffset = horizontal ? offsetX : offsetY;
  const crossStart = horizontal ? drag.start.y : drag.start.x;
  const crossOffset = horizontal ? offsetY : offsetX;

  const aStart = cellIndex(alongStart, alongOffset, size);
  const aEnd = cellIndex(alongEnd, alongOffset, size);
  const aMin = Math.min(aStart, aEnd);
  const aMax = Math.max(aStart, aEnd);
  const cLow = cellIndex(crossStart, crossOffset, size) - Math.floor((width - 1) / 2);

  const aLoPx = aMin * size + alongOffset;
  const aHiPx = (aMax + 1) * size + alongOffset;
  const cLoPx = cLow * size + crossOffset;
  const cHiPx = (cLow + width) * size + crossOffset;

  const bounds: RoomBounds = horizontal
    ? { x: aLoPx, y: cLoPx, width: aHiPx - aLoPx, height: cHiPx - cLoPx }
    : { x: cLoPx, y: aLoPx, width: cHiPx - cLoPx, height: aHiPx - aLoPx };

  return { horizontal, aMin, aMax, cLow, width, bounds };
}

/** The corridor's document-space bounds — shared by the command builder + preview. */
export function hallwayBoundsFromDrag(
  drag: Drag,
  widthCells: number,
  grid: GridSpacing,
): RoomBounds {
  return hallwayGeometry(drag, widthCells, grid).bounds;
}

function wallElement(
  layerId: string,
  a: { x: number; y: number },
  b: { x: number; y: number },
): MapWallElement {
  return {
    id: generateUUID(),
    layerId,
    type: "wall",
    locked: false,
    hidden: false,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: { points: [a, b], blocksMovement: true, blocksVision: true },
  };
}

/**
 * Build the place-room payload for a hallway. Only the two LONG sides get walls
 * (the ends stay open), and — when `ring` arms a wall family — a painted
 * one-cell wall ribbon along each long side, matching the Room tool's band.
 * Ribbon cells skip a neighbouring room's laid interior floor so a corridor
 * running along a room never bricks over it. Returns command=null + error when
 * there's no walls layer or the corridor exceeds the cell cap.
 */
export function buildHallwayCommand(
  drag: Drag,
  family: MapEditFloorFamily,
  widthCells: number,
  grid: MapGridSettings,
  layers: Map<string, MapLayer>,
  ring: RoomWallRingOptions = { wallFamily: "none", terrain: null },
): HallwayBuildResult {
  const wallsLayer = findWallsLayer(layers);
  if (!wallsLayer) {
    return { command: null, bounds: null, error: "No walls layer to hold the hallway walls." };
  }
  const { horizontal, aMin, aMax, cLow, width, bounds } = hallwayGeometry(drag, widthCells, grid);
  const lengthCells = aMax - aMin + 1;
  const withRibbon = ring.wallFamily !== "none";
  const cellBudget = lengthCells * (withRibbon ? width + 2 : width);
  if (cellBudget > MAX_ROOM_CELLS) {
    return {
      command: null,
      bounds: null,
      error: `Hallway is too large (max ${MAX_ROOM_CELLS} cells).`,
    };
  }

  const assetId = `terrain:${family}`;
  const cells: TerrainPaintCell[] = [];
  for (let a = aMin; a <= aMax; a += 1) {
    for (let c = cLow; c < cLow + width; c += 1) {
      cells.push(horizontal ? { x: a, y: c, assetId } : { x: c, y: a, assetId });
    }
  }

  if (withRibbon) {
    const wallAssetId = `terrain:${ring.wallFamily}`;
    const keepsFloor = (cx: number, cy: number): boolean =>
      ring.terrain !== null &&
      INTERIOR_FLOOR_ASSET_IDS.has(getTerrainCell(ring.terrain, cx, cy) ?? "");
    for (let a = aMin; a <= aMax; a += 1) {
      for (const c of [cLow - 1, cLow + width]) {
        const cx = horizontal ? a : c;
        const cy = horizontal ? c : a;
        if (!keepsFloor(cx, cy)) cells.push({ x: cx, y: cy, assetId: wallAssetId });
      }
    }
  }

  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  const walls: MapWallElement[] = horizontal
    ? [
        wallElement(wallsLayer.id, { x: bounds.x, y: bounds.y }, { x: right, y: bounds.y }),
        wallElement(wallsLayer.id, { x: bounds.x, y: bottom }, { x: right, y: bottom }),
      ]
    : [
        wallElement(wallsLayer.id, { x: bounds.x, y: bounds.y }, { x: bounds.x, y: bottom }),
        wallElement(wallsLayer.id, { x: right, y: bounds.y }, { x: right, y: bottom }),
      ];

  return { command: { cells, elements: walls }, bounds, error: null };
}
