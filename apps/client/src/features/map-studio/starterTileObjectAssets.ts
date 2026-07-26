// Bundled OBJECT and DECAL assets — split from starterTileAssets (the terrain
// and structure entries) for the 350-LOC cap, precedent terrainMaterialPalettes.
// starterTileAssets spreads this array into MAP_STUDIO_TILE_ASSETS, so callers
// keep importing from "./starterTiles" and never see the split.
//
// Decal entries are the groundDecal wear stamps (taxonomy catalog rank 8):
// their `decal` routing makes MapElementsLayer and the SVG export draw the
// procedural wear art (features/render/wearStampDetail) instead of the flat
// colour rect. `fill`/`stroke` still matter — they are the picker swatch and
// the drag ghost. A stain's `decal.color` is the prop-declared hue; the
// element tint (inspector) overrides it per placement.

import type { MapStudioTileAsset } from "./starterTileAssets";

export const OBJECT_TILE_ASSETS: MapStudioTileAsset[] = [
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
  {
    id: "objects:lamp",
    name: "Street Lamp",
    category: "objects",
    layerKind: "objects",
    columns: 1,
    rows: 1,
    fill: "#e8b84a",
    stroke: "#8a6b2f",
    accent: "#5c4720",
    emissive: { color: "#ffcf70", radius: 3, intensity: 1 },
  },
  {
    id: "decal:wear-ring",
    name: "Sparring Ring",
    category: "decals",
    layerKind: "objects",
    columns: 3,
    rows: 3,
    fill: "#c9925f",
    stroke: "#8e5f36",
    accent: "#a8713f",
    decal: { kind: "ring" },
  },
  {
    id: "decal:scorch",
    name: "Scorch Crater",
    category: "decals",
    layerKind: "objects",
    columns: 3,
    rows: 3,
    fill: "#5b4c3e",
    stroke: "#2b241e",
    accent: "#91785c",
    decal: { kind: "scorch" },
  },
  {
    id: "decal:stain-dye",
    name: "Dye Stain",
    category: "decals",
    layerKind: "objects",
    columns: 2,
    rows: 2,
    fill: "#ad315d",
    stroke: "#7a2145",
    accent: "#8e2748",
    decal: { kind: "stain", color: "#ad315d" },
  },
  {
    id: "decal:stain-ink",
    name: "Ink Smudge",
    category: "decals",
    layerKind: "objects",
    columns: 2,
    rows: 2,
    fill: "#3a3f45",
    stroke: "#22262b",
    accent: "#2c3036",
    decal: { kind: "stain", color: "#3a3f45" },
  },
  {
    id: "decal:stain-wax",
    name: "Wax Drips",
    category: "decals",
    layerKind: "objects",
    columns: 2,
    rows: 2,
    fill: "#e8dcb0",
    stroke: "#b3a578",
    accent: "#cfc094",
    decal: { kind: "stain", color: "#e8dcb0" },
  },
];
