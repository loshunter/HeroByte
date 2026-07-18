// ============================================================================
// DUNGEON GEOMETRY TESTS
// ============================================================================
// The SEALED-DUNGEON property is the correctness gate: every edge a walker must
// not cross carries exactly one blocker, and every edge they must cross carries
// none. Get this wrong and the dungeon either leaks (players walk through
// "walls") or bricks (a room with no way in) — neither is visible in a unit
// assertion on element counts.

import { describe, it, expect } from "vitest";
import { createSeededRng, DEFAULT_MAP_LAYERS, type MapGridSettings } from "@herobyte/shared";
import { emitGeometry } from "../dungeonGeometry.js";
import { cellKey, generateLayout, indexRoomCells } from "../dungeonLayout.js";
import { dungeonRecipe } from "../dungeonRecipe.js";
import type { CellBounds, DungeonParams, RecipeContext, RecipeOutput } from "../types.js";
import golden from "./fixtures/dungeon-seed1-24x20-stone.json" with { type: "json" };

const SEEDS = Array.from({ length: 15 }, (_, i) => i + 1);
const BOUNDS: CellBounds = { x: 4, y: 4, cols: 24, rows: 18 };
const PARAMS: DungeonParams = { theme: "stone", density: "medium" };

function grid(overrides: Partial<MapGridSettings> = {}): MapGridSettings {
  return {
    type: "square",
    size: 50,
    squareSize: 5,
    offsetX: 0,
    offsetY: 0,
    visible: true,
    snap: true,
    ...overrides,
  };
}

function context(overrides: Partial<RecipeContext> = {}): RecipeContext {
  return {
    grid: grid(),
    layerIds: { walls: "walls", lighting: "lighting", notes: "notes", objects: "objects" },
    idPrefix: "test",
    ...overrides,
  };
}

function outputFor(seed: number, params = PARAMS, ctx = context(), bounds = BOUNDS): RecipeOutput {
  const layout = generateLayout(createSeededRng(seed), bounds.cols, bounds.rows, params.density);
  return emitGeometry(layout, bounds, params, ctx);
}

/**
 * Re-derive, from the EMITTED geometry alone, which lattice edges carry a
 * blocker. A wall run covers every unit edge along its span; a door covers the
 * single edge it sits on. Keyed `${orientation}:${x},${y}` in CELL space.
 */
function blockersOf(output: RecipeOutput, ctx: RecipeContext, bounds: CellBounds) {
  const { size, offsetX, offsetY } = ctx.grid;
  const toCellX = (px: number) => (px - offsetX) / size - bounds.x;
  const toCellY = (py: number) => (py - offsetY) / size - bounds.y;
  const walls = new Map<string, number>();
  const doors = new Map<string, number>();

  for (const element of output.elements) {
    if (element.type === "wall") {
      const [a, b] = element.data.points as [{ x: number; y: number }, { x: number; y: number }];
      const horizontal = a.y === b.y;
      if (horizontal) {
        const y = toCellY(a.y);
        for (
          let x = Math.min(toCellX(a.x), toCellX(b.x));
          x < Math.max(toCellX(a.x), toCellX(b.x));
          x++
        ) {
          bump(walls, `h:${x},${y}`);
        }
      } else {
        const x = toCellX(a.x);
        for (
          let y = Math.min(toCellY(a.y), toCellY(b.y));
          y < Math.max(toCellY(a.y), toCellY(b.y));
          y++
        ) {
          bump(walls, `v:${x},${y}`);
        }
      }
    } else if (element.type === "door") {
      const orientation = element.transform.rotation === 0 ? "h" : "v";
      bump(doors, `${orientation}:${toCellX(element.transform.x)},${toCellY(element.transform.y)}`);
    }
  }
  return { walls, doors };
}

function bump(into: Map<string, number>, key: string): void {
  into.set(key, (into.get(key) ?? 0) + 1);
}

