import { describe, it, expect } from "vitest";
import type { MapGridSettings, MapLayer } from "@herobyte/shared";
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
