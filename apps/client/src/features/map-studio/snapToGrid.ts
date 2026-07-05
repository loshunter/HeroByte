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
  if (grid.type === "hex-row" || grid.type === "hex-column") {
    return snapPointToHexCenter(point, grid);
  }
  return {
    x: snapCoordinateToGrid(point.x, grid.offsetX, grid.size),
    y: snapCoordinateToGrid(point.y, grid.offsetY, grid.size),
  };
}

/**
 * Snap to the nearest hex CENTER of the drawn grid pattern. hex-row draws
 * flat-top hexes (first center at offset + (size, sqrt(3)*size/2)); hex-column
 * draws pointy-top (first center at offset + (sqrt(3)*size/2, size)). Points
 * convert to fractional axial coordinates, round via cube coordinates, and
 * convert back — the standard nearest-hex algorithm.
 */
function snapPointToHexCenter(
  point: { x: number; y: number },
  grid: MapGridSettings,
): { x: number; y: number } {
  const size = grid.size;
  const flatTop = grid.type === "hex-row";
  const baseX = flatTop ? size : (Math.sqrt(3) * size) / 2;
  const baseY = flatTop ? (Math.sqrt(3) * size) / 2 : size;
  const localX = point.x - grid.offsetX - baseX;
  const localY = point.y - grid.offsetY - baseY;

  const fractionalQ = flatTop
    ? ((2 / 3) * localX) / size
    : ((Math.sqrt(3) / 3) * localX - (1 / 3) * localY) / size;
  const fractionalR = flatTop
    ? ((-1 / 3) * localX + (Math.sqrt(3) / 3) * localY) / size
    : ((2 / 3) * localY) / size;
  const [q, r] = roundAxial(fractionalQ, fractionalR);

  const snappedX = flatTop ? size * 1.5 * q : size * Math.sqrt(3) * (q + r / 2);
  const snappedY = flatTop ? size * Math.sqrt(3) * (r + q / 2) : size * 1.5 * r;
  return { x: snappedX + grid.offsetX + baseX, y: snappedY + grid.offsetY + baseY };
}

/** Round fractional axial coordinates to the containing hex (cube rounding). */
function roundAxial(q: number, r: number): [number, number] {
  const s = -q - r;
  let roundedQ = Math.round(q);
  let roundedR = Math.round(r);
  const roundedS = Math.round(s);
  const deltaQ = Math.abs(roundedQ - q);
  const deltaR = Math.abs(roundedR - r);
  const deltaS = Math.abs(roundedS - s);
  if (deltaQ > deltaR && deltaQ > deltaS) {
    roundedQ = -roundedR - roundedS;
  } else if (deltaR > deltaS) {
    roundedR = -roundedQ - roundedS;
  }
  return [roundedQ, roundedR];
}

export function mapKeyboardNudgeStep(grid: MapGridSettings, shiftKey: boolean): number {
  if (grid.snap) return grid.size;
  return shiftKey ? 10 : 1;
}
