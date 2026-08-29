// ============================================================================
// MAP-EDIT TOOL HOOK
// ============================================================================
// The stage-event driver for live on-table authoring. Cloned from
// useDrawingTool's shape: self-gating handlers, a ref-accumulated drag flushed
// to preview state via rAF, and a commit on mouse-up. Drag tools (wall/door/
// room/hallway) go through commitDragTool; place/scatter go through
// useMapEditPlacement; terrain/erase stream through useTerrainBrush.

import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import type Konva from "konva";
import type { SceneObjectTransform, TerrainPaintCell } from "@herobyte/shared";
import { useTerrainBrush } from "../map-studio/components/useTerrainBrush";
import type { RoomDrag } from "../map-studio/components/MapStudioWorkspace.types";
import type { MapStudioController } from "../map-studio/types";
import type { RoomBounds } from "./roomBuilder";
import { commitClickTool } from "./commitClickTool";
import { isBrushTool, isClickTool, isDragTool } from "./mapEditToolKinds";
import { useMapEditCancel } from "./useMapEditCancel";
import { useMapEditDragGesture } from "./useMapEditDragGesture";
import { useMapEditPlacement, type PlacementGhost } from "./useMapEditPlacement";
import { useMapEditSelection } from "./useMapEditSelection";
import { useMapEditTouchAim } from "./useMapEditTouchAim";
import { usePointerToDoc } from "./usePointerToDoc";
import type { SelectionShape } from "./elementHitTest";
import type {
  MapEditFloorFamily,
  MapEditSplineKind,
  MapEditSubTool,
  MapEditWallFamily,
} from "./mapEditTypes";

const NO_OP_PAINT = (_cells: TerrainPaintCell[]) => {};

/** Which device is driving the handler. Only the click tools care — see the
 * note on onMouseDown in UseMapEditToolReturn. */
export type PointerInput = "mouse" | "touch";

