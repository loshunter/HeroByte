import type { MapGridSettings } from "./mapStudioTypes.js";

export function sanitizeMapGrid(grid: MapGridSettings): MapGridSettings {
  if (!["square", "hex-row", "hex-column", "isometric"].includes(grid.type)) {
    throw new Error(`Unsupported grid type: ${String(grid.type)}`);
  }
  requirePositiveNumber(grid.size, "Grid size");
  requirePositiveNumber(grid.squareSize, "Grid square size");
  requireFiniteNumber(grid.offsetX, "Grid X offset");
  requireFiniteNumber(grid.offsetY, "Grid Y offset");
  return { ...grid };
}

function requirePositiveNumber(value: number, label: string): void {
  requireFiniteNumber(value, label);
  if (value <= 0) throw new Error(`${label} must be greater than zero`);
}

function requireFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number`);
}
