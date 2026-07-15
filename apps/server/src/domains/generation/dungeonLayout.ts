// ============================================================================
// DUNGEON LAYOUT — the algorithmic heart (pure, cell-space)
// ============================================================================
// Rooms and the corridors that join them, in BOUNDS-LOCAL cells. No pixels, no
// elements, no I/O — G3 turns this into geometry. Deterministic by contract:
// every decision comes from the injected `layoutRng` stream, and every decision
// point draws a FIXED number of rolls BEFORE any conditional skip, so adding a
// rejection case can never shift the stream for everything after it.
//
// Where the plan's spec left slack, the choice made here is frozen by G3's
// golden — do not "improve" it without owner sign-off (see ROOM SIZING).

import type { SeededRng } from "@herobyte/shared";
import type { DungeonParams } from "./types.js";

/** A room in bounds-local cells: covers x..x+w-1 by y..y+h-1. */
export interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A cell-lattice edge, addressed by its lower-coordinate CORNER:
 * - "h" at (x,y) runs (x,y)->(x+1,y): the seam between cells (x,y-1) and (x,y).
 * - "v" at (x,y) runs (x,y)->(x,y+1): the seam between cells (x-1,y) and (x,y).
 */
export interface LayoutEdge {
  x: number;
  y: number;
  orientation: "h" | "v";
}

export interface DoorSite {
  edge: LayoutEdge;
  roomIndex: number;
}

export interface DungeonLayout {
  rooms: CellRect[];
  /** Floor cells keyed `"x,y"` (bounds-local). Build keys with `cellKey`. */
  floor: Set<string>;
  doorSites: DoorSite[];
}

const ROOM_DIVISOR: Record<DungeonParams["density"], number> = {
  low: 140,
  medium: 90,
  high: 60,
};
const MIN_ROOMS = 2;
const MAX_ROOMS = 40;
const ATTEMPTS_PER_ROOM = 12;
const MIN_ROOM_SIDE = 3;
/** Rolled side is MIN_ROOM_SIDE + floor(roll * ROOM_SIDE_SPREAD) → 3..9. */
const ROOM_SIDE_SPREAD = 7;

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function generateLayout(
  rng: SeededRng,
  cols: number,
  rows: number,
  density: DungeonParams["density"],
): DungeonLayout {
  const rooms = placeRooms(rng, cols, rows, density);
  const roomIndexByCell = indexRoomCells(rooms);
  const corridor = carveCorridors(rng, rooms, density, cols, rows, roomIndexByCell);
  const floor = new Set<string>(roomIndexByCell.keys());
  for (const key of corridor) floor.add(key);
  return { rooms, floor, doorSites: findDoorSites(corridor, roomIndexByCell) };
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

function placeRooms(
  rng: SeededRng,
  cols: number,
  rows: number,
  density: DungeonParams["density"],
): CellRect[] {
  const target = clamp(Math.round((cols * rows) / ROOM_DIVISOR[density]), MIN_ROOMS, MAX_ROOMS);
  const attempts = target * ATTEMPTS_PER_ROOM;
  const rooms: CellRect[] = [];

  for (let attempt = 0; attempt < attempts && rooms.length < target; attempt++) {
    // FIXED 4 rolls per attempt, drawn before any test (stream stability).
    const wRoll = rng();
    const hRoll = rng();
    const xRoll = rng();
    const yRoll = rng();

    // ROOM SIZING (spec gap, resolved here): a rolled side of up to 9 cannot
    // fit the 8x8 minimum region, so the side is CLAMPED to what fits with a
    // 1-cell margin at both edges rather than rejected. Clamping keeps the
    // 4-roll stream and guarantees the first attempt always accepts — so every
    // legal region yields at least one room for EVERY seed, instead of leaving
    // "did anything generate?" to chance.
    const w = Math.min(MIN_ROOM_SIDE + Math.floor(wRoll * ROOM_SIDE_SPREAD), cols - 2);
    const h = Math.min(MIN_ROOM_SIDE + Math.floor(hRoll * ROOM_SIDE_SPREAD), rows - 2);
    if (w < MIN_ROOM_SIDE || h < MIN_ROOM_SIDE) continue;

    // Inset by 1: rooms never touch the region border, so corridors and walls
    // always have a cell to live in.
    const rect: CellRect = {
      x: 1 + Math.floor(xRoll * (cols - w - 1)),
      y: 1 + Math.floor(yRoll * (rows - h - 1)),
      w,
      h,
    };
    if (rooms.some((placed) => touchesWithMargin(rect, placed))) continue;
    rooms.push(rect);
  }

  return rooms;
}

/** True when the rects are closer than one empty cell apart (or overlap). */
function touchesWithMargin(a: CellRect, b: CellRect): boolean {
  return (
    a.x - 1 <= b.x + b.w - 1 && b.x <= a.x + a.w && a.y - 1 <= b.y + b.h - 1 && b.y <= a.y + a.h
  );
}

/** Map every room cell to its room index. Exported: G3 needs it to find seams. */
export function indexRoomCells(rooms: CellRect[]): Map<string, number> {
  const byCell = new Map<string, number>();
  rooms.forEach((room, index) => {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        byCell.set(cellKey(x, y), index);
      }
    }
  });
  return byCell;
}

function centerOf(room: CellRect): { x: number; y: number } {
  return {
    x: Math.floor((room.x + room.x + room.w - 1) / 2),
    y: Math.floor((room.y + room.y + room.h - 1) / 2),
  };
}

// ---------------------------------------------------------------------------
// Corridors
// ---------------------------------------------------------------------------

