// Pure document-coordinate data for both validation and the existing preview.
import {
  MAX_TERRAIN_CELL_MAGNITUDE,
  type MapDocument,
  type MapGridSettings,
} from "@herobyte/shared";

export const MIN_GENERATE_REGION_SIDE = 20;
export const MAX_GENERATE_REGION_CELLS = 16384;

export interface GenerateCellBounds {
  x: number;
  y: number;
  cols: number;
  rows: number;
}

export interface GenerateRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type GenerateRegionDocument = Pick<MapDocument, "id" | "width" | "height"> & {
  grid: Pick<MapGridSettings, "size" | "offsetX" | "offsetY">;
};
export type GenerateOutsideEdge = "left" | "top" | "right" | "bottom";
export type GenerateRegionProblem = {
  code:
    | "invalid-geometry"
    | "too-small"
    | "too-large"
    | "outside-document"
    | "outside-terrain-range";
  reason: string;
};

export interface GenerateRegionDescriptor {
  documentId: string;
  /** Unclipped normalized cells: these are the eventual wire input. */
  cells: GenerateCellBounds;
  /** Actual normalized target; null only when numeric geometry cannot be drawn. */
  rectangle: GenerateRectangle | null;
  /** Intersection is preview data, never a replacement dispatch region. */
  intersection: GenerateRectangle | null;
  /** Disjoint positive-area rectangles whose union is target minus document. */
  outside: GenerateRectangle[];
  /** Every crossed edge, independently of corner ownership in outside[]. */
  outsideEdges: GenerateOutsideEdge[];
  problem: GenerateRegionProblem | null;
}

/** Behavior-preserving extraction of useGenerate's current pixel conversion. */
export function toGenerateCellBounds(
  bounds: GenerateRectangle,
  grid: GenerateRegionDocument["grid"],
): GenerateCellBounds {
  return {
    x: Math.round((bounds.x - grid.offsetX) / grid.size),
    y: Math.round((bounds.y - grid.offsetY) / grid.size),
    cols: Math.max(1, Math.round(bounds.width / grid.size)),
    rows: Math.max(1, Math.round(bounds.height / grid.size)),
  };
}

/** Preserve the existing size reasons and small-before-large precedence. */
export function generateRegionSizeProblem(bounds: GenerateCellBounds | null): string | null {
  if (!bounds) return null;
  if (bounds.cols < MIN_GENERATE_REGION_SIDE || bounds.rows < MIN_GENERATE_REGION_SIDE) {
    return `Drag at least ${MIN_GENERATE_REGION_SIDE}×${MIN_GENERATE_REGION_SIDE} cells — a dungeon needs room for rooms AND the halls between them.`;
  }
  if (bounds.cols * bounds.rows > MAX_GENERATE_REGION_CELLS) {
    return `That area is too big (max ${MAX_GENERATE_REGION_CELLS} cells) — drag a smaller region.`;
  }
  return null;
}

/** Recompute from the supplied current document; no state, camera, or input ownership. */
export function describeGenerateRegion(
  document: GenerateRegionDocument,
  bounds: GenerateCellBounds,
): GenerateRegionDescriptor {
  const result: GenerateRegionDescriptor = {
    documentId: document.id,
    cells: { ...bounds },
    rectangle: null,
    intersection: null,
    outside: [],
    outsideEdges: [],
    problem: null,
  };
  const { size, offsetX, offsetY } = document.grid;
  const { x, y, cols, rows } = bounds;
  const invalid = () => ({
    ...result,
    problem: {
      code: "invalid-geometry" as const,
      reason: "Generate needs finite document coordinates and a positive grid size.",
    },
  });
  if (
    ![document.width, document.height, size, offsetX, offsetY].every(Number.isFinite) ||
    document.width <= 0 ||
    document.height <= 0 ||
    size <= 0 ||
    ![x, y, cols, rows].every(Number.isInteger) ||
    cols <= 0 ||
    rows <= 0
  ) {
    return invalid();
  }

  // Match server recipeContext.validateBounds, including operation order.
  const left = x * size + offsetX;
  const top = y * size + offsetY;
  const right = (x + cols) * size + offsetX;
  const bottom = (y + rows) * size + offsetY;
  if (![left, top, right, bottom, right - left, bottom - top].every(Number.isFinite)) {
    return invalid();
  }
  if (right <= left || bottom <= top) return invalid();
  result.rectangle = rectangle(left, top, right, bottom);

  if (left < 0) result.outsideEdges.push("left");
  if (top < 0) result.outsideEdges.push("top");
  if (right > document.width) result.outsideEdges.push("right");
  if (bottom > document.height) result.outsideEdges.push("bottom");

  const overlapLeft = Math.max(left, 0);
  const overlapTop = Math.max(top, 0);
  const overlapRight = Math.min(right, document.width);
  const overlapBottom = Math.min(bottom, document.height);
  if (overlapRight > overlapLeft && overlapBottom > overlapTop) {
    result.intersection = rectangle(overlapLeft, overlapTop, overlapRight, overlapBottom);
  }

  const add = (l: number, t: number, r: number, b: number) => {
    if (r > l && b > t) result.outside.push(rectangle(l, t, r, b));
  };
  // Top/bottom own corner pixels; side strips use only the vertical overlap.
  // Endpoint clamps also handle targets wholly outside the document.
  add(left, top, right, Math.min(bottom, 0));
  add(left, Math.max(top, document.height), right, bottom);
  add(left, overlapTop, Math.min(right, 0), overlapBottom);
  add(Math.max(left, document.width), overlapTop, right, overlapBottom);

  const sizeProblem = generateRegionSizeProblem(bounds);
  if (sizeProblem) {
    result.problem = {
      code:
        cols < MIN_GENERATE_REGION_SIDE || rows < MIN_GENERATE_REGION_SIDE
          ? "too-small"
          : "too-large",
      reason: sizeProblem,
    };
  } else if (
    [x, y, x + cols, y + rows].some((cell) => Math.abs(cell) > MAX_TERRAIN_CELL_MAGNITUDE)
  ) {
    result.problem = {
      code: "outside-terrain-range",
      reason:
        "Generate region lies outside the paintable terrain range. Adjust the map grid offset or choose another area.",
    };
  } else if (result.outsideEdges.length > 0) {
    result.problem = {
      code: "outside-document",
      reason: `Generate region must lie fully inside the map document (outside: ${result.outsideEdges.join(", ")}).`,
    };
  }
  return result;
}

function rectangle(left: number, top: number, right: number, bottom: number): GenerateRectangle {
  return { x: left, y: top, width: right - left, height: bottom - top };
}
