// Pure element selection for the live "select" sub-tool. Reuses the Studio's
// rotation-aware tile/stamp hit-test (topmostTileAtPoint) and adds a bounds test
// for shapes, so a click picks the top-most element under the cursor in document
// space. elementSelectionRect returns the highlight footprint the preview draws.
//
// The other five kinds — wall, door, light, text, spline — are hit by PROXIMITY
// rather than containment, because none of them encloses an area you could
// click inside. Before that pass existed they could not be selected at all, and
// therefore could not be deleted: on a phone or at a desktop, Undo was the only
// way to take a misplaced wall back, and only until the next edit.

import { toWorld } from "@herobyte/shared";
import type { MapDocument, MapElement, MapLayer } from "@herobyte/shared";
import {
  isVisible,
  layerOrder,
  topmostTileAtPoint,
} from "../map-studio/components/mapStudioWorkspaceUtils";
import { distanceToPolyline, type Point } from "./elementGeometry";

/**
 * How close a click has to be, in CELLS, to count as "on" a line or a point.
 *
 * Cells rather than screen pixels, and the difference is a deliberate owner
 * decision (2026-08-26): a document-space tolerance feels identical at every
 * zoom, where a pixel tolerance spans several cells zoomed out — grabbing a
 * neighbouring wall — and feels unforgivingly precise zoomed in.
 *
 * Half a cell is forgiving without reaching the far side of a one-cell
 * corridor, where two walls sit exactly one cell apart.
 */
const SELECT_TOLERANCE_CELLS = 0.5;

/**
 * The kinds hit by proximity, MOST SPECIFIC FIRST.
 *
 * Order is load-bearing, not tidiness. A door sits ON a wall, so a click at a
 * doorway is inside tolerance of both; resolving the wall first would mean a DM
 * aiming at a door deletes the wall behind it. Lights and text are points and
 * cannot tie with anything.
 */
const PROXIMITY_KINDS: readonly MapElement["type"][] = ["door", "light", "text", "spline", "wall"];

/**
 * The world-space geometry a proximity hit measures against, or null when the
 * kind is not hit this way.
 *
 * A door has no points of its own: it is a segment of `data.width` centred on
 * the transform origin and rotated with it, so its ends are derived here the
 * same way the compiler derives them. Lights and text are single points — note
 * that a light's `data.radius` is deliberately NOT used, because a torch pool
 * can span half the map and would make a click anywhere in the room select it.
 */
function proximityPoints(element: MapElement): Point[] | null {
  switch (element.type) {
    case "wall":
    case "spline":
      return element.data.points.map((p) => toWorld(element.transform, p.x, p.y));
    case "door": {
      const half = element.data.width / 2;
      return [toWorld(element.transform, -half, 0), toWorld(element.transform, half, 0)];
    }
    case "light":
    case "text":
      return [{ x: element.transform.x, y: element.transform.y }];
    default:
      return null;
  }
}

export interface SelectionRect {
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /**
   * Local offset (from the box's top-left) of the point the element rotates
   * about, so the highlight pivots exactly like the element it outlines:
   * tile/stamp rotate about their visual center, shapes about the transform
   * origin. Matches the renderers and the exporter.
   */
  pivotX: number;
  pivotY: number;
}

/**
 * The outline for an element with no interior — a wall, door or spline.
 *
 * Points are DOCUMENT space and come from the same `proximityPoints` the hit
 * test measures against, which is the point: the outline a DM sees is drawn
 * from the geometry that decides what they can actually grab, so the two cannot
 * drift into disagreeing.
 */
export interface SelectionPolyline {
  kind: "polyline";
  points: Point[];
}

/**
 * The outline for a light or text — a circle at the element's origin, drawn at
 * exactly the hit tolerance, so the highlight IS the grab area rather than a
 * decoration near it.
 */
export interface SelectionPoint {
  kind: "point";
  x: number;
  y: number;
  radius: number;
}

export type SelectionShape = SelectionRect | SelectionPolyline | SelectionPoint;

/** The hit tolerance in document units, for a given grid. */
export function selectTolerance(gridSize: number): number {
  return gridSize * SELECT_TOLERANCE_CELLS;
}

