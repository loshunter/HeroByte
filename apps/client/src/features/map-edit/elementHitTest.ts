// Pure element selection for the live "select" sub-tool. Reuses the Studio's
// rotation-aware tile/stamp hit-test (topmostTileAtPoint) and adds a bounds test
// for shapes, so a click picks the top-most element under the cursor in document
// space. elementSelectionRect returns the highlight footprint the preview draws.

import type { MapDocument, MapElement, MapLayer } from "@herobyte/shared";
import {
  isVisible,
  layerOrder,
  topmostTileAtPoint,
} from "../map-studio/components/mapStudioWorkspaceUtils";

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/** The top-most visible tile/stamp/shape under a document-space point, or null. */
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
  return shapes.find(({ element }) => shapeContainsPoint(element, point))?.element ?? null;
}

/** Highlight footprint (document px) for the selected element; null for wall/door/light. */
export function elementSelectionRect(element: MapElement, gridSize: number): SelectionRect | null {
  const { x, y, scaleX, scaleY, rotation } = element.transform;
  if (element.type === "tile") {
    return {
      x,
      y,
      width: element.data.columns * gridSize * scaleX,
      height: element.data.rows * gridSize * scaleY,
      rotation,
    };
  }
  if (element.type === "stamp") {
    return {
      x,
      y,
      width: element.data.width * scaleX,
      height: element.data.height * scaleY,
      rotation,
    };
  }
  if (element.type === "shape") {
    const b = shapeBounds(element);
    return b ? { ...b, rotation } : null;
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
