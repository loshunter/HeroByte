// ============================================================================
// BUILDING RECIPE — the properties a generated interior must always have
// ============================================================================
// A dungeon can be judged by eye; a building cannot, because the thing that
// makes it a building is what you CANNOT do — walk through a wall, or find a
// second way in. So these are properties over many seeds, kinds and sizes
// rather than a handful of examples, and each one names the failure it exists
// to catch.

import { createMapDocument, createSeededRng, type MapElement } from "@herobyte/shared";
import { describe, expect, it } from "vitest";
import golden from "./fixtures/building-seed1-24x20-tavern.json" with { type: "json" };
import { buildingRecipe } from "../buildingRecipe.js";
import { generateBuildingLayout, type EntrySide } from "../buildingLayout.js";
import { cellKey } from "../dungeonLayout.js";
import { assertRecipeBudget, resolveRecipeContext } from "../recipeContext.js";
import { MAX_STAMP_ELEMENTS, type CellBounds, type RecipeContext } from "../types.js";

const KINDS = ["tavern", "shop", "warehouse", "house"] as const;
const SEEDS = [1, 2, 3, 7, 11, 23, 42, 99, 404, 1234, 5150, 8675, 90210, 31337, 65535];
const BOUNDS: CellBounds = { x: 0, y: 0, cols: 24, rows: 20 };
const PRESETS: CellBounds[] = [
  { x: 0, y: 0, cols: 24, rows: 20 },
  { x: 0, y: 0, cols: 48, rows: 36 },
  { x: 3, y: 5, cols: 30, rows: 24 },
];

function context(bounds: CellBounds = BOUNDS, idPrefix = "test"): RecipeContext {
  const document = createMapDocument({
    id: "doc",
    name: "Doc",
    width: (bounds.x + bounds.cols) * 50,
    height: (bounds.y + bounds.rows) * 50,
    timestamp: 1,
  });
  return resolveRecipeContext(document, bounds, idPrefix);
}

function layoutFor(seed: number, bounds = BOUNDS, entrySide: EntrySide = "south") {
  return generateBuildingLayout(createSeededRng(seed), bounds.cols, bounds.rows, entrySide);
}

/** Every cell a door's edge separates — the two the door swings between. */
function doorCells(edge: { x: number; y: number; orientation: "h" | "v" }) {
  return edge.orientation === "h"
    ? [cellKey(edge.x, edge.y), cellKey(edge.x, edge.y - 1)]
    : [cellKey(edge.x, edge.y), cellKey(edge.x - 1, edge.y)];
}

