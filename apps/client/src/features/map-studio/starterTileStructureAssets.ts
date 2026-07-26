// Bundled STRUCTURAL tile assets — the legacy block, painted walls, stairs,
// roofs and dais — split from starterTileAssets for the 350-LOC cap (same
// pattern as starterTileObjectAssets). starterTileAssets spreads this array
// into MAP_STUDIO_TILE_ASSETS, so callers keep importing from
// "./starterTiles" and never see the split.

import type { MapStudioTileAsset } from "./starterTileAssets";

export const STRUCTURE_TILE_ASSETS: MapStudioTileAsset[] = [
  {
    // Legacy flat placeable block — the PAINTED wall families below are the
    // "walls that look like walls" (procedural top + rim + cast shadow).
    id: "structures:stone-wall",
    name: "Stone Block",
    category: "structures",
    layerKind: "walls",
    columns: 1,
    rows: 1,
    fill: "#64606a",
    stroke: "#9e96a5",
    accent: "#3f3b45",
  },
  // Painted wall families (Czepeku-style band walls). Fills match their
  // VILLAGE_TERRAIN bases (pinned by wallVariants.test) so the field bake and
  // the flat fallback/SVG export agree.
  {
    id: "terrain:wall-stone",
    name: "Stone Wall",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#b3a687",
    stroke: "#cabfa2",
    accent: "#4e4638",
  },
  {
    id: "terrain:wall-brick",
    name: "Brick Wall",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#9d6b52",
    stroke: "#bd9070",
    accent: "#452e22",
  },
  {
    id: "terrain:wall-timber",
    name: "Timber Wall",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#84613e",
    stroke: "#97744e",
    accent: "#33241a",
  },
  {
    id: "terrain:wall-dark",
    name: "Dark Wall",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#5d5f6c",
    stroke: "#868a9a",
    accent: "#26272e",
  },
  // Levels illusion: stairs (floor-height treads) and roofs (the tallest
  // painted plane — light fascia stroke, hard cast shadow).
  {
    id: "terrain:stairs-stone",
    name: "Stone Stairs",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#6d7280",
    stroke: "#8f95a5",
    accent: "#3f434d",
  },
  {
    id: "terrain:roof-shingle",
    name: "Shingle Roof",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#7d7787",
    stroke: "#b7ad92",
    accent: "#565064",
  },
  {
    id: "terrain:roof-thatch",
    name: "Thatch Roof",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#a08954",
    stroke: "#c4b183",
    accent: "#6e5c36",
  },
  // Round landmarks (polar-course engine): fills match their VILLAGE_TERRAIN
  // bases (pinned by polarCourse.test) so bake and flat fallback agree.
  {
    id: "terrain:roof-cone",
    name: "Cone Roof",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#6f6a7c",
    stroke: "#b7ad92",
    accent: "#565064",
  },
  {
    id: "terrain:roof-dome",
    name: "Dome Roof",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#31549b",
    stroke: "#8fa8dc",
    accent: "#22376b",
  },
  {
    id: "terrain:roof-thatch-spiral",
    name: "Spiral Thatch Roof",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#a28b4e",
    stroke: "#c9b67f",
    accent: "#6f5d34",
  },
  {
    id: "terrain:dais-stone",
    name: "Stone Dais",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#8b8f9c",
    stroke: "#b0b4c1",
    accent: "#5c6070",
  },
];
