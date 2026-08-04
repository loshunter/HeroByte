// ============================================================================
// AREA TEMPLATES — the shapes a spell covers
// ============================================================================
// A template is a `Drawing` whose `points` are a closed polygon in world
// pixels, tagged with the `AreaTemplate` metadata that produced them. Riding
// the drawing record is deliberate: templates inherit persistence, undo, the
// eraser, selection, the scene graph and the session file without a single new
// collection — and the polygon IS the geometry, so nothing has to re-derive a
// shape from parameters to answer "is Grak in it?".
//
// The maths lives in `shared` beside the diagonal rule for the same reason:
// one implementation, so a future server-side "who is inside this cone" cannot
// disagree with the cone the player is looking at.

export interface TemplatePoint {
  x: number;
  y: number;
}

/**
 * The four shapes 5e defines for an area of effect. `square` is the cube
 * (a cube on a battlemat is a square), `line` is the 5-ft-wide line.
 */
export const AREA_TEMPLATE_KINDS = ["circle", "cone", "square", "line"] as const;
export type AreaTemplateKind = (typeof AREA_TEMPLATE_KINDS)[number];

export const AREA_TEMPLATE_KIND_LABELS: Record<AreaTemplateKind, string> = {
  circle: "Circle",
  cone: "Cone",
  square: "Square",
  line: "Line",
};

/**
 * The drawing-toolbar tool names. Templates ARE drawing tools — they share the
 * mode, the colour, the undo stack and the eraser — so they live in the same
 * tool union rather than claiming a `ToolMode` of their own. That also means
 * they inherit the touch path for free: `useArmedTouchTool` already arms
 * drawing, and nothing arms a brand-new mode.
 */
export const AREA_TEMPLATE_TOOLS = [
  "template-circle",
  "template-cone",
  "template-square",
  "template-line",
] as const;
export type AreaTemplateTool = (typeof AREA_TEMPLATE_TOOLS)[number];

/** The template kind a tool draws, or null if the tool is not a template tool. */
export function templateKindForTool(tool: string): AreaTemplateKind | null {
  if (!tool.startsWith("template-")) return null;
  const kind = tool.slice("template-".length);
  return AREA_TEMPLATE_KINDS.includes(kind as never) ? (kind as AreaTemplateKind) : null;
}

/**
 * What a template IS, carried alongside the polygon so the readout can say
 * "20 ft cone" without measuring the points back.
 *
 * Deliberately does NOT carry the origin or the aim: the polygon is the single
 * source of truth for where the template sits, and a drawing can be dragged
 * after it is placed. A stored origin would silently go stale.
 */
export interface AreaTemplate {
  kind: AreaTemplateKind;
  /** Radius (circle), length (cone/line) or side (square), in the room's feet. */
  sizeFeet: number;
}

/** Vertices in the circle polygon. Fine enough that the chord error is sub-pixel. */
export const TEMPLATE_CIRCLE_SEGMENTS = 64;

/**
 * Longest template anyone can drag, in squares. A bound on the polygon's
 * coordinates, so a stray drag at a far zoom-out cannot mint a shape with
 * absurd numbers in it. 100 squares is 500 ft on a standard grid — well past
 * any spell in print.
 */
export const MAX_TEMPLATE_SQUARES = 100;

/**
 * Ceiling on a template's declared size in feet, for the coercion below. The
 * POLYGON is the truth about what a template covers, but the label is read by
 * humans — an unbounded `sizeFeet` lets a tampered client draw a 5 ft circle
 * captioned "999999 ft circle". `RANGE_LIMITS.GRID_SQUARE_SIZE_MAX` is 100, so
 * this is the largest size the builder itself can ever produce.
 */
export const MAX_TEMPLATE_FEET = MAX_TEMPLATE_SQUARES * 100;

export interface AreaTemplateInput {
  kind: AreaTemplateKind;
  /** Where the drag started, raw world pixels. Snapped internally. */
  origin: TemplatePoint;
  /** Where the pointer is now, raw world pixels. Sets size and direction. */
  aim: TemplatePoint;
  /** World pixels per grid square. */
  gridSize: number;
  /** Feet per grid square. */
  gridSquareSize: number;
}

export interface BuiltAreaTemplate {
  template: AreaTemplate;
  /** Closed polygon, world pixels. The first vertex is NOT repeated at the end. */
  points: TemplatePoint[];
  /** The snapped origin, for placing the size readout while dragging. */
  origin: TemplatePoint;
}

/**
 * Snap to the nearest HALF grid step, which lands on cell centres and cell
 * corners alike. A circle centred on a token (cell centre, per
 * `gridCellToWorldPoint`) and a cone breathed from a corner are both one
 * gesture away; snapping to corners only would put every burst off-centre from
 * the creature casting it.
 */
function snapToHalfGrid(value: number, gridSize: number): number {
  const step = gridSize / 2;
  return Math.round(value / step) * step;
}

