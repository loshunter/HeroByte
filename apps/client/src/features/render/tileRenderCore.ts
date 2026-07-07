// Framework-agnostic canvas core for the shared tile renderer (VISION pillar
// 2, "an honest renderer"). It consumes the structured terrain geometry built
// by map-studio/terrainRender and reproduces the SVG model on a 2D context:
// same cells, same boundary edges, same colors — atlas textures when a
// tileset covers the family, flat fills otherwise. The only other divergence
// is animation, applied via the frame parameter at live-draw time — frame 0
// equals the static SVG export. No React, no Konva, no DOM: callers own the
// canvas element, camera transform, and layer opacity (globalAlpha).
// Grid-lattice drawing lives in gridRenderCore.

/**
 * One painted terrain cell: pixels on the document's offset lattice, plus
 * the lattice indices themselves (atlas variant selection hashes on them).
 */
export interface TerrainCellRect {
  x: number;
  y: number;
  size: number;
  cellX: number;
  cellY: number;
  /**
   * 8-neighbor same-family bitmask (blobAutotile bit order), set by
   * buildStructuredTerrainLayers. Consumed ONLY by the quarter-tile (blob47)
   * atlas path; the flat-fill, boundary-edge, and SVG-adapter paths ignore it,
   * so it never affects export byte-parity. Optional/additive.
   */
  neighborMask?: number;
}

/**
 * Axis-aligned boundary edge, with x1 <= x2 and y1 <= y2. Orientation is
 * carried explicitly rather than inferred from the coordinates: float
 * absorption (top + size === top on extreme lattices) can collapse an edge
 * to a point, and the SVG adapter must still emit the same H/V command the
 * pre-refactor code did.
 */