describe("buildingLayout — the shape of an interior", () => {
  it.each(KINDS)("has exactly ONE way in from outside, for %s", (kind) => {
    for (const seed of SEEDS) {
      const layout = layoutFor(seed);
      // A perimeter door is one whose edge separates floor from the void.
      const perimeter = layout.doorSites.filter((site) => {
        const [a, b] = doorCells(site.edge);
        return [a, b].filter((cell) => layout.floor.has(cell!)).length === 1;
      });
      expect({ kind, seed, perimeter: perimeter.length }).toEqual({ kind, seed, perimeter: 1 });
      expect(perimeter[0]!.edge).toEqual(layout.frontDoor.edge);
    }
  });

  it("seals everything else: no floor cell touches the outside except through the front door", () => {
    for (const seed of SEEDS) {
      const layout = layoutFor(seed);
      const doorEdges = new Set(
        layout.doorSites.map((s) => `${s.edge.orientation}:${s.edge.x},${s.edge.y}`),
      );
      const leaks: string[] = [];
      for (const key of layout.floor) {
        const [x, y] = key.split(",").map(Number);
        const sides = [
          { n: cellKey(x!, y! - 1), edge: `h:${x},${y}` },
          { n: cellKey(x!, y! + 1), edge: `h:${x},${y! + 1}` },
          { n: cellKey(x! - 1, y!), edge: `v:${x},${y}` },
          { n: cellKey(x! + 1, y!), edge: `v:${x! + 1},${y}` },
        ];
        for (const side of sides) {
          if (!layout.floor.has(side.n) && doorEdges.has(side.edge)) {
            // A door onto the void is legal only for the ONE front door.
            if (
              side.edge !==
              `${layout.frontDoor.edge.orientation}:${layout.frontDoor.edge.x},${layout.frontDoor.edge.y}`
            ) {
              leaks.push(`seed ${seed}: ${key} opens out at ${side.edge}`);
            }
          }
        }
      }
      expect(leaks).toEqual([]);
    }
  });

  it("connects every room to every other, through door cells only", () => {
    for (const bounds of PRESETS) {
      for (const seed of SEEDS) {
        const layout = layoutFor(seed, bounds);
        // Walk the floor: a BFS that may cross between rooms ONLY on a cell
        // that a door site opens. If the partitions were not real walls this
        // would pass vacuously, so the wall test below is its companion.
        const start = layout.arrivalCells[0]!;
        const seen = new Set<string>([cellKey(start.x, start.y)]);
        const queue = [start];
        while (queue.length) {
          const cell = queue.shift()!;
          for (const next of [
            { x: cell.x + 1, y: cell.y },
            { x: cell.x - 1, y: cell.y },
            { x: cell.x, y: cell.y + 1 },
            { x: cell.x, y: cell.y - 1 },
          ]) {
            const key = cellKey(next.x, next.y);
            if (!layout.floor.has(key) || seen.has(key)) continue;
            seen.add(key);
            queue.push(next);
          }
        }
        const unreachable = layout.rooms
          .map((room, index) => ({ index, reached: seen.has(cellKey(room.x, room.y)) }))
          .filter((r) => !r.reached);
        expect({ bounds: bounds.cols, seed, unreachable }).toEqual({
          bounds: bounds.cols,
          seed,
          unreachable: [],
        });
      }
    }
  });

  it("keeps its partitions ONE CELL thick and unpainted — an invisible wall is the failure", () => {
    for (const seed of SEEDS) {
      const layout = layoutFor(seed);
      // Between two rooms there is at least one non-floor cell: that cell is
      // what emitWallHalo paints. A zero-gap partition would put two rooms
      // edge to edge with only a wall ELEMENT between them, and elements do
      // not render as scenery — the players would see one open room.
      const touching: string[] = [];
      for (let i = 0; i < layout.rooms.length; i += 1) {
        for (let j = i + 1; j < layout.rooms.length; j += 1) {
          const a = layout.rooms[i]!;
          const b = layout.rooms[j]!;
          const gapX = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w));
          const gapY = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h));
          if (gapX < 0 && gapY < 0) touching.push(`seed ${seed}: rooms ${i} and ${j} overlap`);
          else if (gapX === 0 && gapY < 0)
            touching.push(`seed ${seed}: rooms ${i} and ${j} share a vertical edge`);
          else if (gapY === 0 && gapX < 0)
            touching.push(`seed ${seed}: rooms ${i} and ${j} share a horizontal edge`);
        }
      }
      expect(touching).toEqual([]);
    }
  });

  it("puts the arrival strip inside the entry room, against the front door", () => {
    for (const side of ["north", "south", "east", "west"] as const) {
      for (const seed of SEEDS) {
        const layout = layoutFor(seed, BOUNDS, side);
        const room = layout.rooms[layout.entryRoomIndex]!;
        expect(layout.arrivalCells.length).toBeGreaterThanOrEqual(1);
        expect(layout.arrivalCells.length).toBeLessThanOrEqual(3);
        for (const cell of layout.arrivalCells) {
          expect(layout.floor.has(cellKey(cell.x, cell.y))).toBe(true);
          expect(cell.x).toBeGreaterThanOrEqual(room.x);
          expect(cell.x).toBeLessThan(room.x + room.w);
          expect(cell.y).toBeGreaterThanOrEqual(room.y);
          expect(cell.y).toBeLessThan(room.y + room.h);
        }
        // One of them is the cell the door actually opens onto.
        const opened = doorCells(layout.frontDoor.edge).filter((key) => layout.floor.has(key));
        expect(opened).toHaveLength(1);
        expect(layout.arrivalCells.map((c) => cellKey(c.x, c.y))).toContain(opened[0]);
      }
    }
  });

  it("entrySide moves the way IN and nothing else — the rooms are the same building", () => {
    for (const seed of SEEDS.slice(0, 6)) {
      const south = layoutFor(seed, BOUNDS, "south");
      const north = layoutFor(seed, BOUNDS, "north");
      expect(north.rooms).toEqual(south.rooms);
      // The interior doors are identical; only the front door differs.
      const interior = (l: typeof south) =>
        l.doorSites.filter((s) => s.edge !== l.frontDoor.edge).map((s) => s.edge);
      expect(interior(north)).toEqual(interior(south));
      expect(north.frontDoor.edge).not.toEqual(south.frontDoor.edge);
    }
  });
});

