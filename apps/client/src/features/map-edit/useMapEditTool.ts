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
import { commitDragTool } from "./commitDragTool";
import { placeLightAt } from "./lightPlacement";
import { effectiveGrid, isBrushTool, isClickTool, isDragTool } from "./mapEditToolKinds";
import { useMapEditCancel } from "./useMapEditCancel";
import { useMapEditDragPreview } from "./useMapEditDragPreview";
import { useMapEditPlacement, type PlacementGhost } from "./useMapEditPlacement";
import { useMapEditSelection } from "./useMapEditSelection";
import { usePointerToDoc } from "./usePointerToDoc";
import type { SelectionRect } from "./elementHitTest";
import type {
  MapEditFloorFamily,
  MapEditSplineKind,
  MapEditSubTool,
  MapEditWallFamily,
} from "./mapEditTypes";

const NO_OP_PAINT = (_cells: TerrainPaintCell[]) => {};

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
  /** Corridor width in cells for the hallway sub-tool (1–4). */
  hallwayWidth?: number;
  /** Curve kind the spline sub-tool authors (defaults to rope). */
  splineKind?: MapEditSplineKind;
  /** Surfaced when a room/hallway drag is refused (too large / no walls layer). */
  onRoomRejected?: (message: string) => void;
  /** A room/hallway landed — its bounds become the POPULATE target. */
  onRegionPlaced?: (bounds: RoomBounds) => void;
  /** A generate region was swept — the recipe's target (nothing placed yet). */
  onRegionDragged?: (bounds: RoomBounds) => void;
  /** Currently-selected element (select sub-tool) — drives the highlight. */
  selectedElementId?: string | null;
  onSelectElement?: (elementId: string | null) => void;
  /** Re-arm the place tool with an eyedropper-sampled asset id. */
  onSampleAsset?: (assetId: string) => void;
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
  selectionRect: SelectionRect | null;
  onMouseDown: (stageRef: RefObject<Konva.Stage | null>) => void;
  onMouseMove: (stageRef: RefObject<Konva.Stage | null>) => void;
  onMouseUp: () => void;
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
  hallwayWidth = 2,
  splineKind = "rope",
  onRoomRejected,
  onRegionPlaced,
  onRegionDragged,
  selectedElementId = null,
  onSelectElement,
  onSampleAsset,
  cancelSignal,
  toWorld,
  mapTransform,
}: UseMapEditToolOptions): UseMapEditToolReturn {
  const {
    previewDrag,
    current: currentDrag,
    begin,
    extend,
    clear: clearDrag,
  } = useMapEditDragPreview();
  const brushingRef = useRef(false);

  const { addStrokePoint, flushStroke, discardStroke, strokeCells } = useTerrainBrush({
    activeDocument: controller?.activeDocument,
    paintTerrain: controller?.paintTerrain ?? NO_OP_PAINT,
  });

  const isDrag = isDragTool(activeSubTool);
  const isBrush = isBrushTool(activeSubTool);
  const isClick = isClickTool(activeSubTool);
  const isSelect = activeSubTool === "select";
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

  const cancelGesture = useMapEditCancel({
    active,
    cancelSignal,
    currentDrag,
    clearDrag,
    brushingRef,
    discardStroke,
  });

  // Leaving map-edit abandons any drag and commits any in-progress brush stroke.
  useEffect(() => {
    if (!active) {
      clearDrag();
      if (brushingRef.current) {
        brushingRef.current = false;
        flushStroke();
      }
    }
  }, [active, clearDrag, flushStroke]);

  const { toDocPoint, toSnappedDocPoint } = usePointerToDoc(toWorld, mapTransform);

  const onMouseDown = useCallback(
    (stageRef: RefObject<Konva.Stage | null>) => {
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
          if (activeSubTool === "light") {
            if (controller) placeLightAt(controller, document, point);
          } else if (activeSubTool === "scatter") placement.scatter(point);
          else placement.place(point);
          return;
        }
        brushingRef.current = true; // terrain/erase brush
        addStrokePoint(point, brushAssetId);
        return;
      }
      const point = toSnappedDocPoint(stageRef, effectiveGrid(document.grid, activeSubTool));
      if (!point) return;
      begin(point);
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
      toDocPoint,
      addStrokePoint,
      toSnappedDocPoint,
      begin,
    ],
  );

  const onMouseMove = useCallback(
    (stageRef: RefObject<Konva.Stage | null>) => {
      if (!active) return;
      const document = controller?.activeDocument;
      if (!document) return;
      if (isClick) {
        // Track the cursor so the ghost follows it (ghost gates on the live doc).
        placement.updateCursor(toDocPoint(stageRef));
        return;
      }
      if (isBrush) {
        if (!brushingRef.current) return;
        const point = toDocPoint(stageRef);
        if (point) addStrokePoint(point, brushAssetId);
        return;
      }
      if (!currentDrag()) return;
      const point = toSnappedDocPoint(stageRef, effectiveGrid(document.grid, activeSubTool));
      if (!point) return;
      extend(point);
    },
    [
      active,
      controller,
      activeSubTool,
      isClick,
      isBrush,
      brushAssetId,
      placement,
      toDocPoint,
      addStrokePoint,
      toSnappedDocPoint,
      currentDrag,
      extend,
    ],
  );

  const onMouseUp = useCallback(() => {
    if (isBrush) {
      if (brushingRef.current) {
        brushingRef.current = false;
        // Terrain strokes must NOT gate on `saving` (a mid-stroke ack would
        // freeze the brush); the one-in-flight command queue serializes commits.
        flushStroke();
      }
      return;
    }
    const drag = currentDrag();
    if (!active || !drag) {
      clearDrag();
      return;
    }
    const document = controller?.activeDocument;
    // Tools do not self-gate on `saving`; skip the commit while a command is in
    // flight (the Studio's rule) so drags don't pile up. Re-check the live
    // binding too: the active document must still be the live-bound one.
    if (document && document.id === liveDocumentId && controller && !controller.saving) {
      commitDragTool({
        subTool: activeSubTool,
        drag,
        document,
        controller,
        floorFamily,
        roomWallFamily,
        hallwayWidth,
        selectedAssetId,
        splineKind,
        onRoomRejected,
        onRegionPlaced,
        onRegionDragged,
      });
    }
    clearDrag();
  }, [
    isBrush,
    flushStroke,
    active,
    controller,
    liveDocumentId,
    activeSubTool,
    floorFamily,
    roomWallFamily,
    hallwayWidth,
    selectedAssetId,
    splineKind,
    onRoomRejected,
    onRegionPlaced,
    onRegionDragged,
    currentDrag,
    clearDrag,
  ]);

  return {
    previewDrag,
    strokeCells,
    placementGhost: placement.ghost,
    draftGhosts: placement.draftGhosts,
    selectionRect: selection.selectionRect,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onCancel: cancelGesture,
  };
}
