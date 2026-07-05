import { MY_STUFF_FILL, MY_STUFF_STROKE, type MapStudioTileAsset } from "../starterTiles";
import { uploadAssetId, uploadedAssetUrl } from "./assetUpload";
import type { MyStuffAsset } from "./myStuffStore";

/** Bundled art is authored at 50px per cell; uploads default to the same scale. */
export const MY_STUFF_CELL_SIZE = 50;
const MAX_FOOTPRINT_CELLS = 6;

export function paletteAssetFromMyStuff(asset: MyStuffAsset): MapStudioTileAsset {
  return {
    id: uploadAssetId(asset.hash),
    name: asset.name,
    category: "my-stuff",
    layerKind: "objects",
    columns: footprintCells(asset.width),
    rows: footprintCells(asset.height),
    fill: MY_STUFF_FILL,
    stroke: MY_STUFF_STROKE,
    imageUrl: uploadedAssetUrl(asset.hash),
  };
}

function footprintCells(pixels: number | undefined): number {
  if (!pixels || !Number.isFinite(pixels) || pixels <= 0) return 1;
  return Math.max(1, Math.min(MAX_FOOTPRINT_CELLS, Math.round(pixels / MY_STUFF_CELL_SIZE)));
}