/** The edge between two 4-adjacent cells, in the corner-lattice convention. */
function seamBetween(ax: number, ay: number, bx: number, by: number): string {
  return ax === bx ? `h:${ax},${Math.max(ay, by)}` : `v:${Math.max(ax, bx)},${ay}`;
}

describe("emitGeometry — the sealed-dungeon property", () => {
  it.each(["low", "medium", "high"] as const)(
    "blocks exactly the edges a walker must not cross at %s density",
    (density) => {
      for (const seed of SEEDS) {
        const params = { ...PARAMS, density };
        const layout = generateLayout(createSeededRng(seed), BOUNDS.cols, BOUNDS.rows, density);
        const output = emitGeometry(layout, BOUNDS, params, context());
        const { walls, doors } = blockersOf(output, context(), BOUNDS);
        const roomOf = indexRoomCells(layout.rooms);
        const problems: string[] = [];

        for (const key of layout.floor) {
          const [x, y] = key.split(",").map(Number) as [number, number];
          for (const [nx, ny] of [
            [x + 1, y],
            [x - 1, y],
            [x, y + 1],
            [x, y - 1],
          ] as const) {
            const neighbour = cellKey(nx, ny);
            const seam = seamBetween(x, y, nx, ny);
            const wall = walls.get(seam) ?? 0;
            const door = doors.get(seam) ?? 0;

            if (!layout.floor.has(neighbour)) {
              // Outer shell: exactly one wall, never a door.
              if (wall !== 1 || door !== 0) problems.push(`shell ${seam}: ${wall}w ${door}d`);
            } else if (roomOf.get(key) !== roomOf.get(neighbour)) {
              // Room/corridor seam: exactly one blocker, wall OR door.
              if (wall + door !== 1) problems.push(`seam ${seam}: ${wall}w ${door}d`);
            } else {
              // Open floor: nothing may block it.
              if (wall + door !== 0) problems.push(`open ${seam}: ${wall}w ${door}d`);
            }
          }
        }

        expect({ seed, problems }).toEqual({ seed, problems: [] });
      }
    },
  );

  it("emits no zero-length or duplicate wall", () => {
    for (const seed of SEEDS) {
      const output = outputFor(seed);
      const spans = new Set<string>();
      for (const element of output.elements) {
        if (element.type !== "wall") continue;
        const [a, b] = element.data.points as [{ x: number; y: number }, { x: number; y: number }];

        expect({ seed, degenerate: a.x === b.x && a.y === b.y }).toEqual({
          seed,
          degenerate: false,
        });
        spans.add(`${a.x},${a.y}->${b.x},${b.y}`);
      }
      const wallCount = output.elements.filter((e) => e.type === "wall").length;
      expect({ seed, unique: spans.size }).toEqual({ seed, unique: wallCount });
    }
  });

  it("merges collinear edges instead of emitting one wall per cell", () => {
    const output = outputFor(1);
    const walls = output.elements.filter((e) => e.type === "wall");
    const longest = Math.max(
      ...walls.map((wall) => {
        const [a, b] = wall.data.points as [{ x: number; y: number }, { x: number; y: number }];
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      }),
    );

    // A merged run spans several cells; unmerged output would cap at one.
    expect(longest).toBeGreaterThan(grid().size);
  });
});

