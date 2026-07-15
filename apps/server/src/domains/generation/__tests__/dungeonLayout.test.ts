// ============================================================================
// DUNGEON LAYOUT PROPERTY TESTS
// ============================================================================
// The layout has no "expected output" to assert — its PROPERTIES are the spec.
// A dungeon must be fully walkable, stay inside its region, keep its rooms
// apart, and be bit-identical for a given seed. Everything else is taste.

import { describe, it, expect } from "vitest";
import { createSeededRng } from "@herobyte/shared";
import {
  cellKey,
  generateLayout,
  type CellRect,
  type DungeonLayout,
  type LayoutEdge,
} from "../dungeonLayout.js";
import type { DungeonParams } from "../types.js";

const DENSITIES: DungeonParams["density"][] = ["low", "medium", "high"];
const SEEDS = Array.from({ length: 25 }, (_, i) => i + 1);

function layoutFor(
  seed: number,
  cols = 40,
  rows = 30,
  density: DungeonParams["density"] = "medium",
) {
  return generateLayout(createSeededRng(seed), cols, rows, density);
}

function floorSignature(layout: DungeonLayout): string {
  return [...layout.floor].sort().join("|");
}

function cellsOf(room: CellRect): string[] {
  const cells: string[] = [];
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) cells.push(cellKey(x, y));
  }
  return cells;
}

/** The two cells an edge separates: [outside, inside] is not implied — order is [lower, higher]. */
function cellsOfEdge(edge: LayoutEdge): [string, string] {
  return edge.orientation === "h"
    ? [cellKey(edge.x, edge.y - 1), cellKey(edge.x, edge.y)]
    : [cellKey(edge.x - 1, edge.y), cellKey(edge.x, edge.y)];
}

/** 4-connected flood fill from the first floor cell, in scan order. */
function reachableFrom(layout: DungeonLayout): Set<string> {
  const ordered = [...layout.floor].sort();
  const seen = new Set<string>();
  const start = ordered[0];
  if (!start) return seen;
  const queue = [start];
  seen.add(start);
  while (queue.length) {
    const [x, y] = queue.pop()!.split(",").map(Number) as [number, number];
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      const key = cellKey(nx, ny);
      if (layout.floor.has(key) && !seen.has(key)) {
        seen.add(key);
        queue.push(key);
      }
    }
  }
  return seen;
}

/** The edge shared by two 4-adjacent cells, as a `${orientation}:${x},${y}` key. */
function seamBetween(a: string, b: string): string {
  const [ax, ay] = a.split(",").map(Number) as [number, number];
  const [bx, by] = b.split(",").map(Number) as [number, number];
  return ax === bx ? `h:${ax},${Math.max(ay, by)}` : `v:${Math.max(ax, bx)},${ay}`;
}

/**
 * Flood fill that models what G3 will BUILD: every room/corridor seam becomes a
 * wall unless it is a door site, so a step across a seam is only legal through
 * a door. This is the real "can the party walk the dungeon" property — plain
 * floor connectivity would pass even if every room were walled shut.
 */
