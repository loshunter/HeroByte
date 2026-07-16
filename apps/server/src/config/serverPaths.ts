// ============================================================================
// SERVER PATHS — anchor on-disk stores to the package, not the launch dir
// ============================================================================
// Default storage paths (state files, the asset store) used to be CWD-relative
// ("./herobyte-state.json", "./herobyte-assets"), so launching from the repo
// root vs apps/server silently forked every store into two divergent copies —
// both were found in the tree. Resolving against the package root makes the
// default stable no matter where the process starts. Explicit overrides
// (constructor options, HEROBYTE_ASSET_DIR, ROOM_STATE_FILE,
// HEROBYTE_MAP_STORE_FILE) pass through untouched: an explicit path is the
// caller's business. Every on-disk store default must anchor here — the room
// state files, the asset store, the Map Studio store, and the room-secret
// file all do; a bare "./" default silently forks the store per launch dir.

import path from "node:path";
import { fileURLToPath } from "node:url";

// src/config and dist/config sit at the same depth below the package root, so
// this resolves identically under `tsx src/index.ts` and `node dist/index.js`.
const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Resolve a store path. Absolute paths pass through. Relative paths anchor to
 * HEROBYTE_DATA_DIR when set — the one lever that moves EVERY store default
 * onto a persistent disk (mount at /var/data, set HEROBYTE_DATA_DIR=/var/data,
 * done) — and to the vtt-server package root otherwise. Read per call, not at
 * module load, so tests can vary it without a module-cache reset.
 */
export function resolveServerPath(storePath: string): string {
  if (path.isAbsolute(storePath)) {
    return storePath;
  }
  const dataDir = process.env.HEROBYTE_DATA_DIR?.trim();
  // A relative HEROBYTE_DATA_DIR anchors to the package root itself, so the
  // resolved path is still launch-dir independent.
  return path.resolve(SERVER_ROOT, dataDir || "", storePath);
}