describe("emitGeometry — units", () => {
  it("lands every wall endpoint on the cell-corner lattice of an asymmetric grid", () => {
    // Asymmetric on purpose: equal offsets would hide an x/y swap, and the
    // default grid (size 50, offset 0) hides offsets entirely.
    const ctx = context({ grid: grid({ size: 64, offsetX: 13, offsetY: 7 }) });
    for (const seed of SEEDS) {
      const output = outputFor(seed, PARAMS, ctx);
      for (const element of output.elements) {
        if (element.type !== "wall") continue;
        for (const point of element.data.points) {
          expect((point.x - 13) % 64).toBe(0);
          expect((point.y - 7) % 64).toBe(0);
        }
      }
    }
  });

  it("puts a door on its seam with the width and rotation the compiler expects", () => {
    const ctx = context({ grid: grid({ size: 64, offsetX: 13, offsetY: 7 }) });
    const output = outputFor(1, PARAMS, ctx);
    const doors = output.elements.filter((e) => e.type === "door");

    expect(doors.length).toBeGreaterThan(0);
    for (const door of doors) {
      expect(door.data.width).toBe(64);
      expect([0, 90]).toContain(door.transform.rotation);
      // On the corner lattice, like the walls it interrupts.
      expect((door.transform.x - 13) % 64).toBe(0);
      expect((door.transform.y - 7) % 64).toBe(0);
      expect(door.transform.scaleX).toBe(1);
      expect(door.transform.scaleY).toBe(1);
    }
  });

  it("offsets floor and wall-halo cells into document space by the region origin", () => {
    const output = outputFor(1);
    const floors = output.cells.filter((cell) => cell.assetId === "terrain:stone-floor");
    const walls = output.cells.filter((cell) => cell.assetId === "terrain:wall-stone");

    expect(floors.length).toBeGreaterThan(0);
    expect(walls.length).toBeGreaterThan(0);
    expect(floors.length + walls.length).toBe(output.cells.length);
    for (const cell of floors) {
      expect(cell.x).toBeGreaterThanOrEqual(BOUNDS.x);
      expect(cell.x).toBeLessThan(BOUNDS.x + BOUNDS.cols);
      expect(cell.y).toBeGreaterThanOrEqual(BOUNDS.y);
      expect(cell.y).toBeLessThan(BOUNDS.y + BOUNDS.rows);
    }
    // The halo may extend one cell past the region where floor touches its rim.
    for (const cell of walls) {
      expect(cell.x).toBeGreaterThanOrEqual(BOUNDS.x - 1);
      expect(cell.x).toBeLessThan(BOUNDS.x + BOUNDS.cols + 1);
      expect(cell.y).toBeGreaterThanOrEqual(BOUNDS.y - 1);
      expect(cell.y).toBeLessThan(BOUNDS.y + BOUNDS.rows + 1);
    }
  });

  it("the wall halo hugs the floor: every wall cell 8-touches floor, every floor edge is banded", () => {
    const output = outputFor(1);
    const floorKeys = new Set(
      output.cells
        .filter((c) => c.assetId === "terrain:stone-floor")
        .map((c) => `${c.x},${c.y}`),
    );
    const wallKeys = new Set(
      output.cells.filter((c) => c.assetId === "terrain:wall-stone").map((c) => `${c.x},${c.y}`),
    );
    const touches = (x: number, y: number, keys: Set<string>): boolean => {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx !== 0 || dy !== 0) && keys.has(`${x + dx},${y + dy}`)) return true;
        }
      }
      return false;
    };
    for (const key of wallKeys) {
      const [x, y] = key.split(",").map(Number) as [number, number];
      expect(touches(x, y, floorKeys), `wall ${key} touches no floor`).toBe(true);
    }
    // Completeness: every non-floor 8-neighbour of a floor cell is walled.
    for (const key of floorKeys) {
      const [x, y] = key.split(",").map(Number) as [number, number];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nk = `${x + dx},${y + dy}`;
          if ((dx !== 0 || dy !== 0) && !floorKeys.has(nk)) {
            expect(wallKeys.has(nk), `floor ${key} edge ${nk} unbanded`).toBe(true);
          }
        }
      }
    }
  });

  it("themes the floor and its wall halo", () => {
    const wood = outputFor(1, { ...PARAMS, theme: "wood" });

    expect(new Set(wood.cells.map((cell) => cell.assetId))).toEqual(
      new Set(["terrain:wood-floor", "terrain:wall-timber"]),
    );
  });
});

