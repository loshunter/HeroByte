// The bundled tile-asset DATA — split from starterTiles (the lookup/style API)
// for the 350-LOC cap as the painted families grow. starterTiles re-exports
// everything here, so callers keep importing from "./starterTiles".

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
  /**
   * Per-frame fills for the shared 300ms animation clock (SNES palette
   * cycling). Frame 0 MUST equal `fill` so the static/export render is
   * unchanged; the live canvas cycles through the rest.
   */
  animFills?: string[];
}

export const MAP_STUDIO_TILE_ASSETS: MapStudioTileAsset[] = [
  // The two ORIGINAL floors keep their ids and fills (the frozen SVG golden
  // pins painted terrain:stone-floor); only their display names carry the
  // variant they always were. The four variant floors below are new ids —
  // pure data over the same procedural floor painters (see terrainPalette).
  {
    id: "terrain:stone-floor",
    name: "Flagstone Floor",
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
    name: "Oak Floor",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#725236",
    stroke: "#a5774b",
    accent: "#553b27",
  },
  {
    id: "terrain:stone-cobble",
    name: "Cobblestone Floor",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#5e5b50",
    stroke: "#8a8778",
    accent: "#46443c",
  },
  {
    id: "terrain:stone-sandstone",
    name: "Sandstone Floor",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#8a7454",
    stroke: "#b39a72",
    accent: "#6a583f",
  },
  {
    id: "terrain:wood-walnut",
    name: "Walnut Floor",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#4f3526",
    stroke: "#7a5a42",
    accent: "#3a2719",
  },
  {
    id: "terrain:wood-grey",
    name: "Grey Plank Floor",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#6a675e",
    stroke: "#928f83",
    accent: "#4f4d45",
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
    // Gentle 4-frame shimmer; frame 0 is the base fill so export is unchanged.
    animFills: ["#24516b", "#295a76", "#2a5f7c", "#245572"],
  },
  // Sunken architecture (Water II): drowned floor/stairs siblings painted into
  // a water body. Fills match their VILLAGE_TERRAIN pre-drowned bases (pinned
  // by sunkenVariants.test) so the field bake and the flat fallback agree.
  {
    id: "terrain:sunken-flagstone",
    name: "Sunken Flagstone",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#3d5265",
    stroke: "#5f7488",
    accent: "#33485a",
  },
  {
    id: "terrain:sunken-stairs",
    name: "Sunken Stairs",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#506578",
    stroke: "#72879a",
    accent: "#344959",
  },
  // Tileset v1 families (atlas-textured on canvas; the fills below are the
  // atlas averages, used for the Shelf swatch, the SVG export, and as the
  // flat fallback until the atlas image loads).
  {
    id: "terrain:grass",
    name: "Grass",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#386820",
    stroke: "#5c9a3c",
    accent: "#24471a",
  },
  {
    id: "terrain:dirt",
    name: "Dirt",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#4a2f1b",
    stroke: "#7a5232",
    accent: "#33200f",
  },
  {
    id: "terrain:path",
    name: "Path",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#5f6831",
    stroke: "#8f9853",
    accent: "#3f451f",
  },
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