describe("buildingRecipe — output", () => {
  it("is deterministic for a seed, and different across seeds and kinds", () => {
    const a = buildingRecipe(7, BOUNDS, { recipeId: "building", kind: "tavern" }, context());
    const b = buildingRecipe(7, BOUNDS, { recipeId: "building", kind: "tavern" }, context());
    const otherSeed = buildingRecipe(
      8,
      BOUNDS,
      { recipeId: "building", kind: "tavern" },
      context(),
    );
    const otherKind = buildingRecipe(7, BOUNDS, { recipeId: "building", kind: "shop" }, context());
    expect(a).toEqual(b);
    expect(a).not.toEqual(otherSeed);
    expect(a).not.toEqual(otherKind);
  });

  it("passes the caller's entrySide THROUGH — the recipe, not just the layout", () => {
    // The layout honours entrySide (pinned above), but nothing pinned that the
    // recipe hands it over: hardcoding "south" here would leave a DM's choice
    // silently ignored, and the wire already carries the field.
    const of = (entrySide: EntrySide) =>
      buildingRecipe(9, BOUNDS, { recipeId: "building", kind: "house", entrySide }, context());
    const south = of("south");
    const north = of("north");
    expect(north.arrival).not.toEqual(south.arrival);
    // The interior is the same house: same painted floor plan, different way in.
    expect(north.cells).toEqual(south.cells);
    // ...and the default is south, so omitting the field changes nothing.
    const omitted = buildingRecipe(9, BOUNDS, { recipeId: "building", kind: "house" }, context());
    expect(omitted).toEqual(south);
  });

  it("does not depend on the idPrefix for anything but the ids", () => {
    const strip = (elements: MapElement[]) => elements.map(({ id: _id, ...rest }) => rest);
    const one = buildingRecipe(
      3,
      BOUNDS,
      { recipeId: "building", kind: "house" },
      context(BOUNDS, "a"),
    );
    const two = buildingRecipe(
      3,
      BOUNDS,
      { recipeId: "building", kind: "house" },
      context(BOUNDS, "bbbb"),
    );
    expect(one.cells).toEqual(two.cells);
    expect(strip(one.elements).sort()).toEqual(strip(two.elements).sort());
  });

  it.each(KINDS)(
    "paints %s with its own floor and wall, and keys it with its own table",
    (kind) => {
      const output = buildingRecipe(5, BOUNDS, { recipeId: "building", kind }, context());
      const assets = new Set(output.cells.map((cell) => cell.assetId));
      expect(assets.size).toBe(2); // one floor, one wall band
      const keys = output.elements.filter((element) => element.type === "text");
      expect(keys.length).toBeGreaterThan(0);
      const perKind: Record<string, RegExp> = {
        tavern: /PATRONS|KEEPER|BRAWL|EMPTY|LOOT/,
        shop: /SHOPKEEP|LOOT|STOCK|EMPTY|THIEF/,
        warehouse: /CARGO|GUARDS|EMPTY|TRAP|LOOT/,
        house: /FAMILY|EMPTY|LETTER|SOMEONE|LOOT/,
      };
      for (const key of keys) {
        expect(key.type === "text" && key.data.text).toMatch(perKind[kind]!);
        expect(key.type === "text" && key.data.visibleToPlayers).toBe(false);
      }
    },
  );

  it.each(KINDS)(
    "keeps every %s stamp on a floor cell, clear of its doors and its arrival",
    (kind) => {
      for (const seed of SEEDS.slice(0, 8)) {
        const layout = layoutFor(seed);
        const output = buildingRecipe(seed, BOUNDS, { recipeId: "building", kind }, context());
        const blocked = new Set<string>(layout.arrivalCells.map((c) => cellKey(c.x, c.y)));
        for (const site of layout.doorSites)
          for (const cell of doorCells(site.edge)) blocked.add(cell);

        for (const element of output.elements) {
          if (element.type !== "stamp") continue;
          const cols = Math.round(element.data.width / 50);
          const rows = Math.round(element.data.height / 50);
          const left = Math.round((element.transform.x - element.data.width / 2) / 50);
          const top = Math.round((element.transform.y - element.data.height / 2) / 50);
          for (let dy = 0; dy < rows; dy += 1) {
            for (let dx = 0; dx < cols; dx += 1) {
              const key = cellKey(left + dx, top + dy);
              expect(
                layout.floor.has(key),
                `${kind} seed ${seed}: stamp off the floor at ${key}`,
              ).toBe(true);
              expect(blocked.has(key), `${kind} seed ${seed}: stamp blocks ${key}`).toBe(false);
            }
          }
        }
      }
    },
  );

  it("keeps every element inside the document, for every preset", () => {
    for (const bounds of PRESETS) {
      const ctx = context(bounds);
      const width = (bounds.x + bounds.cols) * 50;
      const height = (bounds.y + bounds.rows) * 50;
      const output = buildingRecipe(13, bounds, { recipeId: "building", kind: "warehouse" }, ctx);
      for (const element of output.elements) {
        const points =
          element.type === "wall"
            ? element.data.points.map((p) => ({
                x: element.transform.x + p.x,
                y: element.transform.y + p.y,
              }))
            : [{ x: element.transform.x, y: element.transform.y }];
        for (const point of points) {
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeGreaterThanOrEqual(0);
          expect(point.x).toBeLessThanOrEqual(width);
          expect(point.y).toBeLessThanOrEqual(height);
        }
      }
    }
  });

  it("reports an arrival that is inside its own floor plan", () => {
    for (const bounds of PRESETS) {
      const output = buildingRecipe(
        21,
        bounds,
        { recipeId: "building", kind: "tavern" },
        context(bounds),
      );
      const layout = layoutFor(21, bounds);
      const arrival = output.arrival!;
      expect(arrival).toBeDefined();
      const left = arrival.x - (arrival.width - 1) / 2;
      const top = arrival.y - (arrival.height - 1) / 2;
      for (let dx = 0; dx < arrival.width; dx += 1) {
        for (let dy = 0; dy < arrival.height; dy += 1) {
          // The zone is in ABSOLUTE document cells; the layout is bounds-local.
          expect(layout.floor.has(cellKey(left + dx - bounds.x, top + dy - bounds.y))).toBe(true);
        }
      }
    }
  });

  it("authors every door CLOSED — an authored-open door compiles to a hole", () => {
    const output = buildingRecipe(2, BOUNDS, { recipeId: "building", kind: "shop" }, context());
    const doors = output.elements.filter((element) => element.type === "door");
    expect(doors.length).toBeGreaterThan(0);
    for (const door of doors) {
      expect(door.type === "door" && door.data.state).toBe("closed");
      expect(door.type === "door" && door.data.blocksMovement).toBe(true);
    }
  });
});

