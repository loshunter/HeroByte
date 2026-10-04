import type { ClientMessage } from "@herobyte/shared";
import type { ToolMode } from "../../components/layout/Header";
import type { MapStudioController } from "../map-studio/types";
import type { RoomBounds } from "./roomBuilder";
import type {
  MapEditSubTool,
  MapEditFloorFamily,
  MapEditWallFamily,
  MapEditSplineKind,
  MapEditToolbarProps,
} from "./mapEditTypes";

export interface UseMapEditStateOptions {
  controller: MapStudioController;
  sendMessage: (message: ClientMessage) => void;
  mapEditMode: boolean;
  setActiveTool: (tool: ToolMode) => void;
  /** Whether this client currently holds DM. Losing it leaves the mode. */
  isDM: boolean;
  /**
   * Has the server actually told us the roster yet? `isDM` is DERIVED from the
   * snapshot, so it reads false whenever there is no snapshot — which includes
   * every reconnect. Without this the guard below cannot tell "the server
   * revoked you" from "the server has not spoken yet".
   */
  snapshotLoaded: boolean;
  /** The room's live-bound document id (from the snapshot), if any. */
  liveMapDocumentId: string | undefined;
  /** The compiled scene's own map (snapshot.compiledScene.sourceDocumentId), if any. */
  sceneSourceDocumentId: string | undefined;
  /** The room's current live grid size, synced onto a freshly created document. */
  roomGridSize: number;
  /** True when the room still carries a raster background (double-draw hint). */
  hasRasterBackground: boolean;
  /** Surface a server-side map-studio error to the DM (e.g. a toast). */
  notifyError?: (message: string) => string | void;
  /** Retire only the notification created for a superseded map error. */
  dismissError?: (id: string) => void;
}

export interface UseMapEditStateReturn {
  activeSubTool: MapEditSubTool;
  /** Floor terrain family the room sub-tool paints. */
  floorFamily: MapEditFloorFamily;
  /** The Room tool's painted wall-ring material (fed to the tool). */
  roomWallFamily: MapEditWallFamily | "none";
  /** Asset the place/scatter sub-tools drop (fed to the tool + preview). */
  selectedAssetId: string;
  /** Corridor width in cells for the hallway sub-tool (fed to the tool + preview). */
  hallwayWidth: number;
  terrainBrushSize: import("../map-studio/terrainBrushGeometry").TerrainBrushSize;
  /** Curve kind the spline sub-tool authors (fed to the tool). */
  splineKind: MapEditSplineKind;
  /** Record a room/hallway's bounds as the POPULATE target (fed to the tool). */
  onRegionPlaced: import("./populateTarget").OnPopulateRegionPlaced;
  /** POPULATE's true draft footprints while a region is armed (P2 ghosts). */
  persistentPreview: import("./MapEditPersistentPreview").MapEditPersistentPreview;
  /** Quick-wheel dispatch pair (P5) — stable identity. */
  wheelActions: import("./mapEditTypes").MapEditWheelActions;
  /** Record a generate drag's bounds as the recipe's target (fed to the tool). */
  onRegionDragged: (bounds: RoomBounds) => void;
  /** Currently-selected element id (select sub-tool) + its setter (fed to the tool). */
  selectedElementId: string | null;
  onSelectElement: (elementId: string | null) => void;
  /** Explicit Sample arms Paint for a material, Place otherwise; shortcuts keep the tool. */
  onSampleAsset: (assetId: string, source: "tool" | "shortcut") => void;
  /** Keep the DM walls overlay visible even outside map-edit mode. */
  wallsOverlayPinned: boolean;
  toolbarProps: MapEditToolbarProps;
}
