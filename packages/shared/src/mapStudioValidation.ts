import type { MapDocument, MapElement, MapLayer } from "./mapStudioTypes.js";

export function sanitizeLayer(layer: MapLayer): MapLayer {
  const id = requireText(layer.id, "Map layer id");
  const name = requireText(layer.name, "Map layer name");
  requireFiniteNumber(layer.opacity, "Map layer opacity");
  requireFiniteNumber(layer.zIndex, "Map layer z-index");
  if (layer.opacity < 0 || layer.opacity > 1) {
    throw new Error("Map layer opacity must be between 0 and 1");
  }
  return { ...layer, id, name };
}

export function sanitizeElement(element: MapElement): MapElement {
  const id = requireText(element.id, "Map element id");
  const layerId = requireText(element.layerId, "Map element layer id");
  const transform = { ...element.transform };
  requireFiniteNumber(transform.x, "Map element X position");
  requireFiniteNumber(transform.y, "Map element Y position");
  requirePositiveNumber(transform.scaleX, "Map element X scale");
  requirePositiveNumber(transform.scaleY, "Map element Y scale");
  requireFiniteNumber(transform.rotation, "Map element rotation");

  switch (element.type) {
    case "tile":
      requireText(element.data.assetId, "Tile asset id");
      requirePositiveInteger(element.data.columns, "Tile columns");
      requirePositiveInteger(element.data.rows, "Tile rows");
      return { ...element, id, layerId, transform, data: { ...element.data } };
    case "stamp":
      requireText(element.data.assetId, "Stamp asset id");
      requirePositiveNumber(element.data.width, "Stamp width");
      requirePositiveNumber(element.data.height, "Stamp height");
      return { ...element, id, layerId, transform, data: { ...element.data } };
    case "shape":
      requirePointCount(element.data.points, 2, "Shape");
      requirePositiveNumber(element.data.strokeWidth, "Shape stroke width");
      requireUnitInterval(element.data.opacity, "Shape opacity");
      return {
        ...element,
        id,
        layerId,
        transform,
        data: { ...element.data, points: clonePoints(element.data.points) },
      };
    case "wall":
      requirePointCount(element.data.points, 2, "Wall");
      return {
        ...element,
        id,
        layerId,
        transform,
        data: { ...element.data, points: clonePoints(element.data.points) },
      };
    case "door":
      requirePositiveNumber(element.data.width, "Door width");
      return { ...element, id, layerId, transform, data: { ...element.data } };
    case "light":
      requirePositiveNumber(element.data.radius, "Light radius");
      requireUnitInterval(element.data.intensity, "Light intensity");
      return { ...element, id, layerId, transform, data: { ...element.data } };
    case "text":
      requireText(element.data.text, "Map text");
      requirePositiveNumber(element.data.fontSize, "Map text font size");
      return { ...element, id, layerId, transform, data: { ...element.data } };
  }
}

export function requireLayerIndex(document: MapDocument, layerId: string): number {
  const index = document.layers.findIndex((layer) => layer.id === layerId);
  if (index === -1) {
    throw new Error(`Unknown map layer: ${layerId}`);
  }
  return index;
}

export function requireEditableLayer(document: MapDocument, layerId: string): MapLayer {
  const layer = document.layers[requireLayerIndex(document, layerId)]!;
  if (layer.locked) {
    throw new Error(`Map layer is locked: ${layerId}`);
  }
  return layer;
}

export function requireElementIndex(document: MapDocument, elementId: string): number {
  const index = document.elements.findIndex((element) => element.id === elementId);
  if (index === -1) {
    throw new Error(`Unknown map element: ${elementId}`);
  }
  return index;
}

export function requireText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required`);
  }
  return trimmed;
}

export function requireFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
}

export function requirePositiveNumber(value: number, label: string): void {
  requireFiniteNumber(value, label);
  if (value <= 0) {
    throw new Error(`${label} must be greater than zero`);
  }
}

function requirePositiveInteger(value: number, label: string): void {
  requirePositiveNumber(value, label);
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }
}

function requireUnitInterval(value: number, label: string): void {
  requireFiniteNumber(value, label);
  if (value < 0 || value > 1) {
    throw new Error(`${label} must be between 0 and 1`);
  }
}

function requirePointCount(
  points: { x: number; y: number }[],
  minimum: number,
  label: string,
): void {
  if (!Array.isArray(points) || points.length < minimum) {
    throw new Error(`${label} requires at least ${minimum} points`);
  }
  points.forEach((point) => {
    requireFiniteNumber(point.x, `${label} point X`);
    requireFiniteNumber(point.y, `${label} point Y`);
  });
}

function clonePoints(points: { x: number; y: number }[]): { x: number; y: number }[] {
  return points.map((point) => ({ ...point }));
}
