// ============================================================================
// THE DRAG MACHINE, ON ITS OWN
// ============================================================================
// Press, sweep, release — the lifecycle wall/door/room/hallway/row/spline/
// generate all share. It was inline in useMapEditTool until M7, which had to
// add a second gesture shape for the click tools and found that file at 347 of
// a 350-line guard with nothing left to spend.
//
// Extracting the DRAG half rather than the point half is the split that pays,
// and not only in lines. The two really are different machines: this one
// accumulates a rectangle in a ref, previews it through rAF, and commits ONE
// document command on release; the point tools (select, place, scatter, light,
// terrain, erase) each resolve at a single unsnapped point and share nothing
// with it but the stage. Keeping them in one function meant one release
// handler that had to open with two early returns for tools it was not about.
//
// Nothing here changed behaviour. The `saving` skip, its onGestureDropped
// call, the aim-only exemption and the silent live-document re-check are the
// same code in the same order — this is a move, and the characterization
// suites are what say so.
//
// @module features/map-edit/useMapEditDragGesture

import { useCallback, type RefObject } from "react";
import type Konva from "konva";
import type { MapStudioController } from "../map-studio/types";
import type { RoomDrag } from "../map-studio/components/MapStudioWorkspace.types";
import { commitDragTool } from "./commitDragTool";
import { effectiveGrid, isAimTool } from "./mapEditToolKinds";
import type { RoomBounds } from "./roomBuilder";
import { useMapEditDragPreview } from "./useMapEditDragPreview";
import type {
  MapEditFloorFamily,
  MapEditSplineKind,
  MapEditSubTool,
  MapEditWallFamily,
} from "./mapEditTypes";

export interface UseMapEditDragGestureOptions {
  /** Map-edit is on and SOME map-edit tool owns the pointer. */
  active: boolean;
  activeSubTool: MapEditSubTool;
  controller: MapStudioController | undefined;
  liveDocumentId: string | undefined;
  floorFamily: MapEditFloorFamily;
  roomWallFamily: MapEditWallFamily | "none";
  hallwayWidth: number;
  selectedAssetId: string;
  splineKind: MapEditSplineKind;
  onRoomRejected?: (message: string) => void;
  onGestureDropped?: () => void;
  onRegionPlaced?: (bounds: RoomBounds) => void;
  onRegionDragged?: (bounds: RoomBounds) => void;
  /** Stage pointer -> document point, snapped to the tool's effective grid. */
  toSnappedDocPoint: (
    stageRef: RefObject<Konva.Stage | null>,
    grid: ReturnType<typeof effectiveGrid>,
  ) => { x: number; y: number } | null;
}

export interface MapEditDragGesture {
  /** The rubber band to draw, or null between gestures. */
  previewDrag: RoomDrag | null;
  /** The live drag, read by the cancel machinery. */
  current: () => RoomDrag | null;
  /** Abandon the drag and its pending frame. */
  clear: () => void;
  press: (stageRef: RefObject<Konva.Stage | null>) => void;
  move: (stageRef: RefObject<Konva.Stage | null>) => void;
  /** Release: commit the drag, or say why it was skipped. Always clears. */
  release: () => void;
}

export function useMapEditDragGesture({
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
}: UseMapEditDragGestureOptions): MapEditDragGesture {
  const { previewDrag, current, begin, extend, clear } = useMapEditDragPreview();

  const press = useCallback(
    (stageRef: RefObject<Konva.Stage | null>) => {
      const document = controller?.activeDocument;
      if (!document) return;
      const point = toSnappedDocPoint(stageRef, effectiveGrid(document.grid, activeSubTool));
      if (!point) return;
      begin(point);
    },
    [controller, activeSubTool, toSnappedDocPoint, begin],
  );

  const move = useCallback(
    (stageRef: RefObject<Konva.Stage | null>) => {
      const document = controller?.activeDocument;
      if (!document || !current()) return;
      const point = toSnappedDocPoint(stageRef, effectiveGrid(document.grid, activeSubTool));
      if (!point) return;
      extend(point);
    },
    [controller, activeSubTool, toSnappedDocPoint, current, extend],
  );

  const release = useCallback(() => {
    const drag = current();
    if (!active || !drag) {
      clear();
      return;
    }
    const document = controller?.activeDocument;
    // The live-binding re-check stays SILENT when it fails: refusing to author
    // into a stray Studio doc is a guard working, not a gesture going missing.
    if (document && controller && document.id === liveDocumentId) {
      // Tools do not self-gate on `saving`; skip the commit while a command is
      // in flight (the Studio's rule) so drags don't pile up. A skip never sets
      // controller.error and clear() runs anyway, so this must say so.
      // Aim-only tools are exempt — nothing of theirs can pile up.
      if (controller.saving && !isAimTool(activeSubTool)) {
        onGestureDropped?.();
      } else {
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
    }
    clear();
  }, [
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
    onGestureDropped,
    onRegionPlaced,
    onRegionDragged,
    current,
    clear,
  ]);

  return { previewDrag, current, clear, press, move, release };
}
