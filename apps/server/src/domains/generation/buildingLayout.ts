// ============================================================================
// BUILDING LAYOUT — a footprint partitioned into rooms by ONE-CELL-THICK walls
// ============================================================================
// Pure and seeded. The footprint is the region inset by one cell; a seeded BSP
// splits it into rooms, and every split RESERVES a non-floor line (a column or
// a row) between its two halves. That reserved line IS the wall the players
// see: emitWallHalo paints every non-floor cell touching floor, and wall
// ELEMENTS never render as scenery — so a zero-gap partition would be an
// invisible blocking line (plan §2.3).
//
// Doors are floor cells punched through a line. Each punched cell is ASSIGNED
// to the room on one side in `roomIndexByCell`, so the shared wall tracer sees
// exactly one seam edge for it — the door site — and the other edge is
// interior. That is why emitGeometry takes an index rather than deriving one
// from `rooms`: a cell outside every room rect would otherwise be walled on
// both sides and the doorway sealed.
//
// Roll discipline (plan §4.2): a FIXED three rolls per split, drawn before any
// test, so a rule change can never shift the stream after it.

import type { SeededRng } from "@herobyte/shared";
import { cellKey, type CellRect, type DoorSite, type DungeonLayout } from "./dungeonLayout.js";

export type EntrySide = "north" | "south" | "east" | "west";

/** A dungeon layout plus what a building adds: its own cell→room index and the way in. */
export interface BuildingLayout extends DungeonLayout {
  /** Every floor cell's room, punched door cells included (assigned to one side). */
  roomIndexByCell: Map<string, number>;
  /** The front door's site (also present in `doorSites`). */
  frontDoor: DoorSite;
  entryRoomIndex: number;
  /** The entry room's cells just inside the front door — 1 to 3, in one line. */
  arrivalCells: { x: number; y: number }[];
}

const MIN_ROOM_W = 4;
const MIN_ROOM_H = 3;
/** At or under this area a rect stops splitting even when it could. */
const LEAF_AREA = 30;
const MAX_DEPTH = 5;
/** A rect longer than this on either axis splits regardless of the stop roll. */
const MUST_SPLIT_W = 12;
const MUST_SPLIT_H = 9;
const STOP_CHANCE = 0.25;

export function generateBuildingLayout(
  rng: SeededRng,
  cols: number,
  rows: number,
  entrySide: EntrySide,
): BuildingLayout {
  const footprint: CellRect = { x: 1, y: 1, w: cols - 2, h: rows - 2 };
  const rooms: CellRect[] = [];
  const partitions: Partition[] = [];
  split(rng, footprint, 0, rooms, partitions);

  const roomIndexByCell = new Map<string, number>();
  rooms.forEach((room, index) => {
    for (let y = room.y; y < room.y + room.h; y += 1) {
      for (let x = room.x; x < room.x + room.w; x += 1) {
        roomIndexByCell.set(cellKey(x, y), index);
      }
    }
  });

  const doorSites: DoorSite[] = [];
  for (const partition of partitions) {
    const door = punch(partition, roomIndexByCell);
    if (door) doorSites.push(door);
  }

  const front = frontDoorFor(footprint, entrySide, rooms, roomIndexByCell);
  doorSites.push(front.site);

  return {
    rooms,
    floor: new Set(roomIndexByCell.keys()),
    doorSites,
    roomIndexByCell,
    frontDoor: front.site,
    entryRoomIndex: front.roomIndex,
    arrivalCells: front.arrivalCells,
  };
}

/** A reserved non-floor line between two child rects. */
interface Partition {
  orientation: "v" | "h";
  /** Column (v) or row (h) of the reserved line. */
  line: number;
  /** The inclusive span the line covers, along itself. */
  from: number;
  to: number;
}

function split(
  rng: SeededRng,
  rect: CellRect,
  depth: number,
  rooms: CellRect[],
  partitions: Partition[],
): void {
  // FIXED rolls, drawn before any test.
  const orientationRoll = rng();
  const positionRoll = rng();
  const stopRoll = rng();

  const canSplitV = rect.w >= MIN_ROOM_W * 2 + 1;
  const canSplitH = rect.h >= MIN_ROOM_H * 2 + 1;
  const mustSplit = rect.w > MUST_SPLIT_W || rect.h > MUST_SPLIT_H;
  const wantsToStop = rect.w * rect.h <= LEAF_AREA || stopRoll < STOP_CHANCE;
  if (depth >= MAX_DEPTH || (!canSplitV && !canSplitH) || (wantsToStop && !mustSplit)) {
    rooms.push(rect);
    return;
  }

  // The longer axis splits; the roll only breaks a square tie.
  const vertical =
    canSplitV && (!canSplitH || rect.w > rect.h || (rect.w === rect.h && orientationRoll < 0.5));

  if (vertical) {
    const lo = rect.x + MIN_ROOM_W;
    const hi = rect.x + rect.w - MIN_ROOM_W - 1;
    const line = lo + Math.floor(positionRoll * (hi - lo + 1));
    partitions.push({ orientation: "v", line, from: rect.y, to: rect.y + rect.h - 1 });
    split(rng, { x: rect.x, y: rect.y, w: line - rect.x, h: rect.h }, depth + 1, rooms, partitions);
    split(
      rng,
      { x: line + 1, y: rect.y, w: rect.x + rect.w - line - 1, h: rect.h },
      depth + 1,
      rooms,
      partitions,
    );
  } else {
    const lo = rect.y + MIN_ROOM_H;
    const hi = rect.y + rect.h - MIN_ROOM_H - 1;
    const line = lo + Math.floor(positionRoll * (hi - lo + 1));
    partitions.push({ orientation: "h", line, from: rect.x, to: rect.x + rect.w - 1 });
    split(rng, { x: rect.x, y: rect.y, w: rect.w, h: line - rect.y }, depth + 1, rooms, partitions);
    split(
      rng,
      { x: rect.x, y: line + 1, w: rect.w, h: rect.y + rect.h - line - 1 },
      depth + 1,
      rooms,
      partitions,
    );
  }
}

