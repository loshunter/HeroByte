import type { MapDocument, MapElement, MapLayer } from "@herobyte/shared";
import { getTerrainCell } from "@herobyte/shared";
import type { MapStudioTileAsset } from "../starterTiles";
import type { MapStampDraft } from "../types";
import type { RoomDrag } from "./MapStudioWorkspace.types";

// Pure placement/selection helpers shared by the live map-edit palette (the
// Studio scene that also used the camera/room-drafting helpers here was removed
// in S13; those workspace-only functions were pruned with it).

export function roomBoundsFromDrag(drag: RoomDrag, gridSize: number) {
  const minX = Math.min(drag.start.x, drag.end.x);
  const minY = Math.min(drag.start.y, drag.end.y);
  const maxX = Math.max(drag.start.x, drag.end.x);
  const maxY = Math.max(drag.start.y, drag.end.y);
  return {
    x: minX,
    y: minY,
    width: maxX - minX + gridSize,
    height: maxY - minY + gridSize,
  };
}

export function pickPlacementLayer(
  document: MapDocument,
  asset: MapStudioTileAsset,
): MapLayer | undefined {
  return (
    document.layers.find((layer) => layer.kind === asset.layerKind && !layer.locked) ??
    document.layers.find((layer) => !layer.locked)
  );
}

/**
 * The asset id under the cursor for the eyedropper: the topmost tile/stamp
 * element if one is stacked here, else the painted terrain cell. Null over
 * empty canvas.
 */
export function sampleAssetAtPoint(
  document: MapDocument,
  layers: Map<string, MapLayer>,
  point: { x: number; y: number },
): string | null {
  const element = topmostTileAtPoint(document, layers, point);
  if (element && (element.type === "tile" || element.type === "stamp")) {
    return element.data.assetId;
  }
  if (document.terrain) {
    const { size, offsetX, offsetY } = document.grid;
    const cellX = Math.floor((point.x - offsetX) / size);
    const cellY = Math.floor((point.y - offsetY) / size);
    return getTerrainCell(document.terrain, cellX, cellY);
  }
  return null;
}

export function topmostTileAtPoint(
  document: MapDocument,
  layers: Map<string, MapLayer>,
  point: { x: number; y: number },
): MapElement | null {
  const sorted = document.elements
    .map((element, index) => ({ element, index }))
    .filter(({ element }) => element.type === "tile" || element.type === "stamp")
    .filter(({ element }) => isVisible(element, layers.get(element.layerId)))
    .sort(
      (a, b) =>
        layerOrder(layers.get(b.element.layerId)) - layerOrder(layers.get(a.element.layerId)) ||
        b.index - a.index,
    );
  return (
    sorted.find(({ element }) => containsPoint(element, document.grid.size, point))?.element ?? null
  );
}

export function isVisible(element: MapElement, layer?: MapLayer): boolean {
  return Boolean(layer?.visible && layer.opacity > 0 && !element.hidden);
}

export function layerOrder(layer?: MapLayer): number {
  return layer?.zIndex ?? 0;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

/**
 * Off-grid Shelf placement: the stamp lands centered on the cursor at whole-
 * pixel precision, clamped inside the document. Null when no layer accepts it.
 */
export function buildStampDraft(
  document: MapDocument,
  asset: MapStudioTileAsset,
  point: { x: number; y: number },
): MapStampDraft | null {
  const width = asset.columns * document.grid.size;
  const height = asset.rows * document.grid.size;
  const layer = pickPlacementLayer(document, asset);
  if (!layer) return null;
  return {
    layerId: layer.id,
    assetId: asset.id,
    x: Math.round(clamp(point.x - width / 2, 0, document.width - width)),
    y: Math.round(clamp(point.y - height / 2, 0, document.height - height)),
    width,
    height,
  };
}

/**
 * Inclusive placement range for a painted tile along one axis. With snapping
 * on, both ends land on the grid lattice so edge paints stay autotileable —
 * clamping to `extent - cells*size` minted off-lattice tiles whenever the
 * document extent wasn't a grid multiple.
 */
export function paintPlacementBounds(
  extent: number,
  cells: number,
  size: number,
  offset: number,
  snap: boolean,
): { min: number; max: number } {
  const rawMax = extent - cells * size;
  if (!snap) return { min: 0, max: rawMax };
  const min = offset - Math.floor(offset / size) * size;
  const max = offset + Math.floor((rawMax - offset) / size) * size;
  return max >= min ? { min, max } : { min: 0, max: rawMax };
}

function containsPoint(
  element: MapElement,
  gridSize: number,
  point: { x: number; y: number },
): boolean {
  if (element.type !== "tile" && element.type !== "stamp") return false;
  const { x, y, scaleX, scaleY, rotation } = element.transform;
  const width =
    (element.type === "tile" ? element.data.columns * gridSize : element.data.width) * scaleX;
  const height =
    (element.type === "tile" ? element.data.rows * gridSize : element.data.height) * scaleY;
  // Footprints rotate around their visual center (matching the renderers);
  // un-rotate the query point into the element's frame before the bounds test.
  const pivotX = x + width / 2;
  const pivotY = y + height / 2;
  const radians = (-rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - pivotX;
  const dy = point.y - pivotY;
  const localX = pivotX + dx * cos - dy * sin;
  const localY = pivotY + dx * sin + dy * cos;
  return localX >= x && localX <= x + width && localY >= y && localY <= y + height;
}
