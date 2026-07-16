// ============================================================================
// SESSION PERSISTENCE UTILITIES
// ============================================================================
// Export and import a complete session for offline storage.
//
// A session file is a SessionFile envelope: the room snapshot PLUS the authored
// map documents it references. The snapshot alone carries the map only as
// derived output (compiledScene/mapTerrain/mapElements) and a pointer, so a
// snapshot-only restore yields a map you can look at but not edit. See the
// SessionFile docs in @herobyte/shared.
//
// This is the DM's workaround for an ephemeral server filesystem (DEPLOYMENT.md):
// room state, maps, and secrets are all lost on a restart or idle spin-down, so
// the file has to be genuinely complete or it does not do its job.
//
// THE RULE HERE: SPREAD, NEVER WHITELIST. This loader used to rebuild the
// snapshot field-by-field from a hand-listed set, which silently dropped every
// field added after it was written — by the time the live-map arc landed it was
// discarding compiledScene, mapTerrain, mapElements, liveMapDocumentId, assets,
// fogEnabled and combatActive, so a "loaded" session came back with no map. A
// whitelist in a persistence path is a slow leak: it fails the moment someone
// adds a field and never says so. Validate what must be present, sanitize what
// must be safe, and pass the rest through untouched.

import type { PlayerStagingZone, RoomSnapshot, SessionFile } from "@herobyte/shared";

/**
 * Trigger a download of a complete session file.
 */
export function saveSessionFile(file: SessionFile, sessionName: string): void {
  const safeName = (sessionName || "session").trim() || "session";
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const fileName = `${safeName}-${timestamp}.json`;
  const json = JSON.stringify(file, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function ensureArray<T = unknown>(value: unknown, label: string): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value as T[];
}

function sanitizePlayerStagingZone(value: unknown): PlayerStagingZone | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const x = Number(value.x);
  const y = Number(value.y);
  const width = Number(value.width);
  const height = Number(value.height);

  if ([x, y, width, height].some((candidate) => !Number.isFinite(candidate))) {
    return undefined;
  }

  const rotation =
    value.rotation === undefined || Number.isNaN(Number(value.rotation))
      ? 0
      : Number(value.rotation);

  return {
    x,
    y,
    width: Math.max(0.5, Math.abs(width)),
    height: Math.max(0.5, Math.abs(height)),
    rotation,
  };
}

/**
 * Validate and normalize a room snapshot read from disk.
 *
 * Spread-first: everything the file carries survives, then the few fields that
 * need coercing are overridden.
 */
function parseSnapshot(parsed: Record<string, unknown>): RoomSnapshot {
  ensureArray(parsed.tokens, "tokens");
  ensureArray(parsed.players, "players");
  ensureArray(parsed.characters, "characters");
  ensureArray(parsed.props ?? [], "props");
  ensureArray(parsed.diceRolls ?? [], "diceRolls");
  // NOT required: `drawings`. The server's toSnapshot does not always emit the
  // key — a room with none emits neither it nor an assetRef — and demanding it
  // here rejected every file the new export wrote, at restore time, after the
  // wipe it existed to survive. This parser must never be stricter than the
  // server's own load validator; the server is the real gate.
  if (parsed.drawings !== undefined) {
    ensureArray(parsed.drawings, "drawings");
  }

  if (typeof parsed.gridSize !== "number") {
    throw new Error("gridSize must be a number");
  }

  return {
    ...(parsed as unknown as RoomSnapshot),
    users: Array.isArray(parsed.users) ? (parsed.users as RoomSnapshot["users"]) : [],
    props: (parsed.props ?? []) as RoomSnapshot["props"],
    drawings: (parsed.drawings ?? []) as RoomSnapshot["drawings"],
    pointers: (Array.isArray(parsed.pointers) ? parsed.pointers : []) as RoomSnapshot["pointers"],
    diceRolls: (parsed.diceRolls ?? []) as RoomSnapshot["diceRolls"],
    // mapBackground is NOT overridden: a file may carry it as a plain string
    // (flattened) or via assetRefs (a legacy file), and the server resolves
    // both. Coercing a non-string to undefined here silently dropped the map.
    playerStagingZone: sanitizePlayerStagingZone(parsed.playerStagingZone),
  };
}

/** A file written before session files carried their map documents. */
function isLegacyBareSnapshot(parsed: Record<string, unknown>): boolean {
  return parsed.snapshot === undefined;
}

/**
 * Read a session file. Accepts the current envelope and, for files saved before
 * it existed, a bare RoomSnapshot — those simply restore with no map documents,
 * which the server handles by clearing the live binding rather than dangling it.
 */
export function loadSession(file: File): Promise<SessionFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read session file"));
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(reader.result as string);
        if (!isRecord(parsed)) {
          throw new Error("Invalid session data");
        }

        if (isLegacyBareSnapshot(parsed)) {
          resolve({
            schemaVersion: 1,
            savedAt: 0,
            snapshot: parseSnapshot(parsed),
            mapDocuments: [],
          });
          return;
        }

        if (!isRecord(parsed.snapshot)) {
          throw new Error("Invalid session data: snapshot must be an object");
        }

        resolve({
          schemaVersion: 1,
          savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
          snapshot: parseSnapshot(parsed.snapshot),
          mapDocuments: Array.isArray(parsed.mapDocuments)
            ? (parsed.mapDocuments as SessionFile["mapDocuments"])
            : [],
          liveMapDocumentId:
            typeof parsed.liveMapDocumentId === "string" ? parsed.liveMapDocumentId : undefined,
          // Absent in files saved before assets were inlined, and in sessions
          // that only use external image URLs. Both are normal.
          assets: Array.isArray(parsed.assets) ? (parsed.assets as SessionFile["assets"]) : [],
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Invalid session file"));
      }
    };

    reader.readAsText(file);
  });
}