function snapToGridCorner(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/** At least one square, never past the cap, always whole squares. */
function clampSquares(raw: number): number {
  if (!Number.isFinite(raw)) return 1;
  return Math.min(MAX_TEMPLATE_SQUARES, Math.max(1, Math.round(raw)));
}

/**
 * Turn a drag into a grid-snapped area template.
 *
 * Size always rounds to a whole number of squares — the point of a template is
 * that the squares it covers are unambiguous, and a 17.3-ft radius answers no
 * question anybody asked. Direction is left continuous: a cone that can only
 * point at 15-degree stops is a cone that cannot point at the goblin.
 *
 * A non-positive or non-finite `gridSize` yields a degenerate (empty) polygon
 * rather than NaN coordinates; callers treat an empty polygon as "nothing to
 * commit".
 */
export function buildAreaTemplate(input: AreaTemplateInput): BuiltAreaTemplate {
  const { kind, origin, aim, gridSize, gridSquareSize } = input;
  const feetPerSquare = Number.isFinite(gridSquareSize) ? gridSquareSize : 5;

  if (!Number.isFinite(gridSize) || gridSize <= 0) {
    return { template: { kind, sizeFeet: 0 }, points: [], origin };
  }

  // The cube aligns to cell corners so its sides sit ON grid lines; every
  // other shape radiates from a point and may sit on a cell centre.
  const snap = kind === "square" ? snapToGridCorner : snapToHalfGrid;
  const ox = snap(origin.x, gridSize);
  const oy = snap(origin.y, gridSize);
  const snappedOrigin = { x: ox, y: oy };

  const dx = aim.x - ox;
  const dy = aim.y - oy;

  // A cube is sized by its longer side, not by the diagonal the pointer
  // travelled — dragging to a corner would otherwise mint a cube 1.4x the
  // size the pointer suggests.
  const rawSquares =
    kind === "square"
      ? Math.max(Math.abs(dx), Math.abs(dy)) / gridSize
      : Math.hypot(dx, dy) / gridSize;
  const squares = clampSquares(rawSquares);
  const lengthPx = squares * gridSize;
  const template: AreaTemplate = { kind, sizeFeet: squares * feetPerSquare };

  if (kind === "square") {
    // Extends from the origin corner into the quadrant the pointer is in.
    const sx = dx < 0 ? -1 : 1;
    const sy = dy < 0 ? -1 : 1;
    const fx = ox + sx * lengthPx;
    const fy = oy + sy * lengthPx;
    return {
      template,
      origin: snappedOrigin,
      points: [
        { x: ox, y: oy },
        { x: fx, y: oy },
        { x: fx, y: fy },
        { x: ox, y: fy },
      ],
    };
  }

  if (kind === "circle") {
    const points: TemplatePoint[] = [];
    for (let index = 0; index < TEMPLATE_CIRCLE_SEGMENTS; index += 1) {
      const angle = (index / TEMPLATE_CIRCLE_SEGMENTS) * Math.PI * 2;
      points.push({ x: ox + Math.cos(angle) * lengthPx, y: oy + Math.sin(angle) * lengthPx });
    }
    return { template, origin: snappedOrigin, points };
  }

  // Cone and line both point along the drag. A zero-length drag has no
  // direction, so aim right (+x) rather than emitting NaN.
  const angle = dx === 0 && dy === 0 ? 0 : Math.atan2(dy, dx);
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const perpX = -dirY;
  const perpY = dirX;
  const tipX = ox + dirX * lengthPx;
  const tipY = oy + dirY * lengthPx;

  if (kind === "cone") {
    // 5e: "a cone's width at a given point along its length is equal to that
    // point's distance from the point of origin" — so the far edge is exactly
    // as wide as the cone is long, and the shape is a triangle, not an arc.
    const halfBase = lengthPx / 2;
    return {
      template,
      origin: snappedOrigin,
      points: [
        { x: ox, y: oy },
        { x: tipX + perpX * halfBase, y: tipY + perpY * halfBase },
        { x: tipX - perpX * halfBase, y: tipY - perpY * halfBase },
      ],
    };
  }

  // Line: one square wide (5e's 5-ft line), running origin -> tip.
  const halfWidth = gridSize / 2;
  return {
    template,
    origin: snappedOrigin,
    points: [
      { x: ox + perpX * halfWidth, y: oy + perpY * halfWidth },
      { x: tipX + perpX * halfWidth, y: tipY + perpY * halfWidth },
      { x: tipX - perpX * halfWidth, y: tipY - perpY * halfWidth },
      { x: ox - perpX * halfWidth, y: oy - perpY * halfWidth },
    ],
  };
}

/**
 * "20 ft cone" — the readout while dragging, and the label on the shape.
 *
 * Rounded: `gridSquareSize` may be fractional (the validator allows 0.1), and
 * 3 x 0.1 is 0.30000000000000004 in binary floating point. Nobody wants to
 * read that on a battlemat.
 */
export function formatAreaTemplate(template: AreaTemplate): string {
  const size = Math.round(template.sizeFeet * 10) / 10;
  return `${size} ft ${template.kind}`;
}

/**
 * Whitelist-coerce an untrusted template payload. Anything that is not a real
 * kind with a finite, in-range size becomes `undefined` — a drawing without
 * template metadata still renders as its polygon, so a poisoned file degrades
 * to a plain shape instead of crashing a render or labelling a lie.
 */
export function coerceAreaTemplate(value: unknown): AreaTemplate | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const candidate = value as { kind?: unknown; sizeFeet?: unknown };
  if (!AREA_TEMPLATE_KINDS.includes(candidate.kind as never)) return undefined;
  if (typeof candidate.sizeFeet !== "number" || !Number.isFinite(candidate.sizeFeet)) {
    return undefined;
  }
  if (candidate.sizeFeet <= 0 || candidate.sizeFeet > MAX_TEMPLATE_FEET) return undefined;
  // A FRESH object, never the caller's: this is the value that gets stored,
  // broadcast and labelled, so anything else the payload carried is dropped
  // here rather than persisted alongside it.
  return { kind: candidate.kind as AreaTemplateKind, sizeFeet: candidate.sizeFeet };
}
