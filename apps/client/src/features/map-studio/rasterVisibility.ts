// ============================================================================
// RASTER VISIBILITY — what may bake into a published map image
// ============================================================================
// The published raster ships to EVERY role unfiltered, so this is a privacy
// gate, not a rendering preference. It is the export path's counterpart to
// `deriveMapElements` (the live path's gate) and must agree with it.

import type { MapElement, MapLayer } from "@herobyte/shared";

/**
 * True when `element` may appear in the player-facing raster.
 *
 * NOTES LAYER: dropped wholesale, exactly as deriveMapElements drops notes-kind
 * layers before it even looks at element type. These two producers disagreed
 * once: only TEXT was protected here (by its own visibleToPlayers flag), so a DM
 * circling an ambush on GM Notes baked that ring into the art every player saw —
 * while the spawn text beside it correctly vanished, which is precisely the
 * evidence that would have convinced them the layer was honoured.
 *
 * DOORS: ordinary ones are LIVE-ONLY — DoorsLayer draws them from compiledScene,
 * so baking one leaves a dead line under the live door. SECRET ones bake AS WALL
 * (see the door branch in exportMapDocument): a player's doors list never
 * contains them, so nothing covers the one-cell gap their seam leaves in the
 * wall art, and a bare hole reads as "secret door here" with no socket
 * inspection at all.
 */
export function visibleInRaster(element: MapElement, layer?: MapLayer): boolean {
  if (!layer?.visible || layer.opacity <= 0 || layer.kind === "notes") return false;
  if (element.hidden) return false;
  if (element.type === "text") return element.data.visibleToPlayers;
  if (element.type === "door") return element.data.state === "secret";
  return true;
}
