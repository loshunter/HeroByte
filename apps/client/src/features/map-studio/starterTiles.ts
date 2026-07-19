// Tile-asset lookup + style resolvers over the bundled asset data
// (starterTileAssets, re-exported below) and content-addressed uploads.

import { uploadHashFromAssetId, uploadedAssetUrl } from "./uploads/assetUpload";
import { MAP_STUDIO_TILE_ASSETS, type MapStudioTileAsset } from "./starterTileAssets";

export { MAP_STUDIO_TILE_ASSETS } from "./starterTileAssets";
export type { MapStudioTileAsset } from "./starterTileAssets";

/** Neutral chrome shown behind/around image-backed (uploaded) assets. */
export const MY_STUFF_FILL = "#2b2f3d";
export const MY_STUFF_STROKE = "#8a7445";

const FALLBACK_TILE_ASSET: MapStudioTileAsset = {
  id: "unknown",
  name: "Unknown Tile",
  category: "terrain",
  layerKind: "terrain",
  columns: 1,
  rows: 1,
  fill: "#5d5668",
  stroke: "#ffcc66",
  accent: "#2d2938",
};

export function getMapStudioTileAsset(assetId: string): MapStudioTileAsset {
  const bundled = MAP_STUDIO_TILE_ASSETS.find((asset) => asset.id === assetId);
  if (bundled) return bundled;
  // Uploads are content-addressed, so any client can synthesize a renderable
  // asset from the id alone — no local "My Stuff" inventory required.
  const uploadHash = uploadHashFromAssetId(assetId);
  if (uploadHash) {
    return {
      id: assetId,
      name: "Uploaded image",
      category: "my-stuff",
      layerKind: "objects",
      columns: 1,
      rows: 1,
      fill: MY_STUFF_FILL,
      stroke: MY_STUFF_STROKE,
      imageUrl: uploadedAssetUrl(uploadHash),
    };
  }
  return FALLBACK_TILE_ASSET;
}

/** The fill for a given animation frame; the static `fill` when not animated. */
export function terrainFillForFrame(asset: MapStudioTileAsset, frame: number): string {
  const frames = asset.animFills;
  if (!frames || frames.length === 0) return asset.fill;
  return frames[((frame % frames.length) + frames.length) % frames.length]!;
}

/**
 * Style resolver for the canvas tile renderer (tileRenderCore): the family's
 * frame-cycled fill plus its boundary stroke. Frame 0 matches the SVG export.
 */
export function terrainStyleForFrame(
  assetId: string,
  frame: number,
): { fill: string; stroke: string } {
  const asset = getMapStudioTileAsset(assetId);
  return { fill: terrainFillForFrame(asset, frame), stroke: asset.stroke };
}

export function mapStudioTileCategoryLabel(category: MapStudioTileAsset["category"]): string {
  switch (category) {
    case "terrain":
      return "Terrain";
    case "structures":
      return "Structures";
    case "objects":
      return "Objects";
    case "my-stuff":
      return "My Stuff";
  }
}
