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
  const key = chunkKey(cellX, cellY);
  const cells = map.chunks[key]
    ? decodeTerrainChunk(map.chunks[key]!)
    : new Array<number>(CHUNK_CELLS).fill(0);

  let palette = map.palette;
  let value = 0;
  if (assetId !== null) {
    const existing = palette.indexOf(assetId);
    if (existing >= 0) {
      value = existing + 1;
    } else {
      palette = [...palette, assetId];
      value = palette.length;
    }
  }

  const index = cellIndex(cellX, cellY);
  if (cells[index] === value && palette === map.palette) return map;
  cells[index] = value;

  const chunks = { ...map.chunks };
  if (cells.every((cell) => cell === 0)) {
    delete chunks[key];
  } else {
    chunks[key] = encodeTerrainChunk(cells);
  }
  return { schemaVersion: 1, palette, chunks };
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
