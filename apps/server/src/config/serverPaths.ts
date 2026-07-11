// ============================================================================
// SERVER PATHS — anchor on-disk stores to the package, not the launch dir
// ============================================================================
// Default storage paths (state files, the asset store) used to be CWD-relative
// ("./herobyte-state.json", "./herobyte-assets"), so launching from the repo
// root vs apps/server silently forked every store into two divergent copies —
// both were found in the tree. Resolving against the package root makes the
// default stable no matter where the process starts. Explicit overrides
// (constructor options, HEROBYTE_ASSET_DIR, ROOM_STATE_FILE) pass through
// untouched: an explicit path is the caller's business.

import path from "node:path";
import { fileURLToPath } from "node:url";

// src/config and dist/config sit at the same depth below the package root, so
// this resolves identically under `tsx src/index.ts` and `node dist/index.js`.
const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Resolve a store path against the vtt-server package root. Absolute paths pass through. */
export function resolveServerPath(storePath: string): string {
  return path.isAbsolute(storePath) ? storePath : path.resolve(SERVER_ROOT, storePath);
}
