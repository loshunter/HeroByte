// ============================================================================
// MAP-EDIT TOOL HOOK
// ============================================================================
// The stage-event driver for live on-table authoring. Cloned from
// useDrawingTool's shape: self-gating handlers, a ref-accumulated drag flushed
// to preview state via rAF, and a commit on mouse-up. Drag tools (wall/door/
// room/hallway) go through commitDragTool; place/scatter go through
// useMapEditPlacement; terrain/erase stream through useTerrainBrush.

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type Konva from "konva";
import type { SceneObjectTransform, TerrainPaintCell } from "@herobyte/shared";
import { useTerrainBrush } from "../map-studio/components/useTerrainBrush";
import type { RoomDrag } from "../map-studio/components/MapStudioWorkspace.types";
import type { MapStudioController } from "../map-studio/types";
import type { RoomBounds } from "./roomBuilder";
import { commitDragTool } from "./commitDragTool";
import { placeLightAt } from "./lightPlacement";
import { effectiveGrid, isBrushTool, isClickTool, isDragTool } from "./mapEditToolKinds";
import { useMapEditPlacement, type PlacementGhost } from "./useMapEditPlacement";
import { useMapEditSelection } from "./useMapEditSelection";
import { usePointerToDoc } from "./usePointerToDoc";
import type { SelectionRect } from "./elementHitTest";
import type { MapEditFloorFamily, MapEditSubTool, MapEditWallFamily } from "./mapEditTypes";

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
  toWorld: (sx: number, sy: number) => { x: number; y: number };
  mapTransform: SceneObjectTransform | undefined;
}

interface UseMapEditToolReturn {
  previewDrag: RoomDrag | null;
  /** In-progress terrain/erase brush cells (for the live preview). */
  strokeCells: TerrainPaintCell[];
  /** Translucent placement ghost (place/scatter sub-tools). */
  placementGhost: PlacementGhost | null;
  /** Highlight footprint around the selected element (select sub-tool). */
  selectionRect: SelectionRect | null;
  onMouseDown: (stageRef: RefObject<Konva.Stage | null>) => void;
  onMouseMove: (stageRef: RefObject<Konva.Stage | null>) => void;
  onMouseUp: () => void;
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
  onRoomRejected,
  onRegionPlaced,
  onRegionDragged,
  selectedElementId = null,
  onSelectElement,
  onSampleAsset,
  toWorld,
  mapTransform,
}: UseMapEditToolOptions): UseMapEditToolReturn {
  const [previewDrag, setPreviewDrag] = useState<RoomDrag | null>(null);
  const dragRef = useRef<RoomDrag | null>(null);
  const brushingRef = useRef(false);
  const frameRef = useRef<number | null>(null);

  const { addStrokePoint, flushStroke, strokeCells } = useTerrainBrush({
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

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const clearDrag = useCallback(() => {
    dragRef.current = null;
    cancelFrame();
    setPreviewDrag(null);
  }, [cancelFrame]);

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

  useEffect(() => () => cancelFrame(), [cancelFrame]);

  const flushPreview = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setPreviewDrag(dragRef.current ? { ...dragRef.current } : null);
    });
  }, []);

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
      dragRef.current = { start: point, end: point };
      setPreviewDrag({ start: point, end: point });
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
      if (!dragRef.current) return;
      const point = toSnappedDocPoint(stageRef, effectiveGrid(document.grid, activeSubTool));
      if (!point) return;
      dragRef.current = { start: dragRef.current.start, end: point };
      flushPreview();
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
      flushPreview,
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
    const drag = dragRef.current;
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
    onRoomRejected,
    onRegionPlaced,
    onRegionDragged,
    clearDrag,
  ]);

  // Escape cancels an in-progress drag WITHOUT clearing the tool: capture-phase
  // + stopImmediatePropagation preempts the global Escape-clears-tool listener.
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dragRef.current) {
        event.stopImmediatePropagation();
        event.preventDefault();
        clearDrag();
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [active, clearDrag]);

  return {
    previewDrag,
    strokeCells,
    placementGhost: placement.ghost,
    selectionRect: selection.selectionRect,
    onMouseDown,
    onMouseMove,
    onMouseUp,
  };
}