interface UseMapEditToolOptions {
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

interface UseMapEditToolReturn {
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

// Re-exported so existing importers (and tests) keep their entry point.
export { effectiveGrid } from "./mapEditToolKinds";

export function useMapEditTool({
  mapEditMode,
  activeSubTool,
  controller,
  liveDocumentId,
  floorFamily,
  roomWallFamily = "none",
  selectedAssetId = "objects:crate",
  stampMode = false,
  stampRotation = 0,
  onRotateStamp,
  hallwayWidth = 2,
  splineKind = "rope",
  onRoomRejected,
  onGestureDropped,
  onRegionPlaced,
  onRegionDragged,
  selectedElementId = null,
  onSelectElement,
  onSampleAsset,
  cancelSignal,
  toWorld,
  mapTransform,
}: UseMapEditToolOptions): UseMapEditToolReturn {
  const brushingRef = useRef(false);

  const { addStrokePoint, flushStroke, discardStroke, strokeCells } = useTerrainBrush({
    activeDocument: controller?.activeDocument,
    paintTerrain: controller?.paintTerrain ?? NO_OP_PAINT,
  });

  const isDrag = isDragTool(activeSubTool);
  const isBrush = isBrushTool(activeSubTool);
  const isClick = isClickTool(activeSubTool);
  // Select and the eyedropper share a branch: both consume a press through
  // `selection.handleClick` and place nothing. Grouping them here is what makes
  // the eyedropper reach the canvas at all — `active` gates every handler, and
  // a sub-tool missing from it looks armed and silently does nothing, which is
  // the failure this mode is worst at.
  const isSelect = activeSubTool === "select" || activeSubTool === "eyedropper";
  const active = mapEditMode && (isDrag || isBrush || isClick || isSelect);

  // The live-bound active document (null when the controller is on a Studio
  // doc) — place/scatter only author here, and the ghost only shows here.
  const activeDoc = controller?.activeDocument ?? null;
  const liveDocument = useMemo(
    () => (activeDoc && activeDoc.id === liveDocumentId ? activeDoc : null),
    [activeDoc, liveDocumentId],
  );
  const placement = useMapEditPlacement({
    active: mapEditMode && isClick,
    subTool: activeSubTool,
    document: liveDocument,
    selectedAssetId,
    saving: Boolean(controller?.saving),
    stampMode,
    stampRotation,
    onRotateStamp: onRotateStamp ?? (() => {}),
    onGestureDropped,
    addTile: controller?.addTile ?? (() => null),
    addStamp: controller?.addStamp ?? (() => null),
    addStamps: controller?.addStamps ?? (() => []),
  });
  const selection = useMapEditSelection({
    active: mapEditMode,
    document: liveDocument,
    selectedElementId,
    onSelectElement: onSelectElement ?? (() => {}),
    onSampleAsset: onSampleAsset ?? (() => {}),
  });
  // Terrain family "terrain:grass" for the paint brush; null erases.
  const brushAssetId = activeSubTool === "terrain" ? `terrain:${floorFamily}` : null;

  const dropAt = useCallback(
    (point: { x: number; y: number }) => {
      const document = liveDocument;
      if (!document) return;
      commitClickTool({ subTool: activeSubTool, controller, document, point, placement });
    },
    [liveDocument, activeSubTool, controller, placement],
  );

  const touchAim = useMapEditTouchAim({
    active: mapEditMode && isClick,
    updateCursor: placement.updateCursor,
    commit: dropAt,
  });

  const { toDocPoint, toSnappedDocPoint } = usePointerToDoc(toWorld, mapTransform);

  const drag = useMapEditDragGesture({
    active,
    activeSubTool,
    controller,
    liveDocumentId,
    floorFamily,
    roomWallFamily,
    hallwayWidth,
    selectedAssetId,
    splineKind,
    onRoomRejected,
    onGestureDropped,
    onRegionPlaced,
    onRegionDragged,
    toSnappedDocPoint,
  });

  const cancelGesture = useMapEditCancel({
    active,
    cancelSignal,
    currentDrag: drag.current,
    clearDrag: drag.clear,
    brushingRef,
    discardStroke,
    cancelAim: touchAim.cancel,
  });

  // Leaving map-edit abandons any drag and commits any in-progress brush stroke.
  useEffect(() => {
    if (!active) {
      drag.clear();
      if (brushingRef.current) {
        brushingRef.current = false;
        flushStroke();
      }
    }
  }, [active, drag, flushStroke]);

  const onMouseDown = useCallback(
    (stageRef: RefObject<Konva.Stage | null>, input: PointerInput = "mouse") => {
      if (!active) return;
      const document = controller?.activeDocument;
      // Author ONLY into the live-bound document — never a stray Studio doc.
      if (!document || document.id !== liveDocumentId) return;
      // Point tools (select / place / scatter / brush) share the unsnapped point.
      if (isSelect || isClick || isBrush) {
        const point = toDocPoint(stageRef);
        if (!point) return;
        // Select + Ctrl-eyedropper consume the click before any placement/paint.
        if (selection.handleClick(point, activeSubTool)) return;
        if (isSelect) return;
        if (isClick) {
          // A finger AIMS here and drops on release; a mouse drops now.
          if (input === "touch") touchAim.start(point);
          else commitClickTool({ subTool: activeSubTool, controller, document, point, placement });
          return;
        }
        brushingRef.current = true; // terrain/erase brush
        addStrokePoint(point, brushAssetId);
        return;
      }
      drag.press(stageRef);
    },
    [
      active,
      controller,
      liveDocumentId,
      activeSubTool,
      isSelect,
      isClick,
      isBrush,
      brushAssetId,
      placement,
      selection,
      touchAim,
      toDocPoint,
      addStrokePoint,
      drag,
    ],
  );

  const onMouseMove = useCallback(
    (stageRef: RefObject<Konva.Stage | null>, input: PointerInput = "mouse") => {
      if (!active) return;
      const document = controller?.activeDocument;
      if (!document) return;
      if (isClick) {
        // Track the cursor so the ghost follows it (ghost gates on the live doc).
        // On touch the aim remembers the point too, since the drop reads it.
        if (input === "touch") touchAim.move(toDocPoint(stageRef));
        else placement.updateCursor(toDocPoint(stageRef));
        return;
      }
      if (isBrush) {
        if (!brushingRef.current) return;
        const point = toDocPoint(stageRef);
        if (point) addStrokePoint(point, brushAssetId);
        return;
      }
      drag.move(stageRef);
    },
    [
      active,
      controller,
      isClick,
      isBrush,
      brushAssetId,
      placement,
      touchAim,
      toDocPoint,
      addStrokePoint,
      drag,
    ],
  );

  const onMouseUp = useCallback(
    (input: PointerInput = "mouse") => {
      if (isClick) {
        if (input === "touch") touchAim.commit();
        return;
      }
      if (isBrush) {
        if (brushingRef.current) {
          brushingRef.current = false;
          // Terrain strokes must NOT gate on `saving` (a mid-stroke ack would
          // freeze the brush); the one-in-flight command queue serializes commits.
          flushStroke();
        }
        return;
      }
      drag.release();
    },
    [isClick, touchAim, isBrush, flushStroke, brushingRef, drag],
  );

  return {
    previewDrag: drag.previewDrag,
    strokeCells,
    placementGhost: placement.ghost,
    draftGhosts: placement.draftGhosts,
    selectionShape: selection.selectionShape,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onCancel: cancelGesture,
  };
}