function walkableFrom(layout: DungeonLayout): Set<string> {
  const roomOf = new Map<string, number>();
  layout.rooms.forEach((room, index) => cellsOf(room).forEach((cell) => roomOf.set(cell, index)));
  const doors = new Set(
    layout.doorSites.map((site) => `${site.edge.orientation}:${site.edge.x},${site.edge.y}`),
  );

  const ordered = [...layout.floor].sort();
  const seen = new Set<string>();
  const start = ordered[0];
  if (!start) return seen;
  const queue = [start];
  seen.add(start);
  while (queue.length) {
    const cell = queue.pop()!;
    const [x, y] = cell.split(",").map(Number) as [number, number];
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      const next = cellKey(nx, ny);
      if (!layout.floor.has(next) || seen.has(next)) continue;
      // Same room, or corridor-to-corridor: free. Otherwise it is a seam.
      const crossesSeam = roomOf.get(cell) !== roomOf.get(next);
      if (crossesSeam && !doors.has(seamBetween(cell, next))) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

describe("generateLayout — determinism", () => {
  it("is deterministic: identical inputs produce an identical layout", () => {
    const a = layoutFor(7);
    const b = layoutFor(7);

    expect(a).toEqual(b);
    expect(a.floor.size).toBeGreaterThan(0);
  });

  it("varies with the seed: five seeds produce five distinct floor plans", () => {
    const signatures = [1, 2, 3, 4, 5].map((seed) => floorSignature(layoutFor(seed)));

    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("does not leak state between calls (a repeated sequence replays identically)", () => {
    const first = [layoutFor(11), layoutFor(12)].map(floorSignature);
    const second = [layoutFor(11), layoutFor(12)].map(floorSignature);

    expect(second).toEqual(first);
  });
});

describe("generateLayout — connectivity", () => {
  it.each(DENSITIES)("leaves every floor cell walkable at %s density", (density) => {
    for (const seed of SEEDS) {
      const layout = layoutFor(seed, 40, 30, density);
      const reachable = reachableFrom(layout);

      expect({ seed, unreachable: layout.floor.size - reachable.size }).toEqual({
        seed,
        unreachable: 0,
      });
    }
  });

  it("connects every room to the walkable whole", () => {
    for (const seed of SEEDS) {
      const layout = layoutFor(seed);
      const reachable = reachableFrom(layout);
      const stranded = layout.rooms.filter((room) =>
        cellsOf(room).some((cell) => !reachable.has(cell)),
      );

      expect({ seed, stranded: stranded.length }).toEqual({ seed, stranded: 0 });
    }
  });

  it.each(DENSITIES)(
    "stays walkable at %s density once every doorless seam becomes a wall",
    (density) => {
      // The load-bearing property: G3 walls every seam that is not a door, so a
      // seam group without a door would silently brick a room shut.
      for (const seed of SEEDS) {
        const layout = layoutFor(seed, 40, 30, density);
        const walkable = walkableFrom(layout);

        expect({ seed, unwalkable: layout.floor.size - walkable.size }).toEqual({
          seed,
          unwalkable: 0,
        });
      }
    },
  );
});

describe("generateLayout — bounds and spacing", () => {
  it("keeps every floor cell inside the region", () => {
    for (const seed of SEEDS) {
      const layout = layoutFor(seed, 40, 30);
      const outside = [...layout.floor].filter((key) => {
        const [x, y] = key.split(",").map(Number) as [number, number];
        return x < 0 || x >= 40 || y < 0 || y >= 30;
      });

      expect({ seed, outside }).toEqual({ seed, outside: [] });
    }
  });

  it("keeps at least one empty cell between any two rooms", () => {
    for (const seed of SEEDS) {
      const { rooms } = layoutFor(seed);
      for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
          const a = rooms[i]!;
          const b = rooms[j]!;
          // `a` grown by one cell must not reach `b`.
          const touching =
            a.x - 1 <= b.x + b.w - 1 &&
            b.x <= a.x + a.w &&
            a.y - 1 <= b.y + b.h - 1 &&
            b.y <= a.y + a.h;

          expect({ seed, pair: [i, j], touching }).toEqual({ seed, pair: [i, j], touching: false });
        }
      }
    }
  });

  it("keeps rooms off the region border so walls and corridors have room", () => {
    for (const seed of SEEDS) {
      const { rooms } = layoutFor(seed, 40, 30);
      for (const room of rooms) {
        expect(room.x).toBeGreaterThanOrEqual(1);
        expect(room.y).toBeGreaterThanOrEqual(1);
        expect(room.x + room.w).toBeLessThanOrEqual(39);
        expect(room.y + room.h).toBeLessThanOrEqual(29);
      }
    }
  });
});

describe("generateLayout — door sites", () => {
  it("puts every door on a room/corridor seam", () => {
    for (const seed of SEEDS) {
      const layout = layoutFor(seed);
      const roomCells = new Map<string, number>();
      layout.rooms.forEach((room, index) =>
        cellsOf(room).forEach((cell) => roomCells.set(cell, index)),
      );

      for (const site of layout.doorSites) {
        const [low, high] = cellsOfEdge(site.edge);
        const inside = roomCells.get(low) === site.roomIndex ? low : high;
        const outside = inside === low ? high : low;

        // Inside: this room. Outside: corridor floor belonging to no room.
        expect({ seed, inside: roomCells.get(inside) }).toEqual({ seed, inside: site.roomIndex });
        expect({
          seed,
          outsideIsCorridor: layout.floor.has(outside) && !roomCells.has(outside),
        }).toEqual({ seed, outsideIsCorridor: true });
      }
    }
  });

  it("never places two doors on the same seam", () => {
    for (const seed of SEEDS) {
      const { doorSites } = layoutFor(seed);
      const keys = doorSites.map(
        (site) => `${site.edge.orientation}${cellKey(site.edge.x, site.edge.y)}`,
      );

      expect({ seed, unique: new Set(keys).size }).toEqual({ seed, unique: keys.length });
    }
  });

  it("gives a wide (high-density) corridor exactly one door per room seam", () => {
    // A width-2 corridor meets a room across two adjacent seams; the grouping
    // rule must collapse that into ONE door, or the second seam is a hole.
    for (const seed of SEEDS) {
      const layout = layoutFor(seed, 40, 30, "high");
      const perGroup = new Map<string, number>();
      for (const site of layout.doorSites) {
        // Group key: same room, same orientation, same line.
        const line = site.edge.orientation === "h" ? site.edge.y : site.edge.x;
        const position = site.edge.orientation === "h" ? site.edge.x : site.edge.y;
        const key = `${site.roomIndex}:${site.edge.orientation}:${line}`;
        const previous = perGroup.get(key);
        // Two doors on the same line into the same room must not be adjacent.
        if (previous !== undefined) {
          expect(Math.abs(position - previous)).toBeGreaterThan(1);
        }
        perGroup.set(key, position);
      }
    }
  });
});

describe("generateLayout — caps and minimums", () => {
  it("never floors more cells than the region holds", () => {
    for (const seed of SEEDS) {
      const layout = layoutFor(seed, 40, 30);
      expect(layout.floor.size).toBeLessThanOrEqual(40 * 30);
    }
  });

  it("yields at least one room at the 8x8 minimum for every seed", () => {
    for (const seed of SEEDS) {
      const layout = layoutFor(seed, 8, 8);

      expect({ seed, rooms: layout.rooms.length >= 1 }).toEqual({ seed, rooms: true });
      expect(layout.floor.size).toBeGreaterThan(0);
    }
  });

  it("scales room count with density", () => {
    const low = layoutFor(3, 60, 60, "low").rooms.length;
    const high = layoutFor(3, 60, 60, "high").rooms.length;

    expect(high).toBeGreaterThan(low);
  });
});
