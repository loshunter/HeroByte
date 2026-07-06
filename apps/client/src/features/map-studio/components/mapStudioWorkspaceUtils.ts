import type { PointerEvent, WheelEvent } from "react";
import type { MapDocument, MapElement, MapLayer } from "@herobyte/shared";
import { getTerrainCell } from "@herobyte/shared";
import type { MapStudioTileAsset } from "../starterTiles";
import type { MapStampDraft, MapTileDraft } from "../types";
import type { MapViewBox, RoomDrag } from "./MapStudioWorkspace.types";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 8;

export function eventToMapPoint(
  event: PointerEvent | WheelEvent,
  viewBox: MapViewBox,
  svg: SVGSVGElement | null,
): { x: number; y: number } {
  const rect = svg?.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return { x: event.clientX, y: event.clientY };
  }
  const viewport = renderedSvgViewport(rect, viewBox);
  return {
    x:
      viewBox.x + ((event.clientX - rect.left - viewport.offsetX) / viewport.width) * viewBox.width,
    y:
      viewBox.y +
      ((event.clientY - rect.top - viewport.offsetY) / viewport.height) * viewBox.height,
  };
}

export function screenDeltaToMapDelta(
  deltaX: number,
  deltaY: number,
  viewBox: MapViewBox,
  svg: SVGSVGElement | null,
): { x: number; y: number } {
  const rect = svg?.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  const viewport = renderedSvgViewport(rect, viewBox);
  return {
    x: (deltaX / viewport.width) * viewBox.width,
    y: (deltaY / viewport.height) * viewBox.height,
  };
}

export function zoomViewBox(
  current: MapViewBox,
  document: MapDocument,
  factor: number,
  anchor = { x: current.x + current.width / 2, y: current.y + current.height / 2 },
): MapViewBox {
  const full = { x: 0, y: 0, width: document.width, height: document.height };
  const minimumWidth = document.width / MAX_ZOOM;
  const maximumWidth = document.width / MIN_ZOOM;
  const nextWidth = clamp(current.width * factor, minimumWidth, maximumWidth);
  const nextHeight = nextWidth * (current.height / current.width);
  const ratioX = (anchor.x - current.x) / current.width;
  const ratioY = (anchor.y - current.y) / current.height;
  return clampViewBox(
    {
      x: anchor.x - nextWidth * ratioX,
      y: anchor.y - nextHeight * ratioY,
      width: Math.min(nextWidth, full.width),
      height: Math.min(nextHeight, full.height),
    },
    document,
  );
}

export function clampViewBox(viewBox: MapViewBox, document: MapDocument): MapViewBox {
  const width = Math.min(viewBox.width, document.width);
  const height = Math.min(viewBox.height, document.height);
  return {
    x: clamp(viewBox.x, 0, document.width - width),
    y: clamp(viewBox.y, 0, document.height - height),
    width,
    height,
  };
}

export function buildRoomTileDrafts({
  document,
  layers,
  fillAsset,
  wallAsset,
  drag,
}: {
  document: MapDocument;
  layers: Map<string, MapLayer>;
  fillAsset: MapStudioTileAsset;
  wallAsset: MapStudioTileAsset | null;
  drag: RoomDrag;
}): MapTileDraft[] {
  const fillLayer = pickPlacementLayer(document, fillAsset);
  const wallLayer = wallAsset ? pickPlacementLayer(document, wallAsset) : undefined;
  if (!fillLayer || (wallAsset && !wallLayer)) return [];

  const bounds = roomBoundsFromDrag(drag, document.grid.size);
  const existing = new Set<string>();
  document.elements.forEach((element) => {
    if (element.type !== "tile" || !isVisible(element, layers.get(element.layerId))) return;
    existing.add(
      `${element.layerId}:${element.data.assetId}:${element.transform.x}:${element.transform.y}`,
    );
  });
  const drafts: MapTileDraft[] = [];
  const addDraft = (asset: MapStudioTileAsset, layerId: string, x: number, y: number) => {
    const key = `${layerId}:${asset.id}:${x}:${y}`;
    if (existing.has(key)) return;
    existing.add(key);
    drafts.push({
      layerId,
      assetId: asset.id,
      x,
      y,
      columns: asset.columns,
      rows: asset.rows,
    });
  };

  for (let y = bounds.y; y < bounds.y + bounds.height; y += document.grid.size) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += document.grid.size) {
      if (x < 0 || y < 0 || x >= document.width || y >= document.height) continue;
      addDraft(fillAsset, fillLayer.id, x, y);
      if (!wallAsset || !wallLayer) continue;
      const border =
        x === bounds.x ||
        y === bounds.y ||
        x + document.grid.size >= bounds.x + bounds.width ||
        y + document.grid.size >= bounds.y + bounds.height;
      if (border) addDraft(wallAsset, wallLayer.id, x, y);
    }
  }

  return drafts;
}

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

export function toLiveGridSize(documentGridSize: number): number {
  return Math.min(500, Math.max(10, Math.round(documentGridSize)));
}

/**
 * Where the viewBox actually lands inside the element's box under
 * preserveAspectRatio="xMidYMid meet" — shared by pointer math and the
 * canvas underlay so both map world coordinates to identical screen pixels.
 */
export function renderedSvgViewport(rect: DOMRect, viewBox: MapViewBox) {
  const viewAspect = viewBox.width / viewBox.height;
  const rectAspect = rect.width / rect.height;
  if (rectAspect > viewAspect) {
    const height = rect.height;
    const width = height * viewAspect;
    return { width, height, offsetX: (rect.width - width) / 2, offsetY: 0 };
  }
  const width = rect.width;
  const height = width / viewAspect;
  return { width, height, offsetX: 0, offsetY: (rect.height - height) / 2 };
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