export interface TerrainBoundaryEdge {
  orientation: "h" | "v";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Structured terrain geometry for one family — the renderer-neutral form. */
export interface StructuredTerrainLayer {
  assetId: string;
  cells: TerrainCellRect[];
  edges: TerrainBoundaryEdge[];
}

/** Fill/stroke for one terrain family at one animation frame. */
export interface TerrainLayerStyle {
  fill: string;
  stroke: string;
}

export type TerrainStyleResolver = (assetId: string, frame: number) => TerrainLayerStyle;

/** The visible world rect (camera viewBox), in pixels. */
export interface RenderViewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The slice of CanvasRenderingContext2D the core draws through (mockable). */
export interface TileRenderContext2D {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  globalAlpha: number;
  fillRect(x: number, y: number, width: number, height: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
  save(): void;
  restore(): void;
  drawImage(
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
}

/** Matches the SVG export model: boundary stroke-width 2. */
const TERRAIN_BOUNDARY_WIDTH = 2;

/** A source rect in the atlas image (matches tileAtlas's TileAtlasRect). */
export interface TerrainAtlasRect {
  x: number;
  y: number;
  size: number;
}

/** Four quarter-tile source rects in fixed order: tl, tr, bl, br. */
export type TerrainAtlasQuarterRects = [
  TerrainAtlasRect,
  TerrainAtlasRect,
  TerrainAtlasRect,
  TerrainAtlasRect,
];

/**
 * An atlas the core can source textured cells from (structurally matches
 * tileAtlas's TileAtlas — kept as a local shape so the core stays
 * dependency-free). tileForCell returns null for families without atlas
 * art (water, uploads), which fall back to flat fills.
 */
export interface TerrainAtlasSource {
  image: CanvasImageSource;
  tileForCell(assetId: string, cellX: number, cellY: number): TerrainAtlasRect | null;
  /**
   * Four quarter-tile source rects (tl, tr, bl, br) for a cell's neighbor
   * mask, or null when the family has no quarter-tile (blob47) art. Optional:
   * atlases without it — and every atlas today — fall through to the
   * whole-tile `tileForCell` path, so the quarter path is inert until art
   * ships a blob47 region.
   */
  quarterRectsForCell?(
    assetId: string,
    cellX: number,
    cellY: number,
    neighborMask: number,
  ): TerrainAtlasQuarterRects | null;
}

/** Overrides for surfaces whose SVG styles differ from the export model. */
export interface TerrainDrawOptions {
  /** Boundary stroke width (editor uses max(2, gridSize * 0.04)). */
  boundaryWidth?: number;
  /** When present, cells covered by the atlas draw textures, not fills. */
  atlas?: TerrainAtlasSource;
}

/**
 * Draw structured terrain layers as flat fills plus fused boundary strokes,
 * mirroring the SVG render cell-for-cell. `view` (world-pixel rect) culls
 * cells/edges that cannot be visible; the cull keeps a margin of half the
 * boundary width, because centered strokes paint past the segment geometry.
 */
export function drawTerrain(
  ctx: TileRenderContext2D,
  layers: readonly StructuredTerrainLayer[],
  resolveStyle: TerrainStyleResolver,
  frame: number,
  view?: RenderViewRect,
  options?: TerrainDrawOptions,
): void {
  const boundaryWidth = options?.boundaryWidth ?? TERRAIN_BOUNDARY_WIDTH;
  const atlas = options?.atlas;
  const margin = boundaryWidth / 2;
  for (const layer of layers) {
    const cells = view ? layer.cells.filter((cell) => cellInView(cell, view)) : layer.cells;
    const edges = view ? layer.edges.filter((edge) => edgeInView(edge, view, margin)) : layer.edges;
    if (cells.length === 0 && edges.length === 0) continue;
    const style = resolveStyle(layer.assetId, frame);
    const flatCells: TerrainCellRect[] = [];
    if (atlas) {
      for (const cell of cells) {
        // True 47-blob path: when the family ships quarter-tile art, four
        // sub-images resolve the cell's corners. No family does today, so
        // quarterRectsForCell is absent/returns null and we fall through to
        // the whole-tile path — the feature is inert until art lands.
        const quarters = atlas.quarterRectsForCell?.(
          layer.assetId,
          cell.cellX,
          cell.cellY,
          cell.neighborMask ?? 0,
        );
        if (quarters) {
          drawQuarterTile(ctx, atlas.image, cell, quarters);
          continue;
        }
        const tile = atlas.tileForCell(layer.assetId, cell.cellX, cell.cellY);
        if (tile) {
          ctx.drawImage(
            atlas.image,
            tile.x,
            tile.y,
            tile.size,
            tile.size,
            cell.x,
            cell.y,
            cell.size,
            cell.size,
          );
        } else {
          flatCells.push(cell);
        }
      }
    } else {
      flatCells.push(...cells);
    }
    if (flatCells.length > 0) {
      ctx.fillStyle = style.fill;
      for (const cell of flatCells) {
        ctx.fillRect(cell.x, cell.y, cell.size, cell.size);
      }
    }
    if (edges.length === 0) continue;
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = boundaryWidth;
    ctx.beginPath();
    for (const edge of edges) {
      ctx.moveTo(edge.x1, edge.y1);
      ctx.lineTo(edge.x2, edge.y2);
    }
    ctx.stroke();
  }
}

/**
 * Blit the four quarter-tile source rects (tl, tr, bl, br) to their dest
 * quarters of the cell, each half the cell size — the draw half of true
 * 47-blob autotiling.
 */
function drawQuarterTile(
  ctx: TileRenderContext2D,
  image: CanvasImageSource,
  cell: TerrainCellRect,
  quarters: TerrainAtlasQuarterRects,
): void {
  const half = cell.size / 2;
  const dests: readonly [number, number][] = [
    [cell.x, cell.y], // tl
    [cell.x + half, cell.y], // tr
    [cell.x, cell.y + half], // bl
    [cell.x + half, cell.y + half], // br
  ];
  for (let i = 0; i < 4; i += 1) {
    const src = quarters[i]!;
    const [dx, dy] = dests[i]!;
    ctx.drawImage(image, src.x, src.y, src.size, src.size, dx, dy, half, half);
  }
}

function cellInView(cell: TerrainCellRect, view: RenderViewRect): boolean {
  return (
    cell.x <= view.x + view.width &&
    cell.x + cell.size >= view.x &&
    cell.y <= view.y + view.height &&
    cell.y + cell.size >= view.y
  );
}

function edgeInView(edge: TerrainBoundaryEdge, view: RenderViewRect, margin: number): boolean {
  return (
    edge.x1 <= view.x + view.width + margin &&
    edge.x2 >= view.x - margin &&
    edge.y1 <= view.y + view.height + margin &&
    edge.y2 >= view.y - margin
  );
}
