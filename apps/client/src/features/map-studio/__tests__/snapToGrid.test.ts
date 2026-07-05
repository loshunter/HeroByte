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

  describe("hex snapping", () => {
    const hexRow: MapGridSettings = { ...grid, type: "hex-row", offsetX: 0, offsetY: 0 };
    const hexColumn: MapGridSettings = { ...grid, type: "hex-column", offsetX: 0, offsetY: 0 };
    const h = Math.sqrt(3) * 50; // flat-top hex height for size 50

    it("snaps to the nearest flat-top hex center on hex-row grids", () => {
      // First drawn hex center sits at (size, h/2) = (50, 43.30).
      const first = snapPointToGrid({ x: 55, y: 40 }, hexRow);
      expect(first.x).toBeCloseTo(50, 5);
      expect(first.y).toBeCloseTo(h / 2, 5);

      // Next column is offset by 1.5*size horizontally and h/2 vertically.
      const second = snapPointToGrid({ x: 120, y: 80 }, hexRow);
      expect(second.x).toBeCloseTo(125, 5);
      expect(second.y).toBeCloseTo(h, 5);
    });

    it("snaps to the nearest pointy-top hex center on hex-column grids", () => {
      const w = Math.sqrt(3) * 50;
      const first = snapPointToGrid({ x: 40, y: 55 }, hexColumn);
      expect(first.x).toBeCloseTo(w / 2, 5);
      expect(first.y).toBeCloseTo(50, 5);

      const second = snapPointToGrid({ x: 90, y: 120 }, hexColumn);
      expect(second.x).toBeCloseTo(w, 5);
      expect(second.y).toBeCloseTo(125, 5);
    });

    it("honors grid offsets and the snap toggle on hex grids", () => {
      const offset = { ...hexRow, offsetX: 10, offsetY: 20 };
      const snapped = snapPointToGrid({ x: 65, y: 60 }, offset);
      expect(snapped.x).toBeCloseTo(60, 5);
      expect(snapped.y).toBeCloseTo(20 + h / 2, 5);

      expect(snapPointToGrid({ x: 65, y: 60 }, { ...offset, snap: false })).toEqual({
        x: 65,
        y: 60,
      });
    });

    it("is idempotent: snapping a snapped point returns it unchanged", () => {
      const once = snapPointToGrid({ x: 137, y: 91 }, hexRow);
      const twice = snapPointToGrid(once, hexRow);
      expect(twice.x).toBeCloseTo(once.x, 9);
      expect(twice.y).toBeCloseTo(once.y, 9);
    });
  });
});
