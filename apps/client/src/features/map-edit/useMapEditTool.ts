// ============================================================================
// MAP-EDIT TOOL HOOK
// ============================================================================
// The stage-event driver for live on-table authoring. Cloned from
// useDrawingTool's shape: self-gating handlers, a ref-accumulated drag flushed
// to preview state via requestAnimationFrame, and a commit on mouse-up. S2
// wires the wall sub-tool (a two-point grid-snapped drag → controller.addWall).

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type Konva from "konva";
import {
  inverseTransformScenePoint,
  type MapGridSettings,
  type SceneObjectTransform,
} from "@herobyte/shared";
import { snapPointToGrid } from "../map-studio/snapToGrid";
import { commitSegmentDrag } from "../map-studio/components/wallDoorDrafts";
import type { RoomDrag, StudioTool } from "../map-studio/components/MapStudioWorkspace.types";
import type { MapStudioController } from "../map-studio/types";
import type { MapEditSubTool } from "./mapEditTypes";

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
  toWorld: (sx: number, sy: number) => { x: number; y: number };
  mapTransform: SceneObjectTransform | undefined;
}

interface UseMapEditToolReturn {
  previewDrag: RoomDrag | null;
  onMouseDown: (stageRef: RefObject<Konva.Stage | null>) => void;
  onMouseMove: (stageRef: RefObject<Konva.Stage | null>) => void;
  onMouseUp: () => void;
}

/** S2 handles the wall sub-tool; S3 adds "door" through the same drag machine. */
function isSegmentTool(subTool: MapEditSubTool): boolean {
  return subTool === "wall";
}

export function useMapEditTool({
  mapEditMode,
  activeSubTool,
  controller,
  liveDocumentId,
  toWorld,
  mapTransform,
}: UseMapEditToolOptions): UseMapEditToolReturn {
  const [previewDrag, setPreviewDrag] = useState<RoomDrag | null>(null);
  const dragRef = useRef<RoomDrag | null>(null);
  const frameRef = useRef<number | null>(null);

  const active = mapEditMode && isSegmentTool(activeSubTool);

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

  // Leaving map-edit (or switching off a segment tool) abandons any drag.
  useEffect(() => {
    if (!active) clearDrag();
  }, [active, clearDrag]);

  useEffect(() => () => cancelFrame(), [cancelFrame]);

  const flushPreview = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setPreviewDrag(dragRef.current ? { ...dragRef.current } : null);
    });
  }, []);

  // screen → world → document → grid-snapped, in document space.
  const toSnappedDocPoint = useCallback(
    (
      stageRef: RefObject<Konva.Stage | null>,
      grid: MapGridSettings,
    ): { x: number; y: number } | null => {
      const pointer = stageRef.current?.getPointerPosition();
      if (!pointer) return null;
      const world = toWorld(pointer.x, pointer.y);
      const doc = inverseTransformScenePoint(mapTransform ?? IDENTITY_TRANSFORM, world);
      return snapPointToGrid(doc, grid);
    },
    [toWorld, mapTransform],
  );

  const onMouseDown = useCallback(
    (stageRef: RefObject<Konva.Stage | null>) => {
      if (!active) return;
      const document = controller?.activeDocument;
      // Author ONLY into the live-bound document. A Studio document left active
      // in the shared controller must never receive a live-tool wall.
      if (!document || document.id !== liveDocumentId) return;
      const point = toSnappedDocPoint(stageRef, document.grid);
      if (!point) return;
      dragRef.current = { start: point, end: point };
      setPreviewDrag({ start: point, end: point });
    },
    [active, controller, liveDocumentId, toSnappedDocPoint],
  );

  const onMouseMove = useCallback(
    (stageRef: RefObject<Konva.Stage | null>) => {
      if (!active || !dragRef.current) return;
      const document = controller?.activeDocument;
      if (!document) return;
      const point = toSnappedDocPoint(stageRef, document.grid);
      if (!point) return;
      dragRef.current = { start: dragRef.current.start, end: point };
      flushPreview();
    },
    [active, controller, toSnappedDocPoint, flushPreview],
  );

  const onMouseUp = useCallback(() => {
    const drag = dragRef.current;
    if (!active || !drag) {
      clearDrag();
      return;
    }
    const document = controller?.activeDocument;
    // addWall/addDoor do not self-gate on `saving`; skip the commit while a
    // command is in flight (the Studio's rule) so drags don't pile up. Re-check
    // the live binding: the active document must still be the live-bound one.
    if (document && document.id === liveDocumentId && controller && !controller.saving) {
      const layers = new Map(document.layers.map((layer) => [layer.id, layer]));
      // The gate guarantees a segment tool; map to the StudioTool commitSegmentDrag speaks.
      const segmentTool: StudioTool = activeSubTool === "door" ? "door" : "wall";
      commitSegmentDrag(segmentTool, layers, drag, controller.addWall, controller.addDoor);
    }
    clearDrag();
  }, [active, controller, liveDocumentId, activeSubTool, clearDrag]);

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

  return { previewDrag, onMouseDown, onMouseMove, onMouseUp };
}
