import { useMemo } from "react";
import {
  MAP_STUDIO_TILE_ASSETS,
  getMapStudioTileAsset,
  type MapStudioTileAsset,
} from "../starterTiles";
import type { MyStuffAsset } from "../uploads/myStuffStore";
import { paletteAssetFromMyStuff } from "../uploads/paletteAssets";
import type { TileCategory } from "./MapStudioWorkspace.types";

interface StudioPaletteAssetsOptions {
  category: TileCategory;
  selectedAssetId: string;
  myStuff: MyStuffAsset[];
}

/** Room Brush dropdown sources — static slices of the bundled palette. */
const FLOOR_ASSETS = MAP_STUDIO_TILE_ASSETS.filter((asset) => asset.layerKind === "terrain");
const WALL_ASSETS = MAP_STUDIO_TILE_ASSETS.filter((asset) => asset.layerKind === "walls");

/** Merges the bundled palette with the uploaded "My Stuff" shelf. */
export function useStudioPaletteAssets({
  category,
  selectedAssetId,
  myStuff,
}: StudioPaletteAssetsOptions): {
  myStuffAssets: MapStudioTileAsset[];
  visibleAssets: MapStudioTileAsset[];
  selectedAsset: MapStudioTileAsset;
  floorAssets: MapStudioTileAsset[];
  wallAssets: MapStudioTileAsset[];
} {
  const myStuffAssets = useMemo(() => myStuff.map(paletteAssetFromMyStuff), [myStuff]);

  const visibleAssets = useMemo(
    () =>
      category === "my-stuff"
        ? myStuffAssets
        : MAP_STUDIO_TILE_ASSETS.filter((asset) => asset.category === category),
    [category, myStuffAssets],
  );

  // The local inventory wins (real name, measured footprint); failing that,
  // an upload id alone still synthesizes a renderable asset.
  const selectedAsset = useMemo(
    () =>
      myStuffAssets.find((asset) => asset.id === selectedAssetId) ??
      getMapStudioTileAsset(selectedAssetId),
    [myStuffAssets, selectedAssetId],
  );

  return {
    myStuffAssets,
    visibleAssets,
    selectedAsset,
    floorAssets: FLOOR_ASSETS,
    wallAssets: WALL_ASSETS,
  };
}
