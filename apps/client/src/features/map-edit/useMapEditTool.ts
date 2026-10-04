// ============================================================================
// MAP-EDIT TOOL HOOK
// ============================================================================
// The stage-event driver for live on-table authoring. Cloned from
// useDrawingTool's shape: self-gating handlers, a ref-accumulated drag flushed
// to preview state via rAF, and a commit on mouse-up. Drag tools (wall/door/
// room/hallway) go through commitDragTool; place/scatter go through
// useMapEditPlacement; terrain/erase stream through useTerrainBrush.

import { useCallback, useMemo, useRef, type RefObject } from "react";
import type Konva from "konva";
import type { TerrainPaintCell } from "@herobyte/shared";
import { useTerrainBrush } from "../map-studio/components/useTerrainBrush";
import { commitClickTool } from "./commitClickTool";
import { isBrushTool, isClickTool, isDragTool } from "./mapEditToolKinds";
import { useMapEditCancel } from "./useMapEditCancel";
import { escapeRegistry } from "../interaction/useEscapeOwner";
import { useMapEditDragGesture } from "./useMapEditDragGesture";
import { useMapEditPlacement } from "./useMapEditPlacement";
import { useMapEditSelection } from "./useMapEditSelection";
import { useMapEditTouchAim } from "./useMapEditTouchAim";
import { usePointerToDoc } from "./usePointerToDoc";

import type {
  PointerInput,
  UseMapEditToolOptions,
  UseMapEditToolReturn,
} from "./mapEditTool.types";

const NO_OP_PAINT = (_cells: TerrainPaintCell[]) => {};

export type { PointerInput } from "./mapEditTool.types";

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
  terrainBrushSize = 1,
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

  const {
    addStrokePoint,
    flushStroke,
    discardStroke,
    strokeCells,
    updateCursor,
    clearCursor,
    brushPreviewCells,
  } = useTerrainBrush({
    activeDocument: controller?.activeDocument,
    paintTerrain: controller?.paintTerrain ?? NO_OP_PAINT,
    brushSize: terrainBrushSize,
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
    subTool: activeSubTool,
    documentId: activeDoc?.id,
    liveDocumentId,
    // Cancel semantic brush changes, while ordinary revisions/callbacks survive.
    brushContext: isBrush
      ? JSON.stringify([
          terrainBrushSize,
          brushAssetId,
          activeDoc?.width,
          activeDoc?.height,
          activeDoc?.grid.size,
          activeDoc?.grid.offsetX,
          activeDoc?.grid.offsetY,
        ])
      : undefined,
    currentAim: touchAim.current,
    cancelSignal,
    currentDrag: drag.current,
    clearDrag: drag.clear,
    brushingRef,
    discardStroke,
    cancelAim: touchAim.cancel,
  });

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
        const point = toDocPoint(stageRef);
        if (point && document.id === liveDocumentId) {
          if (brushingRef.current) addStrokePoint(point, brushAssetId);
          else updateCursor(point, brushAssetId);
        }
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
      updateCursor,
      liveDocumentId,
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
        // A lifted finger has no hover position; a mouse keeps its live cursor.
        if (input === "touch") clearCursor();
        return;
      }
      drag.release();
    },
    [isClick, touchAim, isBrush, flushStroke, clearCursor, brushingRef, drag],
  );

  return {
    previewDrag: drag.previewDrag,
    strokeCells,
    brushPreviewCells: active && isBrush && liveDocument ? brushPreviewCells : [],
    placementGhost: placement.ghost,
    draftGhosts: placement.draftGhosts,
    selectionShape: selection.selectionShape,
    onMouseDown: (...args) => {
      try {
        onMouseDown(...args);
      } finally {
        escapeRegistry.refresh();
      }
    },
    onMouseMove,
    onMouseLeave: () => {
      // An idle hover belongs to the canvas; a held stroke keeps its lifetime.
      if (!brushingRef.current) clearCursor();
    },
    onMouseUp: (...args) => {
      try {
        onMouseUp(...args);
      } finally {
        escapeRegistry.refresh();
      }
    },
    onCancel: cancelGesture,
  };
}
