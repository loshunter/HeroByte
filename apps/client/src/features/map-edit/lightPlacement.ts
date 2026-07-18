// The 💡 Light click tool: one click drops a warm torch-pool light element on
// the lighting layer, snapped to the clicked cell's centre. Pure helpers
// (React-free) so the placement math is unit-testable; the pool renders
// through the terrain bake's lighting pass, and the pools only show once the
// DM dims the Lighting layer's opacity below 1 (the ambient light level).

import type { MapDocument, MapLayer } from "@herobyte/shared";
import type { MapLightDraft, MapStudioController } from "../map-studio/types";

/** Torch defaults: a ~3.5-cell warm pool at full intensity. */
const LIGHT_RADIUS_CELLS = 3.5;
const LIGHT_COLOR = "#ffc06a";
const LIGHT_INTENSITY = 1;

/** The first lighting-kind layer, or null (a fresh document always has one). */
export function findLightingLayer(layers: Iterable<MapLayer>): MapLayer | null {
  for (const layer of layers) {
    if (layer.kind === "lighting") return layer;
  }
  return null;
}

/** Build the light draft for a document-space click, or null without a
 * lighting layer. Snaps to the clicked cell's centre so torches line up. */
export function lightDraftAt(
  document: MapDocument,
  point: { x: number; y: number },
): MapLightDraft | null {
  const lightingLayer = findLightingLayer(document.layers);
  if (!lightingLayer) return null;
  const { size, offsetX, offsetY } = document.grid;
  const cellX = Math.floor((point.x - offsetX) / size);
  const cellY = Math.floor((point.y - offsetY) / size);
  return {
    layerId: lightingLayer.id,
    x: offsetX + (cellX + 0.5) * size,
    y: offsetY + (cellY + 0.5) * size,
    radius: LIGHT_RADIUS_CELLS * size,
    color: LIGHT_COLOR,
    intensity: LIGHT_INTENSITY,
  };
}

/** Place a light at the click point; returns the element id or null. */
export function placeLightAt(
  controller: MapStudioController,
  document: MapDocument,
  point: { x: number; y: number },
): string | null {
  const draft = lightDraftAt(document, point);
  return draft ? controller.addLight(draft) : null;
}