describe("emitGeometry — doors and layers", () => {
  it("authors every door CLOSED — never open, and never secret", () => {
    // Closed, because an authored-open door compiles to nothing blocking: a hole.
    // Never secret, because this recipe cannot hide one: a wall with floor on
    // both sides can only be a room/corridor seam, every honest seam group has
    // exactly one door, and mapTerrain hands players the floor plan — so a
    // doorless seam group IS a secret door, at 202/202 with no false positives.
    // See dungeonGeometry.emitDoors. Restoring them needs fog-aware terrain.
    for (const seed of SEEDS) {
      const output = outputFor(seed);
      let doors = 0;
      for (const element of output.elements) {
        if (element.type !== "door") continue;
        doors++;
        expect({ seed, state: element.data.state }).toEqual({ seed, state: "closed" });
        expect(element.data.blocksMovement).toBe(true);
        expect(element.data.blocksVision).toBe(true);
      }
      expect(doors).toBeGreaterThan(0);
    }
  });

  it("puts walls and doors on the resolved walls layer", () => {
    const ctx = context({
      layerIds: { walls: "walls-2", lighting: "lighting", notes: "notes", objects: "objects" },
    });
    const output = outputFor(1, PARAMS, ctx);

    expect(new Set(output.elements.map((e) => e.layerId))).toEqual(new Set(["walls-2"]));
  });

  it("mints ids from one kind-free counter so a secret door cannot be fingerprinted", () => {
    const output = outputFor(1);
    const ids = output.elements.map((e) => e.id);

    expect(ids).toEqual(ids.map((_, index) => `test:e${index}`));
  });

  it("targets an unlocked default walls layer", () => {
    expect(DEFAULT_MAP_LAYERS.find((layer) => layer.kind === "walls")?.locked).toBe(false);
  });
});

describe("dungeonRecipe — the determinism contract", () => {
  it("golden: seed 1 in a 24x20 region emits the pinned dungeon, byte for byte", () => {
    // THE determinism contract, and the foundation of Cartridge Codes: this
    // exact seed must produce this exact dungeon forever. Regenerating this
    // fixture is a CONTRACT CHANGE requiring owner sign-off — never a refactor.
    // The region is at the 20x20 floor's scale on purpose: a golden should pin a
    // dungeon a DM can actually generate (the old 16x12 one no longer is).
    const output = dungeonRecipe(
      1,
      { x: 4, y: 4, cols: 24, rows: 20 },
      { theme: "stone", density: "medium" },
      context({ idPrefix: "golden" }),
    );

    expect(output).toEqual(golden);
    // Guard the guard: a golden of a sealed box would pin the bug, not the
    // contract. This one is a real dungeon.
    expect(output.elements.filter((e) => e.type === "door").length).toBeGreaterThan(0);
  });

  it("is deterministic for a seed and varies across seeds", () => {
    const ctx = context();
    const a = dungeonRecipe(99, BOUNDS, PARAMS, ctx);
    const b = dungeonRecipe(99, BOUNDS, PARAMS, ctx);
    const other = dungeonRecipe(100, BOUNDS, PARAMS, ctx);

    expect(a).toEqual(b);
    expect(a).not.toEqual(other);
    expect(a.cells.length).toBeGreaterThan(0);
    expect(a.elements.length).toBeGreaterThan(0);
  });

  it("keeps the theme out of the layout — only the floor's asset changes", () => {
    // Theme is pure paint. If it leaked into a roll, picking wood would rebuild
    // the dungeon rather than redecorate it. (This replaced a secret-chance
    // variant of the same check: geometry has no RNG left to isolate, because no
    // generated door is secret — see emitDoors.)
    const ctx = context();
    const stone = dungeonRecipe(5, BOUNDS, { ...PARAMS, theme: "stone" }, ctx);
    const wood = dungeonRecipe(5, BOUNDS, { ...PARAMS, theme: "wood" }, ctx);

    expect(stone.cells.map((c) => `${c.x},${c.y}`)).toEqual(wood.cells.map((c) => `${c.x},${c.y}`));
    expect(stone.elements).toEqual(wood.elements);
  });
});