describe("buildingRecipe — the determinism contract", () => {
  it("golden: seed 1, a 24x20 tavern, emits the pinned building byte for byte", () => {
    // THE determinism contract, and the foundation of Cartridge Codes for
    // buildings: this exact seed must produce this exact interior forever.
    // Regenerating this fixture is a CONTRACT CHANGE requiring owner sign-off
    // — never a refactor.
    const output = buildingRecipe(
      1,
      { x: 4, y: 4, cols: 24, rows: 20 },
      { recipeId: "building", kind: "tavern" },
      context({ x: 4, y: 4, cols: 24, rows: 20 }, "golden"),
    );

    expect({ cells: output.cells, elements: output.elements }).toEqual(golden);
    expect(output.arrival).toEqual({ x: 15.5, y: 22, width: 2, height: 1, rotation: 0 });

    // Guard the guard: a golden of an empty box would pin a bug, not the
    // contract. This one is a real tavern — partitioned, doored, furnished.
    const layout = generateBuildingLayout(createSeededRng(1), 24, 20, "south");
    expect(layout.rooms.length).toBeGreaterThanOrEqual(2);
    expect(output.elements.filter((e) => e.type === "door").length).toBeGreaterThan(0);
    expect(output.elements.filter((e) => e.type === "stamp").length).toBeGreaterThan(0);
    expect(output.elements.filter((e) => e.type === "light").length).toBeGreaterThan(0);
  });
});

describe("the stamp budget", () => {
  it("refuses an output past MAX_STAMP_ELEMENTS rather than shipping it as one command", () => {
    // A realistic layout cannot reach the cap, so this is synthetic on purpose:
    // the cap was declared with the others and never enforced until a recipe
    // stamped at all, and a cap nothing can reach is a cap nothing tests.
    const stamp = {
      id: "s",
      layerId: "objects",
      type: "stamp" as const,
      locked: false,
      hidden: false,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      data: { assetId: "objects:crate", width: 50, height: 50 },
    };
    const under = { cells: [], elements: Array.from({ length: MAX_STAMP_ELEMENTS }, () => stamp) };
    const over = {
      cells: [],
      elements: Array.from({ length: MAX_STAMP_ELEMENTS + 1 }, () => stamp),
    };
    expect(() => assertRecipeBudget(under)).not.toThrow();
    expect(() => assertRecipeBudget(over)).toThrow(/stamp budget/);
  });

  it("passes a real building of every kind at the largest preset", () => {
    for (const kind of KINDS) {
      const bounds: CellBounds = { x: 0, y: 0, cols: 96, rows: 64 };
      const output = buildingRecipe(1, bounds, { recipeId: "building", kind }, context(bounds));
      expect(() => assertRecipeBudget(output)).not.toThrow();
    }
  });
});
