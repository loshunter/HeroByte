// The bundled tile-asset DATA — split from starterTiles (the lookup/style API)
// for the 350-LOC cap as the painted families grow. starterTiles re-exports
// everything here, so callers keep importing from "./starterTiles". The
// object/decal entries live in starterTileObjectAssets (same cap), spread in
// at the bottom.

import type { WearDecalSpec } from "../render/wearStampDetail";
import { OBJECT_TILE_ASSETS } from "./starterTileObjectAssets";
import { STRUCTURE_TILE_ASSETS } from "./starterTileStructureAssets";

/** Painter's-deck material shelf. Authored on every paintable family (assets
 * with a VILLAGE_TERRAIN entry) so the live palette derives its grouping from
 * the asset data — a new family declares its shelf HERE, never in a toolbar
 * list (mapEditFamilies falls back to palette routing when absent). */
export type TileMaterial = "ground" | "water" | "stone" | "wood" | "roof" | "canopy";

export interface MapStudioTileAsset {
  id: string;
  name: string;
  category: "terrain" | "structures" | "objects" | "decals" | "inlays" | "my-stuff";
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
  /** A placed prop of this asset GLOWS: it contributes a bake light at its
   * centre (emissiveLights). `radius` in CELLS; colour/intensity as a light. */
  emissive?: { color: string; radius: number; intensity: number };
  /** Procedural wear-decal art (catalog rank 8): placed elements render the
   * deterministic wearStampDetail painter instead of the flat colour rect. */
  decal?: WearDecalSpec;
  /** POPULATE placement physics (catalog rank 10): "wall" piles along the
   * region border (corners double), "open" avoids it, undefined = uniform —
   * and keeps the legacy scatter stream byte-identical. */
  scatterBias?: "wall" | "open";
  /** Row-tool interval multiplier over the footprint's long side (catalog
   * rank 11) — lamp posts every 3 cells; undefined = 1 (butt-to-butt). */
  rowSpacing?: number;
  /** Painter's-deck material shelf (paint families only — see TileMaterial). */
  material?: TileMaterial;
  /** One-line grammar note for the deck's hover card (paint families only). */
  brushNote?: string;
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
    material: "stone",
    brushNote: "Flagstone slabs — crisp laid edge over any ground",
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
    material: "wood",
    brushNote: "Oak planks with grain — the everyday interior floor",
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
    material: "stone",
    brushNote: "Tight cobbles — half-scale flagstone seams",
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
    material: "stone",
    brushNote: "Warm sandstone slabs",
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
    material: "wood",
    brushNote: "Dark walnut planks",
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
    material: "wood",
    brushNote: "Weathered grey planks",
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
    material: "water",
    brushNote: "Shore bathymetry — foam collar, caustics, depth bands",
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
    material: "water",
    brushNote: "Drowned flagstone — algae and depth tint inside a water body",
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
    material: "water",
    brushNote: "Drowned steps — paint into water beside dry stairs",
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
    material: "ground",
    brushNote: "Open meadow — interleaves with dirt, echo islands at the seam",
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
    material: "ground",
    brushNote: "Bare earth with pebble key clusters",
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
    material: "ground",
    brushNote: "Trodden track — pebble clusters key along the run",
  },
  // Warm coastal sand (island benchmark arc): the second interleave pair —
  // sand↔grass interpenetrates with echo islands. Fill matches the
  // VILLAGE_TERRAIN base so bake and flat fallback agree.
  {
    id: "terrain:sand",
    name: "Sand",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#cdb285",
    stroke: "#e0cda0",
    accent: "#a58a5e",
    material: "ground",
    brushNote: "Warm shore — interpenetrates grass; the waterline laps the beach",
  },
  // Tilled farm plot (island benchmark arc): furrow ridge rows + crop ticks.
  // Fill matches the VILLAGE_TERRAIN base so bake and flat fallback agree.
  {
    id: "terrain:farm-furrow",
    name: "Farm Furrows",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#52402a",
    stroke: "#7fa03c",
    accent: "#33261a",
    material: "ground",
    brushNote: "Tilled ridge rows with crop ticks — lays over any ground",
  },
  // Log-rib bridge deck (structure treatments): plank courses over open
  // water. Fill matches the VILLAGE_TERRAIN base (the dark water-shadow the
  // boards sit over) so bake and flat fallback agree.
  {
    id: "terrain:bridge-plank",
    name: "Bridge Planks",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#20303c",
    stroke: "#6e6354",
    accent: "#867a68",
    material: "wood",
    brushNote: "Deck boards across the run — paint a strip over water",
  },
  // Sea-crag cliff (taxonomy family roster): coastal rock band rendered as
  // stacked rim-within-rim ledges. Fill matches the VILLAGE_TERRAIN base so
  // bake and flat fallback agree.
  {
    id: "terrain:cliff",
    name: "Sea-Crag Cliff",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#565e62",
    stroke: "#7b858b",
    accent: "#26282a",
    material: "stone",
    brushNote: "Sea-crag ledges — stacked rock courses between grass and water",
  },
  // Foliage canopies (taxonomy catalog rank 9): the level ABOVE the roofs —
  // trees and bushes as paintable terrain. Fills match their VILLAGE_TERRAIN
  // sun-side bases (pinned by canopyPainter.test) so bake and fallback agree.
  {
    id: "terrain:canopy",
    name: "Leaf Canopy",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#5e8f30",
    stroke: "#8fc253",
    accent: "#2f5d24",
    material: "canopy",
    brushNote: "Tree crowns above the roofs — lit/shade split against the sun",
  },
  {
    id: "terrain:canopy-blossom",
    name: "Blossom Canopy",
    category: "terrain",
    layerKind: "terrain",
    columns: 1,
    rows: 1,
    fill: "#ef9dc0",
    stroke: "#f8c4d9",
    accent: "#96588f",
    material: "canopy",
    brushNote: "Blossom crowns — pink canopy over everything below",
  },
  ...STRUCTURE_TILE_ASSETS,
  ...OBJECT_TILE_ASSETS,
];
