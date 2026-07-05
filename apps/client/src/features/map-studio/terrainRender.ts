import type { TerrainMap } from "@herobyte/shared";
import { forEachTerrainCell } from "@herobyte/shared";
import type { AutotileGrid, TileOccupancy } from "./tileAutotiling";

export interface TerrainRenderLayer {
  assetId: string;
  /** One path covering every painted cell of this family. */
  fillPath: string;
  /** Borders only where a cell faces a different family (or nothing). */
  boundaryPath: string;
}

/**
 * Collapse painted terrain into one fill path and one boundary path per
 * terrain family — thousands of cells become a handful of SVG nodes, shared
 * by the live canvas and the export so both render identically. Boundary
 * checks run against the combined occupancy (terrain + tile elements), so
 * paint fuses with legacy same-family tiles and vice versa.
 */
export function buildTerrainRenderLayers(
  terrain: TerrainMap,
  grid: AutotileGrid,
  occupancy: TileOccupancy,
): TerrainRenderLayer[] {
  const size = grid.size;
  const fills = new Map<string, string[]>();
  const boundaries = new Map<string, string[]>();

  forEachTerrainCell(terrain, (cellX, cellY, assetId) => {
    // A tile element stacked on this cell owns it — skip double-painting.
    if (occupancy.get(`${cellX},${cellY}`) !== assetId) return;
    const left = grid.offsetX + cellX * size;
    const top = grid.offsetY + cellY * size;
    const fill = fills.get(assetId) ?? [];
    if (fill.length === 0) fills.set(assetId, fill);
    fill.push(`M ${left} ${top} h ${size} v ${size} h ${-size} Z`);

    const differs = (x: number, y: number) => occupancy.get(`${x},${y}`) !== assetId;
    const boundary = boundaries.get(assetId) ?? [];
    if (boundary.length === 0) boundaries.set(assetId, boundary);
    if (differs(cellX, cellY - 1)) boundary.push(`M ${left} ${top} H ${left + size}`);
    if (differs(cellX, cellY + 1)) boundary.push(`M ${left} ${top + size} H ${left + size}`);
    if (differs(cellX - 1, cellY)) boundary.push(`M ${left} ${top} V ${top + size}`);
    if (differs(cellX + 1, cellY)) boundary.push(`M ${left + size} ${top} V ${top + size}`);
  });

  return [...fills.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((assetId) => ({
      assetId,
      fillPath: fills.get(assetId)!.join(" "),
      boundaryPath: (boundaries.get(assetId) ?? []).join(" "),
    }));
}
