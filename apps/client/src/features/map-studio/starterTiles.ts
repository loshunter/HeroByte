import { uploadHashFromAssetId, uploadedAssetUrl } from "./uploads/assetUpload";

/** Neutral chrome shown behind/around image-backed (uploaded) assets. */
export const MY_STUFF_FILL = "#2b2f3d";
export const MY_STUFF_STROKE = "#8a7445";

export interface MapStudioTileAsset {
  id: string;
  name: string;
  category: "terrain" | "structures" | "objects" | "my-stuff";
  layerKind: "terrain" | "objects" | "walls";
  columns: number;
  rows: number;
  fill: string;
  stroke: string;
  accent?: string;
  /** Image-backed assets (uploads) render this instead of the color swatch. */
  imageUrl?: string;
}

export const MAP_STUDIO_TILE_ASSETS: MapStudioTileAsset[] = [
  {
    id: "terrain:stone-floor",
    name: "Stone Floor",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#4d5361",
    stroke: "#6e7688",
    accent: "#373c47",
  },
  {
    id: "terrain:wood-floor",
    name: "Wood Floor",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#725236",
    stroke: "#a5774b",
    accent: "#553b27",
  },
  {
    id: "terrain:water",
    name: "Water",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#24516b",
    stroke: "#48a7bd",
    accent: "#72d3df",
  },
  {
    id: "structures:stone-wall",
    name: "Stone Wall",
    category: "structures",
    layerKind: "walls",
    columns: 1,
    rows: 1,
    fill: "#64606a",
    stroke: "#9e96a5",
    accent: "#3f3b45",
  },
  {
    id: "objects:crate",
    name: "Crate",
    category: "objects",
    layerKind: "objects",
    columns: 1,
    rows: 1,
    fill: "#8c5a2e",
    stroke: "#d19a5f",
    accent: "#4b2f1b",
  },
  {
    id: "objects:table",
    name: "Table",
    category: "objects",
    layerKind: "objects",
    columns: 2,
    rows: 1,
    fill: "#6b3f28",
    stroke: "#c38753",
    accent: "#2e1b12",
  },
];

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
