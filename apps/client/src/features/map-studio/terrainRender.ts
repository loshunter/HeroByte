import type { TerrainMap } from "@herobyte/shared";
import { forEachTerrainCell } from "@herobyte/shared";
import type {
  StructuredTerrainLayer,
  TerrainBoundaryEdge,
  TerrainCellRect,
} from "../render/tileRenderCore";
import type { AutotileGrid, TileOccupancy } from "./tileAutotiling";

export interface TerrainRenderLayer {
  assetId: string;
  /** One path covering every painted cell of this family. */
  fillPath: string;
  /** Borders only where a cell faces a different family (or nothing). */
  boundaryPath: string;
}

/**
 * Collapse painted terrain into per-family cell rectangles and boundary
 * edges, in pixels — the single source of terrain geometry, consumed by the
 * canvas renderer directly and by the SVG adapter below so every surface
 * renders identically. Boundary checks run against the combined occupancy
 * (terrain + tile elements), so paint fuses with legacy same-family tiles
 * and vice versa.
 */
export function buildStructuredTerrainLayers(
  terrain: TerrainMap,
  grid: AutotileGrid,
  occupancy: TileOccupancy,
): StructuredTerrainLayer[] {
  const size = grid.size;
  const cells = new Map<string, TerrainCellRect[]>();
  const edges = new Map<string, TerrainBoundaryEdge[]>();

  forEachTerrainCell(terrain, (cellX, cellY, assetId) => {
    // A tile element stacked on this cell owns it — skip double-painting.
    if (occupancy.get(`${cellX},${cellY}`) !== assetId) return;
    const left = grid.offsetX + cellX * size;
    const top = grid.offsetY + cellY * size;
    const right = left + size;
    const bottom = top + size;
    const familyCells = cells.get(assetId) ?? [];
    if (familyCells.length === 0) cells.set(assetId, familyCells);
    familyCells.push({ x: left, y: top, size });

    const differs = (x: number, y: number) => occupancy.get(`${x},${y}`) !== assetId;
    const familyEdges = edges.get(assetId) ?? [];
    if (familyEdges.length === 0) edges.set(assetId, familyEdges);
    // Emit order (top, bottom, left, right) and each edge's explicit
    // orientation are part of the export contract — orientation must not be
    // re-derived from coordinates (float absorption can collapse an edge).
    if (differs(cellX, cellY - 1))
      familyEdges.push({ orientation: "h", x1: left, y1: top, x2: right, y2: top });
    if (differs(cellX, cellY + 1))
      familyEdges.push({ orientation: "h", x1: left, y1: bottom, x2: right, y2: bottom });
    if (differs(cellX - 1, cellY))
      familyEdges.push({ orientation: "v", x1: left, y1: top, x2: left, y2: bottom });
    if (differs(cellX + 1, cellY))
      familyEdges.push({ orientation: "v", x1: right, y1: top, x2: right, y2: bottom });
  });

  return [...cells.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((assetId) => ({
      assetId,
      cells: cells.get(assetId)!,
      edges: edges.get(assetId) ?? [],
    }));
}

/**
 * SVG adapter over the structured geometry. The emitted strings are part of
 * the export byte-parity contract (`renderMapDocumentSvg` must stay
 * byte-identical release over release): exact separators, emit order, and
 * number formatting are pinned by tests — do not restyle.
 */
export function buildTerrainRenderLayers(
  terrain: TerrainMap,
  grid: AutotileGrid,
  occupancy: TileOccupancy,
): TerrainRenderLayer[] {
  return buildStructuredTerrainLayers(terrain, grid, occupancy).map((layer) => ({
    assetId: layer.assetId,
    fillPath: layer.cells.map(cellFillPath).join(" "),
    boundaryPath: layer.edges.map(boundaryEdgePath).join(" "),
  }));
}

function cellFillPath(cell: TerrainCellRect): string {
  return `M ${cell.x} ${cell.y} h ${cell.size} v ${cell.size} h ${-cell.size} Z`;
}

function boundaryEdgePath(edge: TerrainBoundaryEdge): string {
  return edge.orientation === "h"
    ? `M ${edge.x1} ${edge.y1} H ${edge.x2}`
    : `M ${edge.x1} ${edge.y1} V ${edge.y2}`;
}
