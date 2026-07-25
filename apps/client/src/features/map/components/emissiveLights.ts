// Emissive scenery → bake lights (Light & Colour II, E3). A placed prop whose
// bundled asset carries `emissive` (lamp orb, brazier…) contributes a light
// pool automatically — no separate 💡 placement step. Derived CLIENT-side from
// snapshot.mapElements, which deriveMapElements has already privacy-filtered
// (hidden props and invisible/notes layers never reach it), so emissive lights
// inherit the player-safe rules of the scenery they ride for free, and every
// client derives the identical list from the identical snapshot.

import type {
  MapElementsSnapshot,
  MapLightingSnapshot,
  RenderableMapElement,
} from "@herobyte/shared";
import { getMapStudioTileAsset } from "../../map-studio/starterTiles";

/** The prop kinds that can carry a bundled asset — and therefore a glow. A
 * grid-snapped `tile` sizes in CELLS (columns/rows); a free-placed `stamp` —
 * what Alt-place, Scatter and POPULATE all emit — sizes in PX (width/height).
 * Both gestures place the same asset, so both must glow: keying the light off
 * the element KIND made the glow depend on which modifier key the DM held
 * (confirmed review finding). */
type PropElement = Extract<RenderableMapElement, { type: "tile" | "stamp" }>;

const isProp = (element: RenderableMapElement): element is PropElement =>
  element.type === "tile" || element.type === "stamp";

/** The prop's unrotated footprint in world px. */
const footprintPx = (element: PropElement, cellSize: number): { w: number; h: number } =>
  element.type === "tile"
    ? { w: element.data.columns * cellSize, h: element.data.rows * cellSize }
    : { w: element.data.width, h: element.data.height };

/**
 * The lighting the terrain bake should use: the snapshot's explicit lighting
 * channel plus one light per visible emissive prop, centred on the prop
 * (unrotated centre — lamplight does not need degree precision), radius
 * converted from asset CELLS to world px through the snapshot grid. With no
 * emissive props this returns the snapshot's own lighting UNCHANGED (same
 * reference), so knob-less maps keep their exact lighting signature.
 */
export function withEmissiveLights(
  mapElements: MapElementsSnapshot | undefined,
): MapLightingSnapshot | undefined {
  if (!mapElements) return undefined;
  const size = mapElements.grid.size;
  const emissive: MapLightingSnapshot["lights"] = [];
  for (const layer of mapElements.layers) {
    for (const element of layer.elements) {
      if (!isProp(element)) continue;
      const glow = getMapStudioTileAsset(element.data.assetId).emissive;
      if (!glow) continue;
      const footprint = footprintPx(element, size);
      emissive.push({
        id: `emissive:${element.id}`,
        x: element.transform.x + (footprint.w * element.transform.scaleX) / 2,
        y: element.transform.y + (footprint.h * element.transform.scaleY) / 2,
        radius: glow.radius * size,
        color: glow.color,
        intensity: glow.intensity,
      });
    }
  }
  if (emissive.length === 0) return mapElements.lighting;
  return {
    ambient: mapElements.lighting?.ambient ?? 1,
    lights: [...(mapElements.lighting?.lights ?? []), ...emissive],
  };
}
