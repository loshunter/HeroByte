// ============================================================================
// MAP-EDIT TOOL HOOK
// ============================================================================
// The stage-event driver for live on-table authoring. Cloned from
// useDrawingTool's shape: self-gating handlers, a ref-accumulated drag flushed
// to preview state via requestAnimationFrame, and a commit on mouse-up. S2
// wires the wall sub-tool (a two-point grid-snapped drag → controller.addWall).

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type Konva from "konva";
import {
  inverseTransformScenePoint,
  type MapGridSettings,
  type SceneObjectTransform,
} from "@herobyte/shared";
import type { TerrainPaintCell } from "@herobyte/shared";
import { snapPointToGrid } from "../map-studio/snapToGrid";
import { commitSegmentDrag } from "../map-studio/components/wallDoorDrafts";
import { roomBoundsFromDrag } from "../map-studio/components/mapStudioWorkspaceUtils";
import { useTerrainBrush } from "../map-studio/components/useTerrainBrush";
import type { RoomDrag, StudioTool } from "../map-studio/components/MapStudioWorkspace.types";
import type { MapStudioController } from "../map-studio/types";
import { buildRoomCommand } from "./roomBuilder";
import { useMapEditPlacement, type PlacementGhost } from "./useMapEditPlacement";
import type { MapEditFloorFamily, MapEditSubTool } from "./mapEditTypes";

const NO_OP_PAINT = (_cells: TerrainPaintCell[]) => {};

// Live-authored maps have no raster "map" scene object, so document space ≡
// world space. Writing the hop through the helper keeps tools correct even when
// a document is bound onto a room that also carries a raster background.
const IDENTITY_TRANSFORM: SceneObjectTransform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };

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
  /** Floor terrain family the room sub-tool paints. */
  floorFamily: MapEditFloorFamily;
  /** Asset the place/scatter sub-tools drop (defaults to a crate). */
  selectedAssetId?: string;
  /** Surfaced when a room drag is refused (too large / no walls layer). */
  onRoomRejected?: (message: string) => void;
  toWorld: (sx: number, sy: number) => { x: number; y: number };
  mapTransform: SceneObjectTransform | undefined;
}

interface UseMapEditToolReturn {
  previewDrag: RoomDrag | null;
  /** In-progress terrain/erase brush cells (for the live preview). */
  strokeCells: TerrainPaintCell[];
  /** Translucent placement ghost (place/scatter sub-tools). */
  placementGhost: PlacementGhost | null;
  onMouseDown: (stageRef: RefObject<Konva.Stage | null>) => void;
  onMouseMove: (stageRef: RefObject<Konva.Stage | null>) => void;
  onMouseUp: () => void;
}

/** Wall, door, and room all drive the same two-point drag machine. */
function isDragTool(subTool: MapEditSubTool): boolean {
  return subTool === "wall" || subTool === "door" || subTool === "room";
}

/** Terrain + erase are pointer-STREAM brushes (paint cells while the pointer is down). */
function isBrushTool(subTool: MapEditSubTool): boolean {
  return subTool === "terrain" || subTool === "erase";
}

/** Place + scatter are click tools: one pointer-down drops (no drag, no stream). */
function isClickTool(subTool: MapEditSubTool): boolean {
  return subTool === "place" || subTool === "scatter";
}

/**
 * The room tool ALWAYS snaps to the grid: its floor is cell-quantized, so its
 * wall perimeter must land on the same cell edges (otherwise, with the doc's
 * snap turned off, floor would spill outside the walls). Walls/doors respect
 * the document's own snap setting.
 */
function effectiveGrid(grid: MapGridSettings, subTool: MapEditSubTool): MapGridSettings {
  return subTool === "room" ? { ...grid, snap: true } : grid;
}

export function useMapEditTool({
  mapEditMode,
  activeSubTool,
  controller,
  liveDocumentId,
  floorFamily,
  selectedAssetId = "objects:crate",
  onRoomRejected,
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
  const active = mapEditMode && (isDrag || isBrush || isClick);

  // The live-bound active document (null when the shared controller is on a
  // Studio doc) — the placement ghost only shows over the doc that will receive
  // the drop, and place/scatter only author there.
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

  // screen → world → document space (unsnapped). The brush does its own cell
  // quantization from the raw point.
  const toDocPoint = useCallback(
    (stageRef: RefObject<Konva.Stage | null>): { x: number; y: number } | null => {
      const pointer = stageRef.current?.getPointerPosition();
      if (!pointer) return null;
      const world = toWorld(pointer.x, pointer.y);
      return inverseTransformScenePoint(mapTransform ?? IDENTITY_TRANSFORM, world);
    },
    [toWorld, mapTransform],
  );

  // Document space, grid-snapped — for the two-point drag tools.
  const toSnappedDocPoint = useCallback(
    (
      stageRef: RefObject<Konva.Stage | null>,
      grid: MapGridSettings,
    ): { x: number; y: number } | null => {
      const doc = toDocPoint(stageRef);
      return doc ? snapPointToGrid(doc, grid) : null;
    },
    [toDocPoint],
  );

  const onMouseDown = useCallback(
    (stageRef: RefObject<Konva.Stage | null>) => {
      if (!active) return;
      const document = controller?.activeDocument;
      // Author ONLY into the live-bound document. A Studio document left active
      // in the shared controller must never receive a live-tool edit.
      if (!document || document.id !== liveDocumentId) return;
      if (isClick) {
        // Click tools drop on pointer-down (no drag); the placement hook gates
        // on `saving` internally.
        const point = toDocPoint(stageRef);
        if (!point) return;
        if (activeSubTool === "scatter") placement.scatter(point);
        else placement.place(point);
        return;
      }
      if (isBrush) {
        const point = toDocPoint(stageRef);
        if (!point) return;
        brushingRef.current = true;
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
      isClick,
      isBrush,
      brushAssetId,
      placement,
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
        // Track the cursor so the placement ghost follows it (the ghost itself
        // only paints over the live-bound doc — see useMapEditPlacement).
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
    // binding: the active document must still be the live-bound one.
    if (document && document.id === liveDocumentId && controller && !controller.saving) {
      const layers = new Map(document.layers.map((layer) => [layer.id, layer]));
      if (activeSubTool === "room") {
        const bounds = roomBoundsFromDrag(drag, document.grid.size);
        const { command, error } = buildRoomCommand(bounds, floorFamily, document.grid, layers);
        if (command) controller.placeRoom(command.cells, command.elements);
        else if (error) onRoomRejected?.(error);
      } else {
        // wall/door: one segment drag → add-element.
        const segmentTool: StudioTool = activeSubTool === "door" ? "door" : "wall";
        commitSegmentDrag(segmentTool, layers, drag, controller.addWall, controller.addDoor);
      }
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
    onRoomRejected,
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
    onMouseDown,
    onMouseMove,
    onMouseUp,
  };
}
