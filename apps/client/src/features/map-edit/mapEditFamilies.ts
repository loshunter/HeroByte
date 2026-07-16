// Maps an asset id back to a floor family, so the eyedropper can re-arm the
// floor picker when it samples a terrain tile (e.g. "terrain:grass" → "grass").

import type { MapEditFloorFamily } from "./mapEditTypes";

const FLOOR_FAMILIES: MapEditFloorFamily[] = [
  "grass",
  "dirt",
  "path",
  "stone-floor",
  "wood-floor",
  "stone-cobble",
  "stone-sandstone",
  "wood-walnut",
  "wood-grey",
];

/** The floor family an asset id names (terrain:<family>), or null. */
export function floorFamilyFromAssetId(assetId: string): MapEditFloorFamily | null {
  const family = assetId.startsWith("terrain:") ? assetId.slice("terrain:".length) : "";
  return (FLOOR_FAMILIES as string[]).includes(family) ? (family as MapEditFloorFamily) : null;
}

export function isFloorFamilyAssetId(assetId: string): boolean {
  return floorFamilyFromAssetId(assetId) !== null;
}
