// Grid-lattice half of the shared tile renderer: replays getGridGeometry's
// SVG pattern paths onto a 2D context, replicating <pattern> tiling and its
// clipping behavior. Terrain drawing lives in tileRenderCore.
import type { RenderViewRect, TileRenderContext2D } from "./tileRenderCore";

/** Grid pattern tile: getGridGeometry output plus the document's grid offsets. */
export interface GridPattern {
  width: number;
  height: number;
  path: string;
  offsetX: number;
  offsetY: number;
}

export interface GridDrawStyle {
  color?: string;
  alpha?: number;
  lineWidth?: number;
}

/** Matches the SVG export model: #ffffff at 0.16 alpha, hairline width. */
const GRID_LINE_COLOR = "#ffffff";
const GRID_LINE_ALPHA = 0.16;
const GRID_LINE_WIDTH = 1;

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
