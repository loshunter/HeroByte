import type { RoomSnapshot, ClientMessage, DrawTool, MeasureEvent } from "@herobyte/shared";
import type { AlignmentPoint, AlignmentSuggestion } from "../types/alignment";
import type { Camera } from "../hooks/useCamera";
import type { MapStudioController } from "../features/map-studio/types";
import type {
  MapEditFloorFamily,
  MapEditSubTool,
  MapEditWallFamily,
} from "../features/map-edit/mapEditTypes";
import type { RoomBounds } from "../features/map-edit/roomBuilder";

/**
 * Camera command for programmatic camera control.
 * Used to focus on tokens or reset the camera view.
 */
export type CameraCommand =
  | { type: "focus-token"; tokenId: string }
  | { type: "reset" }
  // WORLD-pixel target — travel's arrival recenter (staging-zone or scene
  // center). "reset" goes to origin, which is NOT the map's middle.
  | { type: "focus-point"; x: number; y: number };

/**
 * Options for selection operations.
 * Controls how new selections interact with existing selections.
 */
export type SelectionRequestOptions = {
  mode?: "replace" | "append" | "toggle" | "subtract";
};

/**
 * Props for the MapBoard component.
 * Main VTT canvas component that handles rendering and interaction.
 */
export interface MapBoardProps {
  snapshot: RoomSnapshot | null; // Current room state
  sendMessage: (msg: ClientMessage) => void; // Function to send messages to server
  uid: string; // Current player's UID
  gridSize: number; // Synchronized grid size
  snapToGrid: boolean; // Whether to snap tokens to grid
  pointerMode: boolean; // Pointer tool active
  measureMode: boolean; // Measure tool active
  remoteMeasurements?: MeasureEvent[]; // Other players' live measurements (S6)
  drawMode: boolean; // Draw tool active
  transformMode: boolean; // Transform tool active (gizmo mode)
  selectMode: boolean; // Selection tool active
  mapEditMode?: boolean; // Live on-table map authoring active (DM-only)
  mapEditActiveSubTool?: MapEditSubTool; // Selected map-edit sub-tool (wall, …)
  mapEditFloorFamily?: MapEditFloorFamily; // Floor terrain family the room tool paints
  mapEditRoomWallFamily?: MapEditWallFamily | "none"; // Room tool's painted wall-ring material
  mapEditSelectedAssetId?: string; // Asset the place/scatter tools drop
  /**
   * The placement dials — stamp-vs-tile and rotation — as ONE object rather
   * than three props, for the reason the dock takes the whole toolbar bag: a
   * subset is how a forwarding prop goes missing with a green typecheck. Alt
   * and R still work without it, so the field is optional and the tool falls
   * back to tile-at-0°; a layout that forgets it loses the on-screen controls,
   * not the tool.
   */
  mapEditPlacementDials?: import("../features/map-edit/usePlacementDials").PlacementModifiers;
  mapEditHallwayWidth?: number; // Corridor width in cells for the hallway tool
  mapEditSplineKind?: import("../features/map-edit/mapEditTypes").MapEditSplineKind; // Spline tool curve kind
  mapEditPopulateGhosts?:
    | import("../features/map-edit/useMapEditPlacement").PlacementGhost[]
    | null; // POPULATE's true draft footprints (P2 ghosts)
  playerLens?: boolean; // P4: render the DM's view exactly as players receive it
  mapEditWheelActions?: import("../features/map-edit/mapEditTypes").MapEditWheelActions; // P5 quick wheel
  mapEditSelectedElementId?: string | null; // Selected element (select tool) → highlight
  mapEditController?: MapStudioController; // Shared Map Studio controller the tools drive
  mapEditWallsOverlayPinned?: boolean; // Keep the DM walls overlay visible outside map-edit
  onMapEditRoomRejected?: (message: string) => void; // Room drag refused (too large / no layer)
  onMapEditGestureDropped?: () => void; // Gesture's commit skipped — a command was in flight
  onMapEditRegionPlaced?: (bounds: RoomBounds) => void; // Room/hallway placed → POPULATE target
  onMapEditRegionDragged?: (bounds: RoomBounds) => void; // Generate region swept → recipe target
  onMapEditSelectElement?: (elementId: string | null) => void; // Select tool picked an element
  onMapEditSampleAsset?: (assetId: string, source: "tool" | "shortcut") => void; // sampled an asset
  mapEditCancelSignal?: number; // Bumped OUTSIDE the canvas to abandon the gesture in flight
  isDM: boolean; // Whether the current user can manage all objects
  alignmentMode: boolean; // Alignment tool active
  alignmentPoints?: AlignmentPoint[]; // Captured alignment points
  alignmentSuggestion?: AlignmentSuggestion | null; // Preview transform for alignment
  onAlignmentPointCapture?: (point: AlignmentPoint) => void;
  linkAimMode?: boolean; // One-shot atlas-link placement aim (A6)
  onLinkAnchorCapture?: (point: { x: number; y: number }) => void; // Clicked, in DOCUMENT px
  onLinkAimCancel?: () => void; // Second finger / external cancel
  drawTool: DrawTool; // Active drawing tool
  drawColor: string; // Drawing color
  drawWidth: number; // Drawing brush size
  drawOpacity: number; // Drawing opacity (0-1)
  drawFilled: boolean; // Whether shapes are filled
  onRecolorToken: (sceneId: string, owner?: string | null) => void;
  onTransformObject: (input: {
    id: string;
    position?: { x: number; y: number };
    scale?: { x: number; y: number };
    rotation?: number;
  }) => void;
  onDrawingComplete?: (drawingId: string) => void; // Called when a drawing is completed
  cameraCommand: CameraCommand | null;
  onCameraCommandHandled: () => void;
  selectedObjectId?: string | null; // Currently selected object for transform gizmo
  selectedObjectIds?: string[];
  onSelectObject?: (objectId: string | null, options?: SelectionRequestOptions) => void; // Selection handler
  onSelectObjects?: (objectIds: string[]) => void; // Batch selection handler
  onCameraChange?: (camera: Camera) => void; // Called when camera changes
}
