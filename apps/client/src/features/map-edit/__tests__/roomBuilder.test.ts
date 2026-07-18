import { describe, it, expect } from "vitest";
import type { MapGridSettings, MapLayer } from "@herobyte/shared";
import { createTerrainMap, setTerrainCells } from "@herobyte/shared";
import { buildRoomCommand, MAX_ROOM_CELLS } from "../roomBuilder";

const grid: MapGridSettings = {
  type: "square",
  size: 50,
  squareSize: 5,
  offsetX: 0,
  offsetY: 0,
  visible: true,
  snap: true,
};

function wallsLayers(): Map<string, MapLayer> {
  const walls: MapLayer = {
    id: "walls",
    name: "Walls",
    kind: "walls",
    visible: true,
    locked: false,
    opacity: 1,
    zIndex: 30,
  };
  return new Map([[walls.id, walls]]);
}

describe("buildRoomCommand", () => {
  it("builds floor cells + a 5-point closed perimeter for a known rect", () => {
    const result = buildRoomCommand(
      { x: 100, y: 50, width: 150, height: 100 },
      "wood-floor",
      grid,
      wallsLayers(),
    );

    expect(result.error).toBeNull();
    const { cells, elements } = result.command!;
    // 3 cols × 2 rows starting at cell (2,1).
    expect(cells).toEqual([
      { x: 2, y: 1, assetId: "terrain:wood-floor" },
      { x: 3, y: 1, assetId: "terrain:wood-floor" },
      { x: 4, y: 1, assetId: "terrain:wood-floor" },
      { x: 2, y: 2, assetId: "terrain:wood-floor" },
      { x: 3, y: 2, assetId: "terrain:wood-floor" },
      { x: 4, y: 2, assetId: "terrain:wood-floor" },
    ]);
    expect(elements).toHaveLength(1);
    const wall = elements[0]!;
    expect(wall.layerId).toBe("walls");
    expect(wall.type).toBe("wall");
    expect(wall.transform).toEqual({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 });
    expect(wall.data.points).toEqual([
      { x: 100, y: 50 },
      { x: 250, y: 50 },
      { x: 250, y: 150 },
      { x: 100, y: 150 },
      { x: 100, y: 50 },
    ]);
  });

  it("builds a 1×1 room from a single-cell bounds", () => {
    const result = buildRoomCommand(
      { x: 0, y: 0, width: 50, height: 50 },
      "grass",
      grid,
      wallsLayers(),
    );
    expect(result.command?.cells).toEqual([{ x: 0, y: 0, assetId: "terrain:grass" }]);
    expect(result.command?.elements[0]!.data.points).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 0, y: 50 },
      { x: 0, y: 0 },
    ]);
  });

  it("refuses a room over the cell cap", () => {
    // 200 × 100 = 20000 cells > 16384.
    const result = buildRoomCommand(
      { x: 0, y: 0, width: 50 * 200, height: 50 * 100 },
      "stone-floor",
      grid,
      wallsLayers(),
    );
    expect(result.command).toBeNull();
    expect(result.error).toContain(String(MAX_ROOM_CELLS));
  });

  it("adds a one-cell wall ring around the floor when a wall family is chosen", () => {
    const result = buildRoomCommand(
      { x: 50, y: 50, width: 100, height: 50 },
      "wood-floor",
      grid,
      wallsLayers(),
      { wallFamily: "wall-stone", terrain: null },
    );
    expect(result.error).toBeNull();
    const cells = result.command!.cells;
    const floors = cells.filter((c) => c.assetId === "terrain:wood-floor");
    const walls = cells.filter((c) => c.assetId === "terrain:wall-stone");
    // 2×1 floor at (1,1)-(2,1); ring is the surrounding 4×3 band = 10 cells.
    expect(floors).toHaveLength(2);
    expect(walls).toHaveLength(10);
    // Ring cells surround the floor exactly (no overlap, no gaps).
    const wallKeys = new Set(walls.map((c) => `${c.x},${c.y}`));
    expect(wallKeys.size).toBe(10);
    for (const c of floors) expect(wallKeys.has(`${c.x},${c.y}`)).toBe(false);
    expect(wallKeys.has("0,0")).toBe(true); // corner
    expect(wallKeys.has("3,2")).toBe(true); // opposite corner
    expect(wallKeys.has("1,0")).toBe(true); // top edge over the floor
    // The blocking perimeter polyline is unchanged by the ring.
    expect(result.command!.elements[0]!.data.points).toEqual([
      { x: 50, y: 50 },
      { x: 150, y: 50 },
      { x: 150, y: 100 },
      { x: 50, y: 100 },
      { x: 50, y: 50 },
    ]);
  });

  it("the ring never overwrites a neighbouring room's laid interior floor", () => {
    // An existing wood-floor room interior sits directly left of the new room.
    const terrain = setTerrainCells(createTerrainMap(), [
      { x: 0, y: 1, assetId: "terrain:wood-floor" },
      // Natural ground and an existing wall band ARE overwritable.
      { x: 0, y: 0, assetId: "terrain:grass" },
      { x: 0, y: 2, assetId: "terrain:wall-brick" },
    ]);
    const result = buildRoomCommand(
      { x: 50, y: 50, width: 50, height: 50 },
      "stone-floor",
      grid,
      wallsLayers(),
      { wallFamily: "wall-stone", terrain },
    );
    const walls = result.command!.cells.filter((c) => c.assetId === "terrain:wall-stone");
    const wallKeys = new Set(walls.map((c) => `${c.x},${c.y}`));
    expect(wallKeys.has("0,1")).toBe(false); // protected interior floor
    expect(wallKeys.has("0,0")).toBe(true); // grass is walled over
    expect(wallKeys.has("0,2")).toBe(true); // wall-over-wall fuses the band
    expect(walls).toHaveLength(7); // 8-cell ring minus the protected cell
  });

  it("counts the ring against the cell cap", () => {
    // A 127×127 floor fits the cap, but its 129×129 with-ring footprint exceeds it.
    const result = buildRoomCommand(
      { x: 0, y: 0, width: 50 * 127, height: 50 * 127 },
      "stone-floor",
      grid,
      wallsLayers(),
      { wallFamily: "wall-dark", terrain: null },
    );
    expect(result.command).toBeNull();
    expect(result.error).toContain(String(MAX_ROOM_CELLS));
  });

  it("refuses when there is no walls layer to hold the perimeter", () => {
    const layers = new Map<string, MapLayer>([
      [
        "objects",
        {
          id: "objects",
          name: "Objects",
          kind: "objects",
          visible: true,
          locked: false,
          opacity: 1,
          zIndex: 20,
        },
      ],
    ]);
    const result = buildRoomCommand({ x: 0, y: 0, width: 50, height: 50 }, "path", grid, layers);
    expect(result.command).toBeNull();
    expect(result.error).toBeTruthy();
  });
});
