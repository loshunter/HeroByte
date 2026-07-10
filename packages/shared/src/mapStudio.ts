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
  type MapGridUpdate,
  type MapLayer,
  type MapLayerUpdate,
} from "./mapStudioTypes.js";
import { sanitizeMapGrid } from "./mapStudioGrid.js";
import {
  MAX_TERRAIN_CELL_MAGNITUDE,
  MAX_TERRAIN_PALETTE,
  createTerrainMap,
  sanitizeTerrainMap,
  setTerrainCells,
  type TerrainCellWrite,
} from "./terrain.js";
import {
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

/**
 * Rebuild a serialized document (a JSON backup) into a fresh, fully
 * sanitized document. Import deliberately bypasses per-command editability:
 * a backup restoring its own elements onto its own locked layers is not an
 * edit. Every layer and element still passes the shared sanitizers.
 */
export function importMapDocument(input: MapDocument, timestamp: number = Date.now()): MapDocument {
  if (input.schemaVersion !== MAP_DOCUMENT_SCHEMA_VERSION) {
    throw new Error(`Unsupported map document schema version: ${input.schemaVersion}`);
  }
  if (!Array.isArray(input.layers) || input.layers.length === 0) {
    throw new Error("Map document import requires at least one layer");
  }

  const base = createMapDocument({
    id: input.id,
    name: input.name,
    width: input.width,
    height: input.height,
    grid: input.grid,
    timestamp,
  });

  const layers = input.layers.map((layer) => sanitizeLayer(layer));
  const layerIds = new Set(layers.map((layer) => layer.id));

  const elementIds = new Set<string>();
  const elements = (input.elements ?? []).map((element) => {
    const sanitized = sanitizeElement(element);
    if (!layerIds.has(sanitized.layerId)) {
      throw new Error(`Unknown map layer: ${sanitized.layerId}`);
    }
    if (elementIds.has(sanitized.id)) {
      throw new Error(`Map element already exists: ${sanitized.id}`);
    }
    elementIds.add(sanitized.id);
    return sanitized;
  });

  const terrain = input.terrain ? sanitizeTerrainMap(input.terrain) : undefined;
  return terrain ? { ...base, layers, elements, terrain } : { ...base, layers, elements };
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

/** One brushed cell: paint with an asset id, erase with null. */
export interface TerrainPaintCell {
  x: number;
  y: number;
  assetId: string | null;
}

const MAX_TERRAIN_PAINT_CELLS = 16384;

/**
 * Apply one brush stroke to the document terrain: a batch of cells as one
 * revision — one undo step, per the Terrain Brush contract. The terrain
 * field disappears again when the last painted cell is erased.
 */
export function paintTerrain(
  document: MapDocument,
  cells: TerrainPaintCell[],
  timestamp: number = Date.now(),
): MapDocument {
  if (!Array.isArray(cells) || cells.length === 0) {
    throw new Error("Terrain stroke needs at least one cell");
  }
  if (cells.length > MAX_TERRAIN_PAINT_CELLS) {
    throw new Error(`Terrain stroke may paint at most ${MAX_TERRAIN_PAINT_CELLS} cells`);
  }
  const writes: TerrainCellWrite[] = cells.map((cell) => {
    if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y)) {
      throw new Error("Terrain cells must have integer coordinates");
    }
    if (
      Math.abs(cell.x) > MAX_TERRAIN_CELL_MAGNITUDE ||
      Math.abs(cell.y) > MAX_TERRAIN_CELL_MAGNITUDE
    ) {
      throw new Error("Terrain cell coordinates are out of range");
    }
    const assetId = cell.assetId === null ? null : requireText(cell.assetId, "Terrain asset id");
    return { x: cell.x, y: cell.y, assetId };
  });
  // One batch application: each touched chunk decodes once, the chunks
  // record copies once. A per-cell loop here was a confirmed ~80s
  // event-loop stall under a hostile-but-valid 16k-cell stroke.
  const terrain = setTerrainCells(document.terrain ?? createTerrainMap(), writes);
  if (terrain.palette.length > MAX_TERRAIN_PALETTE) {
    // sanitizeTerrainMap caps imports at this size; painting past it would
    // create a document that cannot round-trip through its own backup.
    throw new Error(`Terrain palette may hold at most ${MAX_TERRAIN_PALETTE} assets`);
  }
  const next = commit(document, {}, timestamp);
  if (Object.keys(terrain.chunks).length === 0) {
    delete next.terrain;
    return next;
  }
  next.terrain = terrain;
  return next;
}

/**
 * Bump revision + updatedAt for any document mutation. Exported for the element
 * mutations split into mapStudioElements.ts; not part of the public surface's
 * intended use.
 */
export function commit(
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
