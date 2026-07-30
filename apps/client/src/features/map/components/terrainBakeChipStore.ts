// The bake-progress chip's tiny module store, kept DEPENDENCY-FREE on purpose:
// TerrainBakeChip mounts in the eagerly-bundled layout, so importing it must
// not pull the terrain render machinery into the entry chunk. The async bake
// manager (terrainBakeAsync, lazy with MapBoard) publishes into it.

export interface TerrainBakeChipState {
  pending: boolean;
  progress: number;
}

const CHIP_IDLE: TerrainBakeChipState = { pending: false, progress: 1 };
let chipState: TerrainBakeChipState = CHIP_IDLE;
const chipListeners = new Set<() => void>();

export function getTerrainBakeChipState(): TerrainBakeChipState {
  return chipState;
}

export function getTerrainBakeChipServerState(): TerrainBakeChipState {
  return CHIP_IDLE;
}

export function subscribeTerrainBakeChip(listener: () => void): () => void {
  chipListeners.add(listener);
  return () => chipListeners.delete(listener);
}

export function publishTerrainBakeChip(pending: boolean, progress: number): void {
  if (pending !== chipState.pending || progress !== chipState.progress) {
    chipState = { pending, progress };
  }
  for (const listener of [...chipListeners]) listener();
}
