import type { MapGridSettings } from "@herobyte/shared";

export function snapCoordinateToGrid(value: number, offset: number, size: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(offset) || !Number.isFinite(size) || size <= 0) {
    return value;
  }
  return offset + Math.round((value - offset) / size) * size;
}

export function snapPointToGrid(
  point: { x: number; y: number },
  grid: MapGridSettings,
): { x: number; y: number } {
  if (!grid.snap) return point;
  return {
    x: snapCoordinateToGrid(point.x, grid.offsetX, grid.size),
    y: snapCoordinateToGrid(point.y, grid.offsetY, grid.size),
  };
}

export function mapKeyboardNudgeStep(grid: MapGridSettings, shiftKey: boolean): number {
  if (grid.snap) return grid.size;
  return shiftKey ? 10 : 1;
}
