import type { MapDocument, MapElement } from "@herobyte/shared";

// ---------------------------------------------------------------------------
// Terrain boundary autotiling: same-terrain tiles fuse into one surface,
// with borders drawn only where a cell faces different (or no) terrain.
// Shared by the SVG export and the live editing canvases so painted terrain
// looks identical while editing and after publish.
// ---------------------------------------------------------------------------

/** Grid-cell "x,y" -> assetId for every axis-aligned, untransformed tile. */
export type TileOccupancy = Map<string, string>;

export function buildTileOccupancy(document: MapDocument): TileOccupancy {
  const occupancy: TileOccupancy = new Map();
  const gridSize = document.grid.size;
  for (const element of document.elements) {
    if (!isAutotileCandidate(element)) continue;
    const baseX = Math.round(element.transform.x / gridSize);
    const baseY = Math.round(element.transform.y / gridSize);
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
): element is Extract<MapElement, { type: "tile" }> {
  return (
    element.type === "tile" &&
    !element.hidden &&
    element.transform.rotation === 0 &&
    element.transform.scaleX === 1 &&
    element.transform.scaleY === 1
  );
}

/**
 * Border path (element-local coordinates) covering only the edges where the
 * tile's cells face a different terrain family.
 */
export function tileBoundaryPath(
  element: Extract<MapElement, { type: "tile" }>,
  gridSize: number,
  occupancy: TileOccupancy,
): string {
  const baseX = Math.round(element.transform.x / gridSize);
  const baseY = Math.round(element.transform.y / gridSize);
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
