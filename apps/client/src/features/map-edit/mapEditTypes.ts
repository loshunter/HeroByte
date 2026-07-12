// Shared types for the live map-edit toolbar (on-table authoring).
//
// Sub-tools are PALETTE STATE, not ToolMode entries — they mirror how the
// drawing toolbar's freehand/line/rect/circle live inside a single "draw" mode.
// S2 wires only "wall"; the rest are typed now so later slices slot in without
// widening the union.

export type MapEditSubTool = "room" | "wall" | "door" | "terrain" | "erase";

/** Procedural floor families a room/terrain paints with (VILLAGE_TERRAIN). */
export type MapEditFloorFamily = "grass" | "dirt" | "path" | "stone-floor" | "wood-floor";

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
}
