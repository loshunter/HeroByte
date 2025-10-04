// ============================================================================
// SESSION PERSISTENCE UTILITIES
// ============================================================================
// Helpers to export and import complete room snapshots for offline storage.

import type { RoomSnapshot } from "@shared";

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
        const pointers = Array.isArray(parsed.pointers) ? parsed.pointers : [];
        const diceRolls = ensureArray(parsed.diceRolls ?? [], "diceRolls");

        if (typeof parsed.gridSize !== "number") {
          throw new Error("gridSize must be a number");
        }

        const snapshot: RoomSnapshot = {
          users: Array.isArray(parsed.users) ? parsed.users : [],
          tokens: tokens as RoomSnapshot["tokens"],
          players: players as RoomSnapshot["players"],
          characters: characters as RoomSnapshot["characters"],
          mapBackground:
            typeof parsed.mapBackground === "string" ? parsed.mapBackground : undefined,
          pointers: pointers as RoomSnapshot["pointers"],
          drawings: drawings as RoomSnapshot["drawings"],
          gridSize: parsed.gridSize,
          diceRolls: diceRolls as RoomSnapshot["diceRolls"],
        };

        resolve(snapshot);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Invalid session file"));
      }
    };

    reader.readAsText(file);
  });
}
