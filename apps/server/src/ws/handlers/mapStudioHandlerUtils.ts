// Pure helpers of the Map Studio message handler (split from
// MapStudioMessageHandler for the 350-LOC cap): message-type narrowing,
// document summaries, the published-terrain derivation, and the generate
// replay detection. No state, no I/O.

import type {
  ClientMessage,
  MapDocument,
  MapDocumentSummary,
  MapPublishBackgroundMode,
  MapTerrainSnapshot,
} from "@herobyte/shared";

/**
 * Terrain rides the snapshot as data only when the client shipped an
 * elements-only background — attaching it under a legacy full-render
 * background would draw the terrain twice at the table. Always derived from
 * the SERVER's stored document (never from a client payload), point-in-time
 * cloned so later document edits can't mutate the published scene through a
 * shared reference. Mirrors the export's visibility rule: a hidden
 * terrain-kind layer publishes no terrain. The grid rides along because the
 * background SVG and the terrain share the DOCUMENT's lattice, independent
 * of the table's live grid setting.
 */
export function deriveMapTerrain(
  document: MapDocument,
  backgroundMode: MapPublishBackgroundMode | undefined,
): MapTerrainSnapshot | undefined {
  if (backgroundMode !== "elements-only") return undefined;
  const terrain = document.terrain;
  if (!terrain || Object.keys(terrain.chunks).length === 0) return undefined;
  const terrainLayer = document.layers.find((layer) => layer.kind === "terrain");
  if (terrainLayer && (!terrainLayer.visible || terrainLayer.opacity <= 0)) return undefined;
  return {
    terrain: structuredClone(terrain),
    grid: {
      size: document.grid.size,
      offsetX: document.grid.offsetX,
      offsetY: document.grid.offsetY,
    },
    // Matches renderTerrain's baked opacity so full and elements-only
    // publishes render identically.
    opacity: terrainLayer?.opacity ?? 1,
  };
}

/** The duplicate-id abort a re-run generate produces once its dedupe entry ages out. */
export const REPLAY_LANDED = new Error(
  "That dungeon already generated — it is already on the map. Undo it if you want a different one.",
);

export function alreadyApplied(error: unknown): boolean {
  return error instanceof Error && /^Map element already exists:/.test(error.message);
}

export function isMapStudioMessage(
  message: ClientMessage,
): message is Extract<ClientMessage, { t: `map-studio-${string}` }> {
  return message.t.startsWith("map-studio-");
}

export function toSummary(document: MapDocument): MapDocumentSummary {
  const { id, name, width, height, revision, createdAt, updatedAt } = document;
  return { id, name, width, height, revision, createdAt, updatedAt };
}
