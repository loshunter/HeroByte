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
import {
  requireEditableLayer,
  requireElementIndex,
  requireFiniteNumber,
  requireLayerIndex,
  requirePositiveNumber,
  requireText,
  sanitizeElement,
  sanitizeLayer,
} from "./mapStudioValidation.js";

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

export function addMapElements(
  document: MapDocument,
  elements: MapElement[],
  timestamp: number = Date.now(),
): MapDocument {
  if (!elements.length) {
    throw new Error("At least one map element is required");
  }

  const existingIds = new Set(document.elements.map((element) => element.id));
  const batchIds = new Set<string>();
  const sanitized = elements.map((element) => {
    if (existingIds.has(element.id) || batchIds.has(element.id)) {
      throw new Error(`Map element already exists: ${element.id}`);
    }
    batchIds.add(element.id);
    requireEditableLayer(document, element.layerId);
    return sanitizeElement(element);
  });

  return commit(document, { elements: [...document.elements, ...sanitized] }, timestamp);
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
