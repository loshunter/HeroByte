import { describe, it, expect } from "vitest";
import type { MapGridSettings, MapLayer } from "@herobyte/shared";
import { buildHallwayCommand, hallwayBoundsFromDrag } from "../hallwayBuilder";

const grid: MapGridSettings = {
  type: "square",
  size: 50,
  squareSize: 5,
  offsetX: 0,
  offsetY: 0,
  visible: true,
  snap: true,
};

function wallLayers(): Map<string, MapLayer> {
  return new Map([
    [
      "walls",
      {
        id: "walls",
        name: "Walls",
        kind: "walls",
        visible: true,
        locked: false,
        opacity: 1,
        zIndex: 30,
      },
    ],
  ]);
}

describe("buildHallwayCommand", () => {
  it("builds a horizontal 2-wide corridor: floor band + two long-side walls, open ends", () => {
    const { command, bounds, error } = buildHallwayCommand(
      { start: { x: 100, y: 100 }, end: { x: 300, y: 100 } },
      "path",
      2,
      grid,
      wallLayers(),
    );
    expect(error).toBeNull();
    // 5 cells long × 2 wide = 10 floor cells; band rows 2,3.
    expect(command!.cells).toHaveLength(10);
    expect(command!.cells[0]).toEqual({ x: 2, y: 2, assetId: "terrain:path" });
    expect(command!.cells).toContainEqual({ x: 6, y: 3, assetId: "terrain:path" });
    // Two walls only (the long sides); the ends stay open.
    expect(command!.elements).toHaveLength(2);
    expect(command!.elements[0]!.data.points).toEqual([
      { x: 100, y: 100 },
      { x: 350, y: 100 },
    ]);
    expect(command!.elements[1]!.data.points).toEqual([
      { x: 100, y: 200 },
      { x: 350, y: 200 },
    ]);
    expect(bounds).toEqual({ x: 100, y: 100, width: 250, height: 100 });
  });

  it("builds a vertical corridor when the drag is taller than wide (walls on left/right)", () => {
    const { command, bounds } = buildHallwayCommand(
      { start: { x: 100, y: 100 }, end: { x: 100, y: 300 } },
      "stone-floor",
      2,
      grid,
      wallLayers(),
    );
    expect(command!.cells).toContainEqual({ x: 2, y: 2, assetId: "terrain:stone-floor" });
    expect(command!.cells).toContainEqual({ x: 3, y: 6, assetId: "terrain:stone-floor" });
    // Vertical long sides at x=100 and x=200, spanning y 100..350.
    expect(command!.elements[0]!.data.points).toEqual([
      { x: 100, y: 100 },
      { x: 100, y: 350 },
    ]);
    expect(command!.elements[1]!.data.points).toEqual([
      { x: 200, y: 100 },
      { x: 200, y: 350 },
    ]);
    expect(bounds).toEqual({ x: 100, y: 100, width: 100, height: 250 });
  });

  it("honors a 1-cell width", () => {
    const { command, bounds } = buildHallwayCommand(
      { start: { x: 100, y: 100 }, end: { x: 250, y: 100 } },
      "dirt",
      1,
      grid,
      wallLayers(),
    );
    expect(bounds!.height).toBe(50); // one cell tall
    expect(command!.cells.every((c) => c.y === 2)).toBe(true);
  });

  it("clamps out-of-range widths into [1,4]", () => {
    const wide = buildHallwayCommand(
      { start: { x: 100, y: 100 }, end: { x: 250, y: 100 } },
      "grass",
      9,
      grid,
      wallLayers(),
    );
    expect(wide.bounds!.height).toBe(200); // clamped to 4 cells
  });

  it("refuses when there is no walls layer", () => {
    const { command, error } = buildHallwayCommand(
      { start: { x: 100, y: 100 }, end: { x: 300, y: 100 } },
      "grass",
      2,
      grid,
      new Map(),
    );
    expect(command).toBeNull();
    expect(error).toMatch(/walls layer/i);
  });
});

describe("hallwayBoundsFromDrag", () => {
  it("matches the command's bounds (shared geometry — preview aligns with placement)", () => {
    const drag = { start: { x: 100, y: 100 }, end: { x: 300, y: 100 } };
    const previewBounds = hallwayBoundsFromDrag(drag, 2, grid);
    const { bounds } = buildHallwayCommand(drag, "grass", 2, grid, wallLayers());
    expect(previewBounds).toEqual(bounds);
  });
});
