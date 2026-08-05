// ============================================================================
// DRAWING SANITISERS FOR THE CHARACTER FILE
// ============================================================================
// Extracted from playerPersistence (S6): a saved character is a text file on
// the player's disk that is edited, shared and reloaded, and loading one
// REPLACES that player's drawings for the whole table via
// sync-player-drawings. Everything that decides what survives that round trip
// lives here, in one place, rather than mixed in with player stats.

import { coerceAreaTemplate } from "@herobyte/shared";
import type { Drawing } from "@herobyte/shared";

export const MAX_DRAWING_POINTS = 10_000;

// "template" is here for the same reason as the rest: an unlisted type is
// silently rewritten to "freehand" on import, which would turn a saved cone
// into a scribble and push the corruption back to the table.
const VALID_DRAWING_TYPES = ["circle", "line", "rect", "freehand", "eraser", "template"] as const;
type ValidDrawingType = (typeof VALID_DRAWING_TYPES)[number];

/** Only ever mints DRAWING ids, so it belongs beside the sanitisers. */
function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `draw-${Math.random().toString(36).slice(2, 10)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function cloneDrawingForExport(drawing: Drawing): Drawing {
  const points = Array.isArray(drawing.points)
    ? drawing.points.slice(0, MAX_DRAWING_POINTS).map((point) => ({
        x: Number(point.x) || 0,
        y: Number(point.y) || 0,
      }))
    : [];

  return {
    id:
      typeof drawing.id === "string" && drawing.id.trim().length > 0
        ? drawing.id.trim()
        : generateId(),
    type: drawing.type,
    points,
    color: drawing.color,
    width: drawing.width,
    opacity: drawing.opacity,
    filled: drawing.filled,
    // Without this an exported template loses the metadata that names it, and
    // comes back as an unlabelled polygon.
    template: coerceAreaTemplate(drawing.template),
  };
}

export function sanitizeDrawingFromImport(raw: unknown, index: number): Drawing | null {
  if (!isRecord(raw)) {
    console.warn(`Skipping drawing[${index}] - not an object`);
    return null;
  }

  const id = typeof raw.id === "string" && raw.id.trim().length > 0 ? raw.id.trim() : generateId();
  const typeRaw = typeof raw.type === "string" ? raw.type.trim() : "";
  const type: ValidDrawingType = VALID_DRAWING_TYPES.includes(typeRaw as ValidDrawingType)
    ? (typeRaw as ValidDrawingType)
    : "freehand";

  if (!Array.isArray(raw.points) || raw.points.length === 0) {
    console.warn(`Skipping drawing[${index}] - missing points array`);
    return null;
  }

  const points =
    raw.points
      .slice(0, MAX_DRAWING_POINTS)
      .map((point) =>
        isRecord(point) && isFiniteNumber(point.x) && isFiniteNumber(point.y)
          ? { x: point.x, y: point.y }
          : null,
      )
      .filter((point): point is { x: number; y: number } => point !== null) ?? [];

  if (points.length === 0) {
    console.warn(`Skipping drawing[${index}] - invalid points`);
    return null;
  }

  const color =
    typeof raw.color === "string" && raw.color.trim().length > 0 ? raw.color.trim() : "#ffffff";
  const width = isFiniteNumber(raw.width) && raw.width > 0 ? Math.min(raw.width, 200) : 5;
  const opacity =
    isFiniteNumber(raw.opacity) && raw.opacity >= 0 && raw.opacity <= 1 ? raw.opacity : 1;
  const filled =
    raw.filled === undefined ? undefined : typeof raw.filled === "boolean" ? raw.filled : undefined;

  return {
    id,
    type,
    points,
    color,
    width,
    opacity,
    filled,
    template: coerceAreaTemplate(raw.template),
  };
}
