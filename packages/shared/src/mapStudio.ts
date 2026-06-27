// Serializable map-authoring model shared by the client and server.
//
// Map documents are deliberately separate from RoomSnapshot. A document can
// contain thousands of authoring elements, while a live room should only need
// the compiled scene required for play. Keeping these models separate prevents
// editor history and hidden preparation data from leaking into room broadcasts.

import {
  DEFAULT_MAP_LAYERS,
  MAP_DOCUMENT_SCHEMA_VERSION,
  type CreateMapDocumentInput,
  type MapDocument,
  type MapElement,
  type MapElementUpdate,
  type MapGridUpdate,
  type MapLayer,
  type MapLayerUpdate,
} from "./mapStudioTypes.js";
import { sanitizeMapGrid } from "./mapStudioGrid.js";

export * from "./mapStudioTypes.js";

export function createMapDocument(input: CreateMapDocumentInput): MapDocument {
  const timestamp = input.timestamp ?? Date.now();
  const id = requireText(input.id, "Map document id");
  const name = requireText(input.name, "Map document name");
  const width = input.width ?? 2048;
  const height = input.height ?? 2048;
  requirePositiveNumber(width, "Map document width");
  requirePositiveNumber(height, "Map document height");

  const grid = sanitizeMapGrid({
    type: input.grid?.type ?? "square",
    size: input.grid?.size ?? 50,
    squareSize: input.grid?.squareSize ?? 5,
    offsetX: input.grid?.offsetX ?? 0,
    offsetY: input.grid?.offsetY ?? 0,
    visible: input.grid?.visible ?? true,
    snap: input.grid?.snap ?? true,
  });

  return {
    schemaVersion: MAP_DOCUMENT_SCHEMA_VERSION,
    id,
    name,
    width,
    height,
    grid,
    layers: DEFAULT_MAP_LAYERS.map((layer) => ({ ...layer })),
    elements: [],
    revision: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateMapGrid(
  document: MapDocument,
  update: MapGridUpdate,
  timestamp: number = Date.now(),
): MapDocument {
  return commit(document, { grid: sanitizeMapGrid({ ...document.grid, ...update }) }, timestamp);
}

export function addMapLayer(
  document: MapDocument,
  layer: MapLayer,
  timestamp: number = Date.now(),
): MapDocument {
  const sanitized = sanitizeLayer(layer);
  if (document.layers.some((candidate) => candidate.id === sanitized.id)) {
    throw new Error(`Map layer already exists: ${sanitized.id}`);
  }
  return commit(document, { layers: [...document.layers, sanitized] }, timestamp);
}

export function updateMapLayer(
  document: MapDocument,
  layerId: string,
  update: MapLayerUpdate,
  timestamp: number = Date.now(),
): MapDocument {
  const index = requireLayerIndex(document, layerId);
  const current = document.layers[index]!;
  const next: MapLayer = sanitizeLayer({
    ...current,
    ...update,
    id: current.id,
    kind: current.kind,
    zIndex: current.zIndex,
  });
  const layers = [...document.layers];
  layers[index] = next;
  return commit(document, { layers }, timestamp);
}

export function moveMapLayer(
  document: MapDocument,
  layerId: string,
  targetIndex: number,
  timestamp: number = Date.now(),
): MapDocument {
  const currentIndex = requireLayerIndex(document, layerId);
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= document.layers.length) {
    throw new Error(`Map layer target index is out of range: ${targetIndex}`);
  }
  const layers = document.layers.map((layer) => ({ ...layer }));
  const [layer] = layers.splice(currentIndex, 1);
  layers.splice(targetIndex, 0, layer!);
  layers.forEach((candidate, index) => {
    candidate.zIndex = index * 10;
  });
  return commit(document, { layers }, timestamp);
}

export function removeMapLayer(
  document: MapDocument,
  layerId: string,
  timestamp: number = Date.now(),
): MapDocument {
  requireLayerIndex(document, layerId);
  if (DEFAULT_MAP_LAYERS.some((layer) => layer.id === layerId)) {
    throw new Error(`Default map layer cannot be removed: ${layerId}`);
  }
  return commit(
    document,
    {
      layers: document.layers.filter((layer) => layer.id !== layerId),
      elements: document.elements.filter((element) => element.layerId !== layerId),
    },
    timestamp,
  );
}

export function addMapElement(
  document: MapDocument,
  element: MapElement,
  timestamp: number = Date.now(),
): MapDocument {
  if (document.elements.some((candidate) => candidate.id === element.id)) {
    throw new Error(`Map element already exists: ${element.id}`);
  }
  requireEditableLayer(document, element.layerId);
  const sanitized = sanitizeElement(element);
  return commit(document, { elements: [...document.elements, sanitized] }, timestamp);
}

export function updateMapElement(
  document: MapDocument,
  elementId: string,
  update: MapElementUpdate,
  timestamp: number = Date.now(),
): MapDocument {
  const index = requireElementIndex(document, elementId);
  const current = document.elements[index]!;
  requireEditableLayer(document, current.layerId);
  if (current.locked && update.locked !== false) {
    throw new Error(`Map element is locked: ${elementId}`);
  }
  const nextLayerId = update.layerId ?? current.layerId;
  if (nextLayerId !== current.layerId) requireEditableLayer(document, nextLayerId);
  const next = sanitizeElement({ ...current, ...update, id: current.id } as MapElement);
  const elements = [...document.elements];
  elements[index] = next;
  return commit(document, { elements }, timestamp);
}

export function removeMapElement(
  document: MapDocument,
  elementId: string,
  timestamp: number = Date.now(),
): MapDocument {
  const index = requireElementIndex(document, elementId);
  const current = document.elements[index]!;
  requireEditableLayer(document, current.layerId);
  if (current.locked) throw new Error(`Map element is locked: ${elementId}`);
  return commit(
    document,
    { elements: document.elements.filter((element) => element.id !== elementId) },
    timestamp,
  );
}

export function getVisibleMapElements(document: MapDocument): MapElement[] {
  const visibleLayerIds = new Set(
    document.layers.filter((layer) => layer.visible && layer.opacity > 0).map((layer) => layer.id),
  );
  return document.elements.filter(
    (element) => !element.hidden && visibleLayerIds.has(element.layerId),
  );
}

function commit(
  document: MapDocument,
  update: Partial<Pick<MapDocument, "grid" | "layers" | "elements">>,
  timestamp: number,
): MapDocument {
  requireFiniteNumber(timestamp, "Map document timestamp");
  return {
    ...document,
    ...update,
    revision: document.revision + 1,
    updatedAt: timestamp,
  };
}

function sanitizeLayer(layer: MapLayer): MapLayer {
  const id = requireText(layer.id, "Map layer id");
  const name = requireText(layer.name, "Map layer name");
  requireFiniteNumber(layer.opacity, "Map layer opacity");
  requireFiniteNumber(layer.zIndex, "Map layer z-index");
  if (layer.opacity < 0 || layer.opacity > 1) {
    throw new Error("Map layer opacity must be between 0 and 1");
  }
  return { ...layer, id, name };
}

function sanitizeElement(element: MapElement): MapElement {
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

function requireLayerIndex(document: MapDocument, layerId: string): number {
  const index = document.layers.findIndex((layer) => layer.id === layerId);
  if (index === -1) {
    throw new Error(`Unknown map layer: ${layerId}`);
  }
  return index;
}

function requireEditableLayer(document: MapDocument, layerId: string): MapLayer {
  const layer = document.layers[requireLayerIndex(document, layerId)]!;
  if (layer.locked) {
    throw new Error(`Map layer is locked: ${layerId}`);
  }
  return layer;
}

function requireElementIndex(document: MapDocument, elementId: string): number {
  const index = document.elements.findIndex((element) => element.id === elementId);
  if (index === -1) {
    throw new Error(`Unknown map element: ${elementId}`);
  }
  return index;
}

function requireText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required`);
  }
  return trimmed;
}

function requireFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
}

function requirePositiveNumber(value: number, label: string): void {
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