/**
 * Join every room to the nearest ALREADY-CONNECTED room (rooms are processed in
 * placement order, so that is simply rooms 0..i-1). Connectivity therefore holds
 * by construction — no repair pass, which is where determinism goes to die.
 * Returns corridor-only cells (room cells excluded).
 */
function carveCorridors(
  rng: SeededRng,
  rooms: CellRect[],
  density: DungeonParams["density"],
  cols: number,
  rows: number,
  roomIndexByCell: Map<string, number>,
): Set<string> {
  const corridor = new Set<string>();
  const width = density === "high" ? 2 : 1;

  for (let i = 1; i < rooms.length; i++) {
    const to = centerOf(rooms[i]!);
    const from = centerOf(rooms[nearestConnected(rooms, i, to)]!);
    // One roll per corridor, drawn unconditionally.
    const horizontalFirst = rng() < 0.5;
    if (horizontalFirst) {
      carveRun(corridor, "h", from.y, from.x, to.x, width, cols, rows);
      carveRun(corridor, "v", to.x, from.y, to.y, width, cols, rows);
    } else {
      carveRun(corridor, "v", from.x, from.y, to.y, width, cols, rows);
      carveRun(corridor, "h", to.y, from.x, to.x, width, cols, rows);
    }
  }

  for (const key of roomIndexByCell.keys()) corridor.delete(key);
  return corridor;
}

/** Manhattan-nearest earlier room; ties go to the LOWER index (never identity). */
function nearestConnected(rooms: CellRect[], index: number, to: { x: number; y: number }): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let j = 0; j < index; j++) {
    const center = centerOf(rooms[j]!);
    const distance = Math.abs(center.x - to.x) + Math.abs(center.y - to.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = j;
    }
  }
  return best;
}

/**
 * Carve one leg. `line` is the fixed coordinate (row for "h", column for "v");
 * the run spans from..to inclusive. A width-2 band adds the neighbouring cell
 * at line+1 (below a horizontal run, right of a vertical one).
 */
function carveRun(
  corridor: Set<string>,
  orientation: "h" | "v",
  line: number,
  from: number,
  to: number,
  width: number,
  cols: number,
  rows: number,
): void {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  for (let step = start; step <= end; step++) {
    for (let band = 0; band < width; band++) {
      const x = orientation === "h" ? step : line + band;
      const y = orientation === "h" ? line + band : step;
      if (x >= 0 && x < cols && y >= 0 && y < rows) corridor.add(cellKey(x, y));
    }
  }
}

// ---------------------------------------------------------------------------
// Door sites
// ---------------------------------------------------------------------------

interface EdgeCandidate extends LayoutEdge {
  roomIndex: number;
}

/**
 * Every corridor/room seam is a door candidate. CONTIGUOUS candidates on the
 * same line into the same room form ONE group (a width-2 corridor meets a room
 * across two adjacent seams), and each group yields exactly ONE door at its
 * lowest (y,x) edge — the rest stay walled. That is what keeps a wide corridor
 * sealed: one door, one wall, never a hole.
 */
function findDoorSites(corridor: Set<string>, roomIndexByCell: Map<string, number>): DoorSite[] {
  const candidates: EdgeCandidate[] = [];
  for (const key of corridor) {
    const [cx, cy] = key.split(",").map(Number) as [number, number];
    pushCandidate(candidates, roomIndexByCell, cx, cy + 1, { x: cx, y: cy + 1, orientation: "h" });
    pushCandidate(candidates, roomIndexByCell, cx, cy - 1, { x: cx, y: cy, orientation: "h" });
    pushCandidate(candidates, roomIndexByCell, cx + 1, cy, { x: cx + 1, y: cy, orientation: "v" });
    pushCandidate(candidates, roomIndexByCell, cx - 1, cy, { x: cx, y: cy, orientation: "v" });
  }

  // Sort first so grouping never depends on Set iteration order.
  candidates.sort(
    (a, b) =>
      a.roomIndex - b.roomIndex ||
      a.orientation.localeCompare(b.orientation) ||
      lineOf(a) - lineOf(b) ||
      positionOf(a) - positionOf(b),
  );

  const doors: DoorSite[] = [];
  let previous: EdgeCandidate | undefined;
  for (const candidate of candidates) {
    const contiguous =
      previous !== undefined &&
      previous.roomIndex === candidate.roomIndex &&
      previous.orientation === candidate.orientation &&
      lineOf(previous) === lineOf(candidate) &&
      positionOf(candidate) - positionOf(previous) === 1;
    // The sort put the group's lowest (y,x) edge first, so a new group's head
    // IS its door; contiguous followers stay walled.
    if (!contiguous) {
      doors.push({
        edge: { x: candidate.x, y: candidate.y, orientation: candidate.orientation },
        roomIndex: candidate.roomIndex,
      });
    }
    previous = candidate;
  }
  return doors;
}

function pushCandidate(
  into: EdgeCandidate[],
  roomIndexByCell: Map<string, number>,
  roomX: number,
  roomY: number,
  edge: LayoutEdge,
): void {
  const roomIndex = roomIndexByCell.get(cellKey(roomX, roomY));
  if (roomIndex !== undefined) into.push({ ...edge, roomIndex });
}

/** The fixed coordinate of the edge's line (row for "h", column for "v"). */
function lineOf(edge: LayoutEdge): number {
  return edge.orientation === "h" ? edge.y : edge.x;
}

/** The coordinate that varies along the edge's line. */
function positionOf(edge: LayoutEdge): number {
  return edge.orientation === "h" ? edge.x : edge.y;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
