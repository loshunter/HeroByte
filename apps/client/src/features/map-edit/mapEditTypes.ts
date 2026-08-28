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
  | "light"
  | "terrain"
  | "erase"
  | "place"
  | "scatter"
  | "row"
  | "select"
  | "generate"
  | "spline";

/** Persistent curve kinds the spline sub-tool authors (splineDetail art). */
export type MapEditSplineKind = "ribbon" | "filigree" | "rope" | "chain";

/**
 * Paint families are DERIVED DATA since the painter's deck: a family is
 * paintable iff it has both a bundled asset (starterTiles) and a palette
 * entry (VILLAGE_TERRAIN) — see mapEditFamilies. These aliases replace the
 * old hand-kept unions, so adding a family is a data edit, never a type edit;
 * runtime membership checks live in floorFamilyFromAssetId / WALL_FAMILIES /
 * ROOF_FAMILIES.
 */
export type MapEditWallFamily = string;

/** A roof-material paint family (the tallest painted level). */
export type MapEditRoofFamily = string;

/** Any paintable family the room/terrain tools use (floors, walls, roofs). */
export type MapEditFloorFamily = string;

/** The quick wheel's dispatch pair (P5) — the same setters the palette uses,
 * bundled so MapBoard can host the wheel with ONE optional prop. */
export interface MapEditWheelActions {
  selectSubTool: (tool: MapEditSubTool) => void;
  selectFloorFamily: (family: MapEditFloorFamily) => void;
}

/** POPULATE set-dressing density (per-cell placement probability tiers). */
export type PopulateDensity = "low" | "medium" | "high";

/** Asset category POPULATE scatters from (bundled categories only). */
export type PopulateCategory = "objects" | "structures" | "terrain" | "decals";

/**
 * The dungeon recipe's dial settings, owned by the palette. No secret-door dial:
 * generated dungeons author none (the recipe is regular enough that players can
 * read them off their own payload — see the server's dungeonGeometry.emitDoors).
 */
export interface GenerateParams {
  theme: "stone" | "wood";
  density: PopulateDensity;
  seed: number;
}

/**
 * Props for the lazy-loaded MapEditToolbar palette. Defined here (a pure types
 * module) so the glue hook can build them without importing the component and
 * pulling it into the entry bundle.
 */
export interface MapEditToolbarProps {
  isLive: boolean; // a live document is bound AND active in the controller
  // The two round-trip flags, side by side BECAUSE they were confusable: the
  // palette rendered "saving…" off `busy` from M1 to M5, so the label was
  // absent during exactly the window it appeared to name.
  busy: boolean; // a create/open/BIND round-trip is in flight — NOT a command
  saving: boolean; // a map command is in flight; this is the flag that silently
  // skips a gesture (useMapEditTool's mouse-up gate, useMapEditPlacement's drop)
  activeSubTool: MapEditSubTool;
  onSelectSubTool: (tool: MapEditSubTool) => void;
  floorFamily: MapEditFloorFamily; // room/terrain paint family (floors + walls)
  onSelectFloorFamily: (family: MapEditFloorFamily) => void;
  roomWallFamily: MapEditWallFamily | "none"; // the Room tool's wall-ring material
  onSelectRoomWallFamily: (family: MapEditWallFamily | "none") => void;
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
  /**
   * Drop as a free STAMP centred on the point rather than a snapped grid tile.
   *
   * The desktop reaches this by holding Alt, which is faster than any button
   * and is staying. A phone has no Alt, so the state is here rather than inside
   * useMapEditPlacement — the two write the same value, and an armed mode with
   * no visible control is the failure this arc keeps paying for.
   */
  stampMode: boolean;
  onToggleStampMode: () => void;
  /** Degrees a free stamp is turned by. R and Shift+R on a desktop; two
   * buttons on a touch device. Applies to STAMPS only — the tile lattice is
   * axis-aligned, matching createTileElement. */
  stampRotation: number;
  onRotateStamp: (steps: number) => void;
  onToggleAssetPicker: () => void;
  // --- Hallway + POPULATE ---
  hallwayWidth: number; // corridor width in cells (1–4)
  onSelectHallwayWidth: (width: number) => void;
  splineKind: MapEditSplineKind; // the spline sub-tool's curve kind
  onSelectSplineKind: (kind: MapEditSplineKind) => void;
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
  // REQUIRED, not optional: an optional forwarding prop can be deleted with a
  // green typecheck and every suite passing (M4b's mapStudio line, twice more
  // in the vision slice). Required makes a dropped mapping a compile error.
  generateHint: string | null; // why GENERATE is refused, shown under the button
  // --- Layers + inspector (select sub-tool) ---
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