/**
 * Punch one floor cell through the middle of a partition line, joining it to
 * the room on the FIRST side so that edge is interior; the door site is the
 * edge facing the second. A later split of either half can have put ANOTHER
 * reserved line exactly at the middle, so walk outwards until both neighbours
 * are floor.
 */
function punch(partition: Partition, roomIndexByCell: Map<string, number>): DoorSite | undefined {
  const middle = Math.floor((partition.from + partition.to) / 2);
  const vertical = partition.orientation === "v";
  for (let offset = 0; offset <= partition.to - partition.from; offset += 1) {
    for (const along of offset === 0 ? [middle] : [middle - offset, middle + offset]) {
      if (along < partition.from || along > partition.to) continue;
      const cell = vertical ? { x: partition.line, y: along } : { x: along, y: partition.line };
      const before = vertical ? { x: cell.x - 1, y: cell.y } : { x: cell.x, y: cell.y - 1 };
      const after = vertical ? { x: cell.x + 1, y: cell.y } : { x: cell.x, y: cell.y + 1 };
      const roomBefore = roomIndexByCell.get(cellKey(before.x, before.y));
      const roomAfter = roomIndexByCell.get(cellKey(after.x, after.y));
      if (roomBefore === undefined || roomAfter === undefined) continue;
      roomIndexByCell.set(cellKey(cell.x, cell.y), roomBefore);
      // The seam between the punched cell and the AFTER room: a vertical line's
      // is the "v" edge at (x+1, y); a horizontal line's is "h" at (x, y+1).
      const edge = vertical
        ? { x: cell.x + 1, y: cell.y, orientation: "v" as const }
        : { x: cell.x, y: cell.y + 1, orientation: "h" as const };
      return { edge, roomIndex: roomAfter };
    }
  }
  return undefined;
}

/**
 * The front door: the middle of `entrySide`'s footprint edge, on the outer
 * shell. It opens into whichever room owns the cell just inside — the middle
 * of a side can land on a partition line, so slide along until one does. The
 * arrival strip is up to three of that room's cells in a line inside the door.
 */
function frontDoorFor(
  footprint: CellRect,
  entrySide: EntrySide,
  rooms: CellRect[],
  roomIndexByCell: Map<string, number>,
): { site: DoorSite; roomIndex: number; arrivalCells: { x: number; y: number }[] } {
  const horizontal = entrySide === "north" || entrySide === "south";
  const midX = footprint.x + Math.floor((footprint.w - 1) / 2);
  const midY = footprint.y + Math.floor((footprint.h - 1) / 2);
  const insideRow =
    entrySide === "north"
      ? footprint.y
      : entrySide === "south"
        ? footprint.y + footprint.h - 1
        : midY;
  const insideCol =
    entrySide === "west"
      ? footprint.x
      : entrySide === "east"
        ? footprint.x + footprint.w - 1
        : midX;
  // The shell edge OUTSIDE the inside cell: north/west sit on the cell's own
  // corner, south/east one past it.
  const edgeRow = entrySide === "south" ? insideRow + 1 : insideRow;
  const edgeCol = entrySide === "east" ? insideCol + 1 : insideCol;

  const span = horizontal
    ? [footprint.x, footprint.x + footprint.w - 1]
    : [footprint.y, footprint.y + footprint.h - 1];
  const start = horizontal ? midX : midY;
  for (let offset = 0; offset <= span[1]! - span[0]!; offset += 1) {
    for (const along of offset === 0 ? [start] : [start - offset, start + offset]) {
      if (along < span[0]! || along > span[1]!) continue;
      const cell = horizontal ? { x: along, y: insideRow } : { x: insideCol, y: along };
      const roomIndex = roomIndexByCell.get(cellKey(cell.x, cell.y));
      if (roomIndex === undefined) continue;
      const room = rooms[roomIndex]!;
      const edge = horizontal
        ? { x: along, y: edgeRow, orientation: "h" as const }
        : { x: edgeCol, y: along, orientation: "v" as const };
      const strip = horizontal
        ? [cell.x - 1, cell.x, cell.x + 1].map((x) => ({ x, y: cell.y }))
        : [cell.y - 1, cell.y, cell.y + 1].map((y) => ({ x: cell.x, y }));
      return {
        site: { edge, roomIndex },
        roomIndex,
        arrivalCells: strip.filter(
          (c) => c.x >= room.x && c.x < room.x + room.w && c.y >= room.y && c.y < room.y + room.h,
        ),
      };
    }
  }
  throw new Error("Building footprint has no floor on its entry side");
}
