import type { TerrainMap } from "./terrain.js";

export const MAP_DOCUMENT_SCHEMA_VERSION = 1;

export type MapGridType = "square" | "hex-row" | "hex-column" | "isometric";

export interface MapGridSettings {
  type: MapGridType;
  size: number;
  squareSize: number;
  offsetX: number;
  offsetY: number;
  visible: boolean;
  snap: boolean;
}

export type MapGridUpdate = Partial<MapGridSettings>;

export type MapLayerKind = "background" | "terrain" | "objects" | "walls" | "lighting" | "notes";

export interface MapLayer {
  id: string;
  name: string;
  kind: MapLayerKind;
  visible: boolean;
  locked: boolean;
  opacity: number;
  zIndex: number;
}

export interface MapElementTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface MapElementBase {
  id: string;
  layerId: string;
  locked: boolean;
  hidden: boolean;
  transform: MapElementTransform;
}

export interface MapTileElement extends MapElementBase {
  type: "tile";
  data: { assetId: string; columns: number; rows: number; tint?: string };
}

export interface MapStampElement extends MapElementBase {
  type: "stamp";
  data: { assetId: string; width: number; height: number; tint?: string };
}

export interface MapShapeElement extends MapElementBase {
  type: "shape";
  data: {
    shape: "rectangle" | "ellipse" | "polygon";
    points: { x: number; y: number }[];
    stroke: string;
    strokeWidth: number;
    fill?: string;
    opacity: number;
  };
}

export interface MapWallElement extends MapElementBase {
  type: "wall";
  data: {
    points: { x: number; y: number }[];
    blocksMovement: boolean;
    blocksVision: boolean;
  };
}

export type MapDoorState = "open" | "closed" | "locked" | "secret";

export interface MapDoorElement extends MapElementBase {
  type: "door";
  data: {
    width: number;
    state: MapDoorState;
    blocksMovement: boolean;
    blocksVision: boolean;
  };
}

export interface MapLightElement extends MapElementBase {
  type: "light";
  data: { radius: number; color: string; intensity: number; castsShadows: boolean };
}

export interface MapTextElement extends MapElementBase {
  type: "text";
  data: { text: string; color: string; fontSize: number; visibleToPlayers: boolean };
}

export type MapElement =
  | MapTileElement
  | MapStampElement
  | MapShapeElement
  | MapWallElement
  | MapDoorElement
  | MapLightElement
  | MapTextElement;

/**
 * A map element narrowed to what ANY player may safely see rendered at the live
 * table: the scenery kinds (tile / stamp / shape / text) carrying only render
 * fields. The DM-only kinds (wall / door / light), the privacy flags (`hidden`,
 * text `visibleToPlayers`), and layer bookkeeping (`layerId`, `locked`) are gone
 * BY CONSTRUCTION — a value of this type has nothing left to strip. Produced
 * only by `deriveMapElements`, which applies the render-privacy rules.
 */
export type RenderableMapElement =
  | { id: string; type: "tile"; transform: MapElementTransform; data: MapTileElement["data"] }
  | { id: string; type: "stamp"; transform: MapElementTransform; data: MapStampElement["data"] }
  | { id: string; type: "shape"; transform: MapElementTransform; data: MapShapeElement["data"] }
  | {
      id: string;
      type: "text";
      transform: MapElementTransform;
      data: { text: string; color: string; fontSize: number };
    };

/**
 * The player-safe element layers derived from a live-bound document — in
 * `zIndex` order, each carrying its layer `opacity`. Shares the document's grid
 * lattice because tiles are sized in grid cells (like MapTerrainSnapshot).
 */
/** A player-safe light pool: document-px position/radius, colour, intensity.
 * Derived only from non-hidden lights on visible layers. */
export interface RenderableLight {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  intensity: number;
}

/**
 * The table's lighting state: `ambient` is the lighting LAYER's opacity
 * (1 = daylight — no veil; toward 0 = night), and `lights` are the pools that
 * punch through the veil. An invisible lighting layer reads as daylight (the
 * kill switch). Consumed by the terrain bake, not the scenery renderer.
 */
export interface MapLightingSnapshot {
  ambient: number;
  lights: RenderableLight[];
}

export interface MapElementsSnapshot {
  grid: { size: number; offsetX: number; offsetY: number };
  layers: Array<{ opacity: number; elements: RenderableMapElement[] }>;
  /** Present when the document departs from plain daylight. */
  lighting?: MapLightingSnapshot;
}

export interface MapDocument {
  schemaVersion: typeof MAP_DOCUMENT_SCHEMA_VERSION;
  id: string;
  name: string;
  width: number;
  height: number;
  grid: MapGridSettings;
  layers: MapLayer[];
  elements: MapElement[];
  /** Painted terrain (RLE chunks); absent until the first brush stroke. */
  terrain?: TerrainMap;
  revision: number;
  createdAt: number;
  updatedAt: number;
}

export type MapDocumentSummary = Pick<
  MapDocument,
  "id" | "name" | "width" | "height" | "revision" | "createdAt" | "updatedAt"
>;

export interface CreateMapDocumentInput {
  id: string;
  name: string;
  width?: number;
  height?: number;
  grid?: Partial<MapGridSettings>;
  timestamp?: number;
}

export type MapLayerUpdate = Partial<Pick<MapLayer, "name" | "visible" | "locked" | "opacity">>;

export type MapElementUpdate = Partial<
  Pick<MapElementBase, "layerId" | "locked" | "hidden" | "transform">
>;

export const DEFAULT_MAP_LAYERS: ReadonlyArray<Readonly<MapLayer>> = [
  defaultLayer("background", "Background", "background", true, 0),
  defaultLayer("terrain", "Terrain", "terrain", false, 10),
  defaultLayer("objects", "Objects", "objects", false, 20),
  defaultLayer("walls", "Walls & Doors", "walls", false, 30),
  defaultLayer("lighting", "Lighting", "lighting", false, 40),
  defaultLayer("notes", "GM Notes", "notes", false, 50),
];

function defaultLayer(
  id: string,
  name: string,
  kind: MapLayerKind,
  locked: boolean,
  zIndex: number,
): Readonly<MapLayer> {
  return { id, name, kind, visible: true, locked, opacity: 1, zIndex };
}
