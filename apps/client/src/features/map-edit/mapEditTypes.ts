// Shared types for the live map-edit toolbar (on-table authoring).
//
// Sub-tools are PALETTE STATE, not ToolMode entries — they mirror how the
// drawing toolbar's freehand/line/rect/circle live inside a single "draw" mode.
// S2 wires only "wall"; the rest are typed now so later slices slot in without
// widening the union.

import type {
  MapDoorState,
  MapElement,
  MapElementUpdate,
  MapLayer,
  MapLayerUpdate,
} from "@herobyte/shared";

export type MapEditSubTool =
  | "room"
  | "hallway"
  | "wall"
  | "door"
  | "terrain"
  | "erase"
  | "place"
  | "scatter"
  | "select"
  | "generate";

/** Procedural floor families a room/terrain paints with (VILLAGE_TERRAIN). */
export type MapEditFloorFamily = "grass" | "dirt" | "path" | "stone-floor" | "wood-floor";

/** POPULATE set-dressing density (per-cell placement probability tiers). */
export type PopulateDensity = "low" | "medium" | "high";

/** Asset category POPULATE scatters from (bundled categories only). */
export type PopulateCategory = "objects" | "structures" | "terrain";

/** The dungeon recipe's dial settings, owned by the palette. */
export interface GenerateParams {
  theme: "stone" | "wood";
  density: PopulateDensity;
  /** 0..1 — how often a generated door is authored secret. */
  secretDoorChance: number;
  seed: number;
}

/**
 * Props for the lazy-loaded MapEditToolbar palette. Defined here (a pure types
 * module) so the glue hook can build them without importing the component and
 * pulling it into the entry bundle.
 */
export interface MapEditToolbarProps {
  isLive: boolean; // a live document is bound AND active in the controller
  busy: boolean; // a create/open/command round-trip is in flight
  activeSubTool: MapEditSubTool;
  onSelectSubTool: (tool: MapEditSubTool) => void;
  floorFamily: MapEditFloorFamily; // room/terrain floor family
  onSelectFloorFamily: (family: MapEditFloorFamily) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onStartLiveMap: () => void;
  onClose: () => void;
  hasRasterBackground: boolean; // hint: live terrain may double-draw over a raster
  error: string | null;
  wallsOverlayPinned: boolean; // keep the DM walls overlay visible outside map-edit
  onToggleWallsOverlay: () => void;
  // --- Placement (place / scatter sub-tools) ---
  selectedAssetId: string; // the asset the place/scatter tools drop
  onSelectAsset: (assetId: string) => void;
  uploadAsset: (
    file: File,
  ) => Promise<import("../map-studio/uploads/assetUpload").UploadedAssetInfo>;
  assetPickerOpen: boolean;
  onToggleAssetPicker: () => void;
  // --- Hallway + POPULATE ---
  hallwayWidth: number; // corridor width in cells (1–4)
  onSelectHallwayWidth: (width: number) => void;
  populateDensity: PopulateDensity;
  onSelectPopulateDensity: (density: PopulateDensity) => void;
  populateCategory: PopulateCategory;
  onSelectPopulateCategory: (category: PopulateCategory) => void;
  onPopulate: () => void; // fills the last-placed room/hallway with set dressing
  canPopulate: boolean; // a region has been placed and the controller is idle
  // --- Generate (dungeon recipe) ---
  generateParams: GenerateParams;
  onGenerateParamsChange: (params: GenerateParams) => void;
  onRerollSeed: () => void;
  onGenerate: () => void; // runs the recipe over the dragged region
  canGenerate: boolean; // a region is dragged, bound live, and the queue is idle
  generateRegion: { cols: number; rows: number } | null; // the dragged size, for the panel
  // --- Layers + inspector (select sub-tool) ---
  saving: boolean;
  layers: MapLayer[];
  selectedElement: MapElement | null;
  onUpdateLayer: (layerId: string, update: MapLayerUpdate) => void;
  onMoveLayer: (layerId: string, targetIndex: number) => void;
  onUpdateElement: (elementId: string, update: MapElementUpdate) => void;
  onUpdateDoor: (elementId: string, update: { state: MapDoorState; width: number }) => void;
  onRemoveElement: (elementId: string) => void;
  layersOpen: boolean;
  onToggleLayers: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
}
