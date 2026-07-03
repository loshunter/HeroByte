import type { MapDocument, MapElement, MapGridSettings } from "@herobyte/shared";

// ---------------------------------------------------------------------------
// Terrain boundary autotiling: same-terrain tiles fuse into one surface,
// with borders drawn only where a cell faces different (or no) terrain.
// Shared by the SVG export and the live editing canvases so painted terrain
// looks identical while editing and after publish.
//
// Only tiles sitting exactly on the document's grid lattice (size + offsets)
// participate: an off-lattice tile (snap turned off, hand-edited import)
// cannot be binned to a cell without lying about its position, so it opts
// out and renders as an outlined island instead.
// ---------------------------------------------------------------------------

/** The slice of grid settings autotiling depends on. */
export type AutotileGrid = Pick<MapGridSettings, "size" | "offsetX" | "offsetY">;

/** Grid-cell "x,y" -> assetId for every lattice-aligned, untransformed tile. */
export type TileOccupancy = Map<string, string>;

/** Tolerance for lattice alignment, in cells (0.001 cell = 0.05px at size 50). */
const LATTICE_EPSILON = 1e-3;

/** The tile's cell index along one axis, or null when it is off-lattice. */
function cellIndex(value: number, offset: number, size: number): number | null {
  const cells = (value - offset) / size;
  const rounded = Math.round(cells);
  return Math.abs(cells - rounded) <= LATTICE_EPSILON ? rounded : null;
}

export function buildTileOccupancy(document: MapDocument): TileOccupancy {
  const occupancy: TileOccupancy = new Map();
  const grid = document.grid;
  for (const element of document.elements) {
    if (!isAutotileCandidate(element, grid)) continue;
    const baseX = cellIndex(element.transform.x, grid.offsetX, grid.size)!;
    const baseY = cellIndex(element.transform.y, grid.offsetY, grid.size)!;
    for (let column = 0; column < element.data.columns; column += 1) {
      for (let row = 0; row < element.data.rows; row += 1) {
        occupancy.set(`${baseX + column},${baseY + row}`, element.data.assetId);
      }
    }
  }
  return occupancy;
}

export function isAutotileCandidate(
  element: MapElement,
  grid: AutotileGrid,
): element is Extract<MapElement, { type: "tile" }> {
  return (
    element.type === "tile" &&
    !element.hidden &&
    element.transform.rotation === 0 &&
    element.transform.scaleX === 1 &&
    element.transform.scaleY === 1 &&
    cellIndex(element.transform.x, grid.offsetX, grid.size) !== null &&
    cellIndex(element.transform.y, grid.offsetY, grid.size) !== null
  );
}

/**
 * Border path (element-local coordinates) covering only the edges where the
 * tile's cells face a different terrain family.
 */
export function tileBoundaryPath(
  element: Extract<MapElement, { type: "tile" }>,
  grid: AutotileGrid,
  occupancy: TileOccupancy,
): string {
  const gridSize = grid.size;
  const baseX =
    cellIndex(element.transform.x, grid.offsetX, gridSize) ??
    Math.round((element.transform.x - grid.offsetX) / gridSize);
  const baseY =
    cellIndex(element.transform.y, grid.offsetY, gridSize) ??
    Math.round((element.transform.y - grid.offsetY) / gridSize);
  const family = element.data.assetId;
  const differs = (cellX: number, cellY: number) => occupancy.get(`${cellX},${cellY}`) !== family;

  const segments: string[] = [];
  for (let column = 0; column < element.data.columns; column += 1) {
    for (let row = 0; row < element.data.rows; row += 1) {
      const cellX = baseX + column;
      const cellY = baseY + row;
      const left = column * gridSize;
      const top = row * gridSize;
      const right = left + gridSize;
      const bottom = top + gridSize;
      if (differs(cellX, cellY - 1)) segments.push(`M ${left} ${top} H ${right}`);
      if (differs(cellX, cellY + 1)) segments.push(`M ${left} ${bottom} H ${right}`);
      if (differs(cellX - 1, cellY)) segments.push(`M ${left} ${top} V ${bottom}`);
      if (differs(cellX + 1, cellY)) segments.push(`M ${right} ${top} V ${bottom}`);
    }
  }
  return segments.join(" ");
}
