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

import { existsSync } from "node:fs";
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

/**
 * Boot-time guard against silently-ephemeral storage. Call before ANY store
 * touches disk (AuthService reads the secret file in its constructor).
 *
 * Two failure modes, both previously silent:
 *
 * 1. HEROBYTE_DATA_DIR set but the directory missing — the persistent disk is
 *    not mounted, or the path is a typo. Every store would then error on each
 *    write (the parent dir does not exist) while the operator believes state
 *    is durable. Refused everywhere, dev included: create the directory or fix
 *    the variable.
 *
 * 2. Production with HEROBYTE_DATA_DIR unset — every store lands on the
 *    ephemeral filesystem and evaporates on redeploy. "Production" is either
 *    latch: NODE_ENV=production (a documented Render checklist item — see
 *    config/security.ts for why it is never trusted ALONE) or RENDER=true
 *    (which the Render platform itself sets, so a missed checkbox cannot fail
 *    this open). A diskless self-host is still a documented path, so
 *    HEROBYTE_ALLOW_EPHEMERAL_DATA=true opts in explicitly.
 *
 * Throws (bootstrap exits 1) rather than warns: D3's lesson is that a log
 * line under a wall of boot output protects nobody.
 */
export function assertDataDirUsable(): void {
  const dataDir = process.env.HEROBYTE_DATA_DIR?.trim();
  const resolvedRoot = path.resolve(SERVER_ROOT, dataDir || "");

  if (dataDir && !existsSync(resolvedRoot)) {
    throw new Error(
      `HEROBYTE_DATA_DIR points at "${resolvedRoot}" which does not exist. ` +
        `If this is a persistent disk, it is not mounted; if it is a local path, create it. ` +
        `Refusing to start rather than silently writing to ephemeral storage.`,
    );
  }

  const isProductionLike = process.env.NODE_ENV === "production" || process.env.RENDER === "true";
  if (
    !dataDir &&
    isProductionLike &&
    process.env.HEROBYTE_ALLOW_EPHEMERAL_DATA?.trim().toLowerCase() !== "true"
  ) {
    throw new Error(
      `HEROBYTE_DATA_DIR is not set in production, so every store (room state, ` +
        `passwords, uploads, maps) would be wiped on the next redeploy. Set it to the ` +
        `persistent disk's mount path (see DEPLOYMENT.md §1F), or set ` +
        `HEROBYTE_ALLOW_EPHEMERAL_DATA=true to accept ephemeral storage explicitly.`,
    );
  }

  console.log(
    `[Storage] Data dir: ${resolvedRoot}` +
      (dataDir ? "" : " (HEROBYTE_DATA_DIR unset — package-root default)"),
  );
}
