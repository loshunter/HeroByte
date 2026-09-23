import type { RefObject } from "react";
import type Konva from "konva";
import type { SceneObjectTransform, TerrainPaintCell } from "@herobyte/shared";
import type { RoomDrag } from "../map-studio/components/MapStudioWorkspace.types";
import type { MapStudioController } from "../map-studio/types";
import type { RoomBounds } from "./roomBuilder";
import type { PlacementGhost } from "./useMapEditPlacement";
import type { SelectionShape } from "./elementHitTest";
import type {
  MapEditFloorFamily,
  MapEditSplineKind,
  MapEditSubTool,
  MapEditWallFamily,
} from "./mapEditTypes";

/** Which device is driving the handler. Only the click tools care — see the
 * note on onMouseDown in UseMapEditToolReturn. */
export type PointerInput = "mouse" | "touch";

export interface UseMapEditToolOptions {
  mapEditMode: boolean;
  activeSubTool: MapEditSubTool;
  controller: MapStudioController | undefined;
  /**
   * The room's live-bound document id (snapshot.liveMapDocumentId). Authoring
   * only fires when the controller's ACTIVE document IS this one — otherwise a
   * stray Map Studio document left active would silently receive the wall.
   */
  liveDocumentId: string | undefined;
  /** Floor terrain family the room/hallway sub-tools paint. */
  floorFamily: MapEditFloorFamily;
  /** The Room tool's painted wall-ring material; omitted ⇒ no ring. */
  roomWallFamily?: MapEditWallFamily | "none";
  /** Asset the place/scatter sub-tools drop (defaults to a crate). */
  selectedAssetId?: string;
  /** Drop a free stamp rather than a snapped tile — the sticky half of Alt. */
  stampMode?: boolean;
  /** Degrees a free stamp is turned by. */
  stampRotation?: number;
  /** Turn the pending stamp by one step; negative reverses. */
  onRotateStamp?: (steps: number) => void;
  /** Corridor width in cells for the hallway sub-tool (1–4). */
  hallwayWidth?: number;
  /** Curve kind the spline sub-tool authors (defaults to rope). */
  splineKind?: MapEditSplineKind;
  /** Surfaced when a room/hallway drag is refused (too large / no walls layer). */
  onRoomRejected?: (message: string) => void;
  /** The gesture finished and its commit was SKIPPED because a command was in
   * flight — the one outcome here that otherwise leaves no evidence at all. */
  onGestureDropped?: () => void;
  /** A room/hallway landed — its bounds become the POPULATE target. */
  onRegionPlaced?: (bounds: RoomBounds) => void;
  /** A generate region was swept — the recipe's target (nothing placed yet). */
  onRegionDragged?: (bounds: RoomBounds) => void;
  /** Currently-selected element (select sub-tool) — drives the highlight. */
  selectedElementId?: string | null;
  onSelectElement?: (elementId: string | null) => void;
  /** Re-arm the place tool with an eyedropper-sampled asset id. */
  onSampleAsset?: (assetId: string, source: "tool" | "shortcut") => void;
  /**
   * Bumped by a control OUTSIDE the canvas to abandon the gesture in flight.
   * A finger has no Escape key and releasing it commits, so this is the only
   * abort a touch user has — see useMapEditCancel for why it is a counter.
   */
  cancelSignal?: number;
  toWorld: (sx: number, sy: number) => { x: number; y: number };
  mapTransform: SceneObjectTransform | undefined;
}

export interface UseMapEditToolReturn {
  previewDrag: RoomDrag | null;
  /** In-progress terrain/erase brush cells (for the live preview). */
  strokeCells: TerrainPaintCell[];
  /** Translucent placement ghost (place/scatter sub-tools). */
  placementGhost: PlacementGhost | null;
  /** True-result scatter-cluster footprints under the cursor (P2 ghosts). */
  draftGhosts: PlacementGhost[];
  /** Highlight footprint around the selected element (select sub-tool). */
  selectionShape: SelectionShape | null;
  /** `input` is "mouse" unless a finger is driving. It changes ONE thing: a
   * mouse drops a click tool on press, a finger aims on press and drops on
   * release (useMapEditTouchAim). Every other tool ignores it. */
  onMouseDown: (stageRef: RefObject<Konva.Stage | null>, input?: PointerInput) => void;
  onMouseMove: (stageRef: RefObject<Konva.Stage | null>, input?: PointerInput) => void;
  onMouseUp: (input?: PointerInput) => void;
  /** Abandon the gesture in flight — the touch path's "not this one". */
  onCancel: () => void;
}
