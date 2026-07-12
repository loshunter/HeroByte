// Element mutations for a map document (add/update/remove/query), split out of
// mapStudio.ts to stay within the file-size budget. They share the internal
// `commit` revision-bump helper and the shared element sanitizers.

import { commit, paintTerrainCells, withTerrain, type TerrainPaintCell } from "./mapStudio.js";
import {
  requireEditableLayer,
  requireElementIndex,
  sanitizeElement,
} from "./mapStudioValidation.js";
import type { MapDocument, MapDoorState, MapElement, MapElementUpdate } from "./mapStudioTypes.js";

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

/**
 * Validate a batch of new elements and return the document's FULL next elements
 * array WITHOUT committing — the non-committing core so `place-room` can add
 * walls and paint floor under a single commit. Throws on a duplicate id or a
 * locked/missing layer (so nothing is applied when any element is invalid).
 */
export function addMapElementsBatchCore(
  document: MapDocument,
  elements: MapElement[],
): MapElement[] {
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

  return [...document.elements, ...sanitized];
}

export function addMapElements(
  document: MapDocument,
  elements: MapElement[],
  timestamp: number = Date.now(),
): MapDocument {
  return commit(document, { elements: addMapElementsBatchCore(document, elements) }, timestamp);
}

/**
 * Place a room: paint floor terrain AND add wall/element geometry as ONE
 * revision bump = ONE undo step. Both cores validate before this commits, so a
 * locked layer or bad cell leaves the document untouched (all-or-nothing).
 */
export function placeRoom(
  document: MapDocument,
  cells: TerrainPaintCell[],
  elements: MapElement[],
  timestamp: number = Date.now(),
): MapDocument {
  const terrain = paintTerrainCells(document, cells);
  const nextElements = addMapElementsBatchCore(document, elements);
  return withTerrain(commit(document, { elements: nextElements }, timestamp), terrain);
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

/**
 * Author a placed door's initial state + width. A dedicated path (not
 * update-element, whose MapElementUpdate carries no `data`) that keeps the
 * element id stable — so runtime toggle-door/set-door-state, which key on the
 * element id, still map after a re-publish. Deep-merges into the door's data
 * (blocksMovement/blocksVision preserved) rather than replacing it. Requires an
 * unlocked door on an editable layer; sanitizeElement enforces width > 0, and
 * the server zod validator caps width <= 1000 and constrains the state enum.
 */
export function updateMapDoor(
  document: MapDocument,
  elementId: string,
  update: { state: MapDoorState; width: number },
  timestamp: number = Date.now(),
): MapDocument {
  const index = requireElementIndex(document, elementId);
  const current = document.elements[index]!;
  requireEditableLayer(document, current.layerId);
  if (current.locked) throw new Error(`Map element is locked: ${elementId}`);
  if (current.type !== "door") throw new Error(`Map element is not a door: ${elementId}`);
  const next = sanitizeElement({
    ...current,
    data: { ...current.data, state: update.state, width: update.width },
  });
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
