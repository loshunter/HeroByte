import { MAX_TERRAIN_CELL_MAGNITUDE, type MapDocument } from "@herobyte/shared";

export const TERRAIN_BRUSH_SIZES = [1, 3, 5] as const;
export type TerrainBrushSize = (typeof TERRAIN_BRUSH_SIZES)[number];
export const MAX_TERRAIN_STROKE_CELLS = 16384;
type Point = { x: number; y: number };
type DocumentGrid = Pick<MapDocument, "width" | "height" | "grid">;
type Bounds = { minX: number; maxX: number; minY: number; maxY: number };
const radiusOf = (size: TerrainBrushSize) => (size === 5 ? 2 : size === 3 ? 1 : 0);

/** Normalize only rounding-sized deviations at a representable cell boundary.
 * Containment stays in cell units: a pixel epsilon would admit partial cells on
 * arbitrarily tiny grids. Edges beyond the protocol range are clamped separately.
 */
function stableGridEdge(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_TERRAIN_CELL_MAGNITUDE + 1) return value;
  const integer = Math.round(value);
  const tolerance = 4 * Number.EPSILON * Math.max(1, Math.abs(value));
  return Math.abs(value - integer) <= tolerance ? integer : value;
}

/** Fully contained cells, also bounded by the existing command coordinate limit. */
function boundsOf(document: DocumentGrid): Bounds | null {
  const { size, offsetX, offsetY } = document.grid;
  if (
    ![size, offsetX, offsetY, document.width, document.height].every(Number.isFinite) ||
    size <= 0
  )
    return null;
  const limit = MAX_TERRAIN_CELL_MAGNITUDE;
  const bounds = {
    minX: Math.max(-limit, Math.ceil(stableGridEdge(-offsetX / size))),
    maxX: Math.min(limit, Math.floor(stableGridEdge((document.width - offsetX) / size)) - 1),
    minY: Math.max(-limit, Math.ceil(stableGridEdge(-offsetY / size))),
    maxY: Math.min(limit, Math.floor(stableGridEdge((document.height - offsetY) / size)) - 1),
  };
  return bounds.minX <= bounds.maxX && bounds.minY <= bounds.maxY ? bounds : null;
}

function footprintAt(center: Point, radius: number, bounds: Bounds): Point[] {
  const result: Point[] = [];
  for (
    let y = Math.max(bounds.minY, center.y - radius);
    y <= Math.min(bounds.maxY, center.y + radius);
    y++
  ) {
    for (
      let x = Math.max(bounds.minX, center.x - radius);
      x <= Math.min(bounds.maxX, center.x + radius);
      x++
    ) {
      result.push({ x: x + 0, y: y + 0 }); // Canonicalize negative zero at grid origin.
    }
  }
  return result;
}

export function terrainBrushFootprint(
  document: DocumentGrid,
  point: Point,
  brushSize: TerrainBrushSize,
): Point[] {
  const bounds = boundsOf(document);
  if (!bounds || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return [];
  const { size, offsetX, offsetY } = document.grid;
  const center = {
    x: Math.floor(stableGridEdge((point.x - offsetX) / size)),
    y: Math.floor(stableGridEdge((point.y - offsetY) / size)),
  };
  if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) return [];
  return footprintAt(center, radiusOf(brushSize), bounds);
}

/** Clip in document pixels BEFORE division: imported grids have no positive size floor. */
function clip(from: Point, to: Point, bounds: Bounds): [Point, Point] | null {
  const dx = to.x - from.x,
    dy = to.y - from.y;
  if (![from.x, from.y, to.x, to.y, dx, dy].every(Number.isFinite)) return null;
  let enter = 0,
    leave = 1;
  for (const [p, q] of [
    [-dx, from.x - bounds.minX],
    [dx, bounds.maxX - from.x],
    [-dy, from.y - bounds.minY],
    [dy, bounds.maxY - from.y],
  ]) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) enter = Math.max(enter, t);
    else leave = Math.min(leave, t);
    if (enter > leave) return null;
  }
  return [
    { x: from.x + dx * enter, y: from.y + dy * enter },
    { x: from.x + dx * leave, y: from.y + dy * leave },
  ];
}

/** Cells crossed by the actual pointer segment, stamping one odd square at each.
 * Exact corner-only contact advances both axes; it does not paint the two side
 * cells touched only at a point. The consumer dedupes and stops at the stroke cap.
 */
export function* terrainBrushPath(
  document: DocumentGrid,
  from: Point,
  to: Point,
  brushSize: TerrainBrushSize,
): Generator<Point> {
  const bounds = boundsOf(document);
  if (!bounds) return;
  const radius = radiusOf(brushSize);
  const { size, offsetX, offsetY } = document.grid;
  const clipped = clip(from, to, {
    minX: (bounds.minX - radius) * size + offsetX,
    maxX: (bounds.maxX + radius + 1) * size + offsetX,
    minY: (bounds.minY - radius) * size + offsetY,
    maxY: (bounds.maxY + radius + 1) * size + offsetY,
  });
  if (!clipped) return;
  // Clamp rounding at clipped edges so even a far-away endpoint stays bounded.
  const gridPoint = (p: Point): Point => ({
    x: Math.max(
      bounds.minX - radius,
      Math.min(bounds.maxX + radius + 1, stableGridEdge((p.x - offsetX) / size)),
    ),
    y: Math.max(
      bounds.minY - radius,
      Math.min(bounds.maxY + radius + 1, stableGridEdge((p.y - offsetY) / size)),
    ),
  });
  const a = gridPoint(clipped[0]),
    b = gridPoint(clipped[1]);
  if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return;
  let x = Math.floor(a.x),
    y = Math.floor(a.y);
  const endX = Math.floor(b.x),
    endY = Math.floor(b.y);
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const stepX = Math.sign(dx),
    stepY = Math.sign(dy);
  const deltaX = dx ? 1 / Math.abs(dx) : Infinity;
  const deltaY = dy ? 1 / Math.abs(dy) : Infinity;
  let crossX = dx ? (stepX > 0 ? x + 1 - a.x : a.x - x) * deltaX : Infinity;
  let crossY = dy ? (stepY > 0 ? y + 1 - a.y : a.y - y) * deltaY : Infinity;
  const visits = Math.abs(endX - x) + Math.abs(endY - y) + 1;
  for (let i = 0; i < visits; i++) {
    yield* footprintAt({ x, y }, radius, bounds);
    if (x === endX && y === endY) return;
    if (crossX < crossY) {
      x += stepX;
      crossX += deltaX;
    } else if (crossY < crossX) {
      y += stepY;
      crossY += deltaY;
    } else {
      x += stepX;
      y += stepY;
      crossX += deltaX;
      crossY += deltaY;
    }
  }
}
