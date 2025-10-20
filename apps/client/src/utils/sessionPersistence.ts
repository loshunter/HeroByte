// ============================================================================
// SESSION PERSISTENCE UTILITIES
// ============================================================================
// Helpers to export and import complete room snapshots for offline storage.

import type { PlayerStagingZone, RoomSnapshot } from "@shared";

/**
 * Trigger a download of the provided room snapshot as a JSON file.
 */
export function saveSession(snapshot: RoomSnapshot, sessionName: string): void {
  const safeName = (sessionName || "session").trim() || "session";
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const fileName = `${safeName}-${timestamp}.json`;
  const json = JSON.stringify(snapshot, null, 2);
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
 * Load a room snapshot from a selected JSON file.
 */
export function loadSession(file: File): Promise<RoomSnapshot> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read session file"));
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const parsed = JSON.parse(text);
        if (!isRecord(parsed)) {
          throw new Error("Invalid session data");
        }

        const tokens = ensureArray(parsed.tokens, "tokens");
        const players = ensureArray(parsed.players, "players");
        const drawings = ensureArray(parsed.drawings, "drawings");
        const characters = ensureArray(parsed.characters, "characters");
        const props = ensureArray(parsed.props ?? [], "props");
        const pointers = Array.isArray(parsed.pointers) ? parsed.pointers : [];
        const diceRolls = ensureArray(parsed.diceRolls ?? [], "diceRolls");

        if (typeof parsed.gridSize !== "number") {
          throw new Error("gridSize must be a number");
        }

        const sceneObjects = Array.isArray(parsed.sceneObjects)
          ? (parsed.sceneObjects as RoomSnapshot["sceneObjects"])
          : undefined;
        const stagingZone = sanitizePlayerStagingZone(parsed.playerStagingZone);

        const snapshot: RoomSnapshot = {
          users: Array.isArray(parsed.users) ? parsed.users : [],
          tokens: tokens as RoomSnapshot["tokens"],
          players: players as RoomSnapshot["players"],
          characters: characters as RoomSnapshot["characters"],
          props: props as RoomSnapshot["props"],
          mapBackground:
            typeof parsed.mapBackground === "string" ? parsed.mapBackground : undefined,
          pointers: pointers as RoomSnapshot["pointers"],
          drawings: drawings as RoomSnapshot["drawings"],
          gridSize: parsed.gridSize,
          diceRolls: diceRolls as RoomSnapshot["diceRolls"],
          gridSquareSize:
            typeof parsed.gridSquareSize === "number" ? parsed.gridSquareSize : undefined,
          sceneObjects,
          playerStagingZone: stagingZone,
        };

        resolve(snapshot);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Invalid session file"));
      }
    };

    reader.readAsText(file);
  });
}
