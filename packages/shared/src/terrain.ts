// ============================================================================
// TERRAIN MODEL — RLE-compressed 16x16 chunks
// ============================================================================
// The Terrain Brush's storage layer (VISION pillar 1, "wire reality"): painted
// terrain is a dense grid of palette-indexed cells, stored as run-length-
// encoded chunks so a 100x100 painted map costs bytes, not ten thousand
// elements. Deterministic wire format by contract — golden-tested; changing
// it is a schema migration, not a refactor.
//
// Runs are flat [count, value, count, value, ...] pairs covering exactly one
// chunk (256 cells, row-major). Value 0 is empty; value v > 0 is palette[v-1].

export const TERRAIN_CHUNK_SIZE = 16;
const CHUNK_CELLS = TERRAIN_CHUNK_SIZE * TERRAIN_CHUNK_SIZE;

export interface TerrainMap {
  schemaVersion: 1;
  /** Asset ids referenced by run values (1-based; 0 means empty). */
  palette: string[];
  /** "chunkX,chunkY" -> RLE runs over the chunk's 256 row-major cells. */
  chunks: Record<string, number[]>;
}

export function createTerrainMap(): TerrainMap {
  return { schemaVersion: 1, palette: [], chunks: {} };
}

/** RLE-encode one chunk's dense 256-cell array. */
export function encodeTerrainChunk(cells: readonly number[]): number[] {
  if (cells.length !== CHUNK_CELLS) {
    throw new Error(`Terrain chunk must have exactly ${CHUNK_CELLS} cells`);
  }
  const runs: number[] = [];
  let value = cells[0]!;
  let count = 0;
  for (const cell of cells) {
    if (cell === value) {
      count += 1;
      continue;
    }
    runs.push(count, value);
    value = cell;
    count = 1;
  }
  runs.push(count, value);
  return runs;
}

/** Decode RLE runs back into a dense 256-cell array, validating coverage. */
export function decodeTerrainChunk(runs: readonly number[]): number[] {
  if (runs.length % 2 !== 0) {
    throw new Error("Terrain runs must be [count, value] pairs");
  }
  const cells: number[] = [];
  for (let index = 0; index < runs.length; index += 2) {
    const count = runs[index]!;
    const value = runs[index + 1]!;
    if (!Number.isInteger(count) || count <= 0) {
      throw new Error("Terrain run counts must be positive integers");
    }
    if (!Number.isInteger(value) || value < 0) {
      throw new Error("Terrain run values must be non-negative integers");
    }
    for (let cell = 0; cell < count; cell += 1) cells.push(value);
  }
  if (cells.length !== CHUNK_CELLS) {
    throw new Error(`Terrain runs must cover exactly ${CHUNK_CELLS} cells`);
  }
  return cells;
}

export interface TerrainCellWrite {
  x: number;
  y: number;
  assetId: string | null;
}

export function getTerrainCell(map: TerrainMap, cellX: number, cellY: number): string | null {
  const runs = map.chunks[chunkKey(cellX, cellY)];
  if (!runs) return null;
  const value = decodeTerrainChunk(runs)[cellIndex(cellX, cellY)]!;
  return value === 0 ? null : (map.palette[value - 1] ?? null);
}

/** Immutably paint (or erase, with null) one cell. */
export function setTerrainCell(
  map: TerrainMap,
  cellX: number,
  cellY: number,
  assetId: string | null,
): TerrainMap {
  return setTerrainCells(map, [{ x: cellX, y: cellY, assetId }]);
}

/**
 * Immutably apply a batch of cell writes. Each touched chunk is decoded and
 * re-encoded exactly once and the chunks record is copied exactly once, so a
 * whole brush stroke costs O(cells + touchedChunks) — a naive per-cell loop
 * was O(cells x chunks) and a single hostile 16k-cell stroke measured ~80s
 * of synchronous event-loop stall (found by adversarial review).
 */
export function setTerrainCells(map: TerrainMap, writes: readonly TerrainCellWrite[]): TerrainMap {
  if (writes.length === 0) return map;
  const paletteIndex = new Map(map.palette.map((entry, index) => [entry, index + 1]));
  let palette = map.palette;
  const touched = new Map<string, number[]>();

  for (const write of writes) {
    const key = chunkKey(write.x, write.y);
    let cells = touched.get(key);
    if (!cells) {
      cells = map.chunks[key]
        ? decodeTerrainChunk(map.chunks[key]!)
        : new Array<number>(CHUNK_CELLS).fill(0);
      touched.set(key, cells);
    }
    let value = 0;
    if (write.assetId !== null) {
      const existing = paletteIndex.get(write.assetId);
      if (existing !== undefined) {
        value = existing;
      } else {
        if (palette === map.palette) palette = [...palette];
        palette.push(write.assetId);
        value = palette.length;
        paletteIndex.set(write.assetId, value);
      }
    }
    cells[cellIndex(write.x, write.y)] = value;
  }

  const chunks = { ...map.chunks };
  let changed = palette !== map.palette;
  for (const [key, cells] of touched) {
    const previous = map.chunks[key];
    if (cells.every((cell) => cell === 0)) {
      if (previous) {
        delete chunks[key];
        changed = true;
      }
      continue;
    }
    const runs = encodeTerrainChunk(cells);
    if (!previous || !runsEqual(previous, runs)) {
      chunks[key] = runs;
      changed = true;
    }
  }
  if (!changed) return map;
  return { schemaVersion: 1, palette, chunks };
}

function runsEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
}

/** Visit every painted (non-empty) cell. */
export function forEachTerrainCell(
  map: TerrainMap,
  visit: (cellX: number, cellY: number, assetId: string) => void,
): void {
  for (const [key, runs] of Object.entries(map.chunks)) {
    const [chunkX, chunkY] = key.split(",").map(Number) as [number, number];
    const cells = decodeTerrainChunk(runs);
    for (let index = 0; index < CHUNK_CELLS; index += 1) {
      const value = cells[index]!;
      if (value === 0) continue;
      const assetId = map.palette[value - 1];
      if (assetId === undefined) continue;
      visit(
        chunkX * TERRAIN_CHUNK_SIZE + (index % TERRAIN_CHUNK_SIZE),
        chunkY * TERRAIN_CHUNK_SIZE + Math.floor(index / TERRAIN_CHUNK_SIZE),
        assetId,
      );
    }
  }
}

export const MAX_TERRAIN_PALETTE = 512;
/** Paintable cell range; chunk keys outside floor(±range/16) are corrupt. */
export const MAX_TERRAIN_CELL_MAGNITUDE = 65536;
const MAX_TERRAIN_CHUNKS = 16384;
const MAX_CHUNK_COORD = MAX_TERRAIN_CELL_MAGNITUDE / TERRAIN_CHUNK_SIZE;

/**
 * Validate an untrusted terrain map (imports, cartridges) and return a
 * defensive copy. Throws on anything that could corrupt the document:
 * unknown versions, blank palette entries, malformed chunk keys, runs that
 * don't cover a chunk, or values pointing outside the palette.
 */
export function sanitizeTerrainMap(input: TerrainMap): TerrainMap {
  if (input.schemaVersion !== 1) {
    throw new Error(`Unsupported terrain schema version: ${String(input.schemaVersion)}`);
  }
  if (!Array.isArray(input.palette) || input.palette.length > MAX_TERRAIN_PALETTE) {
    throw new Error("Terrain palette is missing or too large");
  }
  const palette = input.palette.map((entry) => {
    if (typeof entry !== "string" || entry.trim().length === 0 || entry.length > 128) {
      throw new Error("Terrain palette entries must be non-empty asset ids");
    }
    return entry;
  });

  const entries = Object.entries(input.chunks ?? {});
  if (entries.length > MAX_TERRAIN_CHUNKS) {
    throw new Error("Terrain map has too many chunks");
  }
  const chunks: Record<string, number[]> = {};
  for (const [key, runs] of entries) {
    // Only canonical keys the codec itself would write: "00,0" or "-0,0"
    // would create ghost chunks that render but can never be read or erased
    // (found by adversarial review — reproduced as permanent ghost terrain).
    const [rawX, rawY] = key.split(",");
    const chunkX = Number(rawX);
    const chunkY = Number(rawY);
    if (!Number.isInteger(chunkX) || !Number.isInteger(chunkY) || `${chunkX},${chunkY}` !== key) {
      throw new Error(`Malformed terrain chunk key: ${key}`);
    }
    if (Math.abs(chunkX) > MAX_CHUNK_COORD || Math.abs(chunkY) > MAX_CHUNK_COORD) {
      throw new Error(`Terrain chunk key out of range: ${key}`);
    }
    const cells = decodeTerrainChunk(runs);
    for (const value of cells) {
      if (value > palette.length) {
        throw new Error("Terrain run value points outside the palette");
      }
    }
    if (cells.some((value) => value !== 0)) {
      chunks[key] = encodeTerrainChunk(cells);
    }
  }
  return { schemaVersion: 1, palette, chunks };
}

function chunkKey(cellX: number, cellY: number): string {
  return `${Math.floor(cellX / TERRAIN_CHUNK_SIZE)},${Math.floor(cellY / TERRAIN_CHUNK_SIZE)}`;
}

function cellIndex(cellX: number, cellY: number): number {
  const localX = mod(cellX, TERRAIN_CHUNK_SIZE);
  const localY = mod(cellY, TERRAIN_CHUNK_SIZE);
  return localY * TERRAIN_CHUNK_SIZE + localX;
}

/** Euclidean modulo: negative cells land in the right chunk slot. */
function mod(value: number, size: number): number {
  return ((value % size) + size) % size;
}
