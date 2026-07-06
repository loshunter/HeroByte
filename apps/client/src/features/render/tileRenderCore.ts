// Framework-agnostic canvas core for the shared tile renderer (VISION pillar
// 2, "an honest renderer"). It consumes the structured terrain geometry built
// by map-studio/terrainRender and reproduces the SVG flat-color model on a 2D
// context: same cells, same boundary edges, same colors. The only divergence
// is animation, applied via the frame parameter at live-draw time — frame 0
// equals the static SVG export. No React, no Konva, no DOM: callers own the
// canvas element, camera transform, and layer opacity (globalAlpha).

/** One painted terrain cell, in pixels on the document's offset lattice. */
export interface TerrainCellRect {
  x: number;
  y: number;
  size: number;
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

/** Grid pattern tile: getGridGeometry output plus the document's grid offsets. */
export interface GridPattern {
  width: number;
  height: number;
  path: string;
  offsetX: number;
  offsetY: number;
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
}

/** Matches the SVG model: boundary stroke-width 2, grid #ffffff at 0.16. */
const TERRAIN_BOUNDARY_WIDTH = 2;
const GRID_LINE_COLOR = "#ffffff";
const GRID_LINE_ALPHA = 0.16;
const GRID_LINE_WIDTH = 1;

/** Overrides for surfaces whose SVG styles differ from the export model. */
export interface TerrainDrawOptions {
  /** Boundary stroke width (editor uses max(2, gridSize * 0.04)). */
  boundaryWidth?: number;
}

export interface GridDrawStyle {
  color?: string;
  alpha?: number;
  lineWidth?: number;
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
  const margin = boundaryWidth / 2;
  for (const layer of layers) {
    const cells = view ? layer.cells.filter((cell) => cellInView(cell, view)) : layer.cells;
    const edges = view ? layer.edges.filter((edge) => edgeInView(edge, view, margin)) : layer.edges;
    if (cells.length === 0 && edges.length === 0) continue;
    const style = resolveStyle(layer.assetId, frame);
    ctx.fillStyle = style.fill;
    for (const cell of cells) {
      ctx.fillRect(cell.x, cell.y, cell.size, cell.size);
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

/** One subpath of a grid pattern tile, parsed from its SVG path. */
export interface GridPatternSubpath {
  points: Array<{ x: number; y: number }>;
  closed: boolean;
}

/**
 * Parse the tiny SVG path grammar getGridGeometry emits (absolute M/L/Z with
 * implicit lineto continuation). The path string stays the single source of
 * grid geometry — the canvas replays it instead of re-deriving the shapes.
 */
export function parseGridPatternPath(path: string): GridPatternSubpath[] {
  const tokens = path
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  const subpaths: GridPatternSubpath[] = [];
  let current: GridPatternSubpath | null = null;
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index]!;
    if (token === "M") {
      current = {
        points: [{ x: Number(tokens[index + 1]), y: Number(tokens[index + 2]) }],
        closed: false,
      };
      subpaths.push(current);
      index += 3;
    } else if (token === "L") {
      index += 1;
    } else if (token === "Z") {
      if (current) current.closed = true;
      index += 1;
    } else {
      current?.points.push({ x: Number(token), y: Number(tokens[index + 1]) });
      index += 2;
    }
  }
  return subpaths;
}

interface GridSegment {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Lies on the pattern tile's border (top/bottom/left/right edge). */
  border: boolean;
}

/** Explode subpaths into segments (closed subpaths include the return leg). */
function patternSegments(
  subpaths: GridPatternSubpath[],
  width: number,
  height: number,
): GridSegment[] {
  const segments: GridSegment[] = [];
  for (const subpath of subpaths) {
    const points = subpath.points;
    const count = subpath.closed ? points.length : points.length - 1;
    for (let index = 0; index < count; index += 1) {
      const from = points[index]!;
      const to = points[(index + 1) % points.length]!;
      const border =
        (from.y === 0 && to.y === 0) ||
        (from.y === height && to.y === height) ||
        (from.x === 0 && to.x === 0) ||
        (from.x === width && to.x === width);
      segments.push({ fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, border });
    }
  }
  return segments;
}

/**
 * Stroke the grid pattern across the visible view, replicating the SVG
 * `<pattern>` tiling: the pattern origin sits on the grid offsets and repeats
 * every pattern width/height. Includes the tile whose leading edge lands
 * exactly on the far view border so edge lines match the SVG render.
 *
 * Segments lying on the pattern tile's border are drawn at HALF width: SVG
 * clips pattern content to the tile box, so a centered stroke on the border
 * keeps only half its band — full-width canvas lines would read ~2x heavier
 * than the SVG grid.
 */
export function drawGrid(
  ctx: TileRenderContext2D,
  pattern: GridPattern,
  view: RenderViewRect,
  style?: GridDrawStyle,
): void {
  if (pattern.width <= 0 || pattern.height <= 0) return;
  const segments = patternSegments(
    parseGridPatternPath(pattern.path),
    pattern.width,
    pattern.height,
  );
  if (segments.length === 0) return;
  const lineWidth = style?.lineWidth ?? GRID_LINE_WIDTH;
  const firstCol = Math.floor((view.x - pattern.offsetX) / pattern.width);
  const lastCol = Math.floor((view.x + view.width - pattern.offsetX) / pattern.width) + 1;
  const firstRow = Math.floor((view.y - pattern.offsetY) / pattern.height);
  const lastRow = Math.floor((view.y + view.height - pattern.offsetY) / pattern.height) + 1;
  const tile = { firstCol, lastCol, firstRow, lastRow, pattern };
  ctx.save();
  ctx.strokeStyle = style?.color ?? GRID_LINE_COLOR;
  ctx.globalAlpha = style?.alpha ?? GRID_LINE_ALPHA;
  strokeGridPass(
    ctx,
    segments.filter((segment) => !segment.border),
    lineWidth,
    tile,
  );
  strokeGridPass(
    ctx,
    segments.filter((segment) => segment.border),
    lineWidth / 2,
    tile,
  );
  ctx.restore();
}

function strokeGridPass(
  ctx: TileRenderContext2D,
  segments: GridSegment[],
  lineWidth: number,
  tile: {
    firstCol: number;
    lastCol: number;
    firstRow: number;
    lastRow: number;
    pattern: GridPattern;
  },
): void {
  if (segments.length === 0) return;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  for (let row = tile.firstRow; row < tile.lastRow; row += 1) {
    for (let col = tile.firstCol; col < tile.lastCol; col += 1) {
      const originX = tile.pattern.offsetX + col * tile.pattern.width;
      const originY = tile.pattern.offsetY + row * tile.pattern.height;
      for (const segment of segments) {
        ctx.moveTo(originX + segment.fromX, originY + segment.fromY);
        ctx.lineTo(originX + segment.toX, originY + segment.toY);
      }
    }
  }
  ctx.stroke();
}