/** The top-most visible element under a document-space point, or null. */
export function selectElementAtPoint(
  document: MapDocument,
  layers: Map<string, MapLayer>,
  point: { x: number; y: number },
): MapElement | null {
  // Tiles + stamps first (rotation-aware, top-of-stack), reusing the Studio helper.
  const tileOrStamp = topmostTileAtPoint(document, layers, point);
  if (tileOrStamp) return tileOrStamp;
  // Then shapes: top-most visible shape whose axis-aligned bounds contain the point.
  const shapes = document.elements
    .map((element, index) => ({ element, index }))
    .filter(
      ({ element }) => element.type === "shape" && isVisible(element, layers.get(element.layerId)),
    )
    .sort(
      (a, b) =>
        layerOrder(layers.get(b.element.layerId)) - layerOrder(layers.get(a.element.layerId)) ||
        b.index - a.index,
    );
  const shape = shapes.find(({ element }) => shapeContainsPoint(element, point))?.element;
  if (shape) return shape;

  // Finally the kinds with no interior. Ordered by KIND first (door before
  // wall), then by the same layer-then-index rule the tile pass uses — a second
  // ordering convention here would drift from that one exactly as a second
  // copy of `toWorld` would.
  const tolerance = document.grid.size * SELECT_TOLERANCE_CELLS;
  for (const kind of PROXIMITY_KINDS) {
    const candidates = document.elements
      .map((element, index) => ({ element, index }))
      .filter(({ element }) => element.type === kind)
      .filter(({ element }) => isVisible(element, layers.get(element.layerId)))
      .sort(
        (a, b) =>
          layerOrder(layers.get(b.element.layerId)) - layerOrder(layers.get(a.element.layerId)) ||
          b.index - a.index,
      );

    const hit = candidates.find(({ element }) => {
      const points = proximityPoints(element);
      return points !== null && distanceToPolyline(point, points) <= tolerance;
    });
    if (hit) return hit.element;
  }

  return null;
}

/**
 * The highlight for the selected element, in document px.
 *
 * Was `elementSelectionRect`, and returned null for the five kinds with no
 * interior. It is a SHAPE now because a rectangle is the wrong outline for a
 * line: the bounding box of a diagonal wall is a large square that touches the
 * wall at two corners and says nothing true about what is selected.
 */
export function elementSelectionShape(
  element: MapElement,
  gridSize: number,
): SelectionShape | null {
  const proximity = proximityPoints(element);
  if (proximity) {
    if (element.type === "light" || element.type === "text") {
      const origin = proximity[0]!;
      return { kind: "point", x: origin.x, y: origin.y, radius: selectTolerance(gridSize) };
    }
    return { kind: "polyline", points: proximity };
  }

  const { x, y, scaleX, scaleY, rotation } = element.transform;
  if (element.type === "tile") {
    const width = element.data.columns * gridSize * scaleX;
    const height = element.data.rows * gridSize * scaleY;
    // Footprint elements rotate about their visual center.
    return { kind: "rect", x, y, width, height, rotation, pivotX: width / 2, pivotY: height / 2 };
  }
  if (element.type === "stamp") {
    const width = element.data.width * scaleX;
    const height = element.data.height * scaleY;
    return { kind: "rect", x, y, width, height, rotation, pivotX: width / 2, pivotY: height / 2 };
  }
  if (element.type === "shape") {
    const b = shapeBounds(element);
    if (!b) return null;
    // Shapes rotate about the transform origin (x, y), which sits at the box's
    // top-left minus the shape's local offset (left*scaleX, top*scaleY).
    return { kind: "rect", ...b, rotation, pivotX: x - b.x, pivotY: y - b.y };
  }
  return null;
}

function shapeBounds(
  element: Extract<MapElement, { type: "shape" }>,
): { x: number; y: number; width: number; height: number } | null {
  const [start, end] = element.data.points;
  if (!start || !end) return null;
  const { x, y, scaleX, scaleY } = element.transform;
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return {
    x: x + left * scaleX,
    y: y + top * scaleY,
    width: width * scaleX,
    height: height * scaleY,
  };
}

function shapeContainsPoint(element: MapElement, point: { x: number; y: number }): boolean {
  if (element.type !== "shape") return false;
  const b = shapeBounds(element);
  if (!b) return false;
  return point.x >= b.x && point.x <= b.x + b.width && point.y >= b.y && point.y <= b.y + b.height;
}
