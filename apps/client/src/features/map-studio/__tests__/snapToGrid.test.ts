import { describe, expect, it } from "vitest";
import type { MapGridSettings } from "@herobyte/shared";
import { mapKeyboardNudgeStep, snapCoordinateToGrid, snapPointToGrid } from "../snapToGrid";

const grid: MapGridSettings = {
  type: "square",
  size: 50,
  squareSize: 5,
  offsetX: 10,
  offsetY: 20,
  visible: true,
  snap: true,
};

describe("snapToGrid", () => {
  it("snaps coordinates relative to the configured grid offset", () => {
    expect(snapCoordinateToGrid(86, grid.offsetX, grid.size)).toBe(110);
    expect(snapCoordinateToGrid(84, grid.offsetX, grid.size)).toBe(60);
  });

  it("returns unsnapped points when snapping is disabled", () => {
    expect(snapPointToGrid({ x: 86, y: 84 }, { ...grid, snap: false })).toEqual({
      x: 86,
      y: 84,
    });
  });

  it("uses grid-sized keyboard nudges when snapping is enabled", () => {
    expect(mapKeyboardNudgeStep(grid, false)).toBe(50);
    expect(mapKeyboardNudgeStep({ ...grid, snap: false }, false)).toBe(1);
    expect(mapKeyboardNudgeStep({ ...grid, snap: false }, true)).toBe(10);
  });
});
