/**
 * useArmedTouchTool
 *
 * Answers one question for the touch path: which tool owns the finger?
 *
 * The mouse path does not need this. It fans out to every tool on every event
 * and lets each one self-gate on its own mode flag, which is safe because a
 * mouse has exactly one cursor and one button. Touch cannot work that way —
 * useTouchGestureRouter has to know whether a gesture belongs to a tool or to
 * the camera BEFORE it dispatches, so it needs a single answer rather than a
 * broadcast.
 *
 * Tools reached by touch: draw, marquee-select, and — since M4c — the map-edit
 * DRAG sub-tools (room, wall, door, hallway, row, spline, generate).
 *
 * Only the drag ones, and the reason is the compat-event trap documented in
 * useTouchGestureRouter: a touch DRAG generates no synthetic mouse events, but
 * a TAP generates a full pair, and the mouse path routes to these same
 * handlers. A drag tool is safe either way — a tap makes a zero-length drag
 * and wallDraftFromDrag/commitSegmentDrag reject it. The CLICK sub-tools
 * (place, scatter, light) are not: one tap would drop two stamps, one per
 * path. The brush sub-tools still want a design pass of their own.
 *
 * The three modes are mutually exclusive by construction — all three are
 * `activeTool === x` on one piece of state — so the order below is for
 * readers, not arbitration.
 *
 * @module hooks/useArmedTouchTool
 */

import { useMemo, type RefObject } from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";

/**
 * A tool's gesture lifecycle, normalised.
 *
 * `start` takes both the event and the stage because the two tools want
 * different things: drawing reads the pointer off the stage, while the marquee
 * needs the event to check that the press landed on the stage itself rather
 * than on a shape.
 */
export interface ArmedTouchTool {
  start: (event: KonvaEventObject<TouchEvent>, stageRef: RefObject<Konva.Stage | null>) => void;
  move: (stageRef: RefObject<Konva.Stage | null>) => void;
  commit: () => void;
  cancel: () => void;
}

export interface UseArmedTouchToolProps {
  drawMode: boolean;
  selectMode: boolean;
  /** Map-edit mode AND a sub-tool that is drag-shaped (see the note above). */
  mapEditDragMode: boolean;

  handleDrawMouseDown: (stageRef: RefObject<Konva.Stage | null>) => void;
  handleDrawMouseMove: (stageRef: RefObject<Konva.Stage | null>) => void;
  handleDrawMouseUp: () => void;
  handleDrawCancel: () => void;

  handleMarqueePointerDown: (event: KonvaEventObject<PointerEvent>) => void;
  handleMarqueePointerMove: () => void;
  handleMarqueePointerUp: () => void;
  handleMarqueeCancel: () => void;

  handleMapEditMouseDown: (stageRef: RefObject<Konva.Stage | null>) => void;
  handleMapEditMouseMove: (stageRef: RefObject<Konva.Stage | null>) => void;
  handleMapEditMouseUp: () => void;
  handleMapEditCancel: () => void;
}

/** The armed tool, or null when the finger belongs to the camera. */
export function useArmedTouchTool({
  drawMode,
  selectMode,
  mapEditDragMode,
  handleDrawMouseDown,
  handleDrawMouseMove,
  handleDrawMouseUp,
  handleDrawCancel,
  handleMarqueePointerDown,
  handleMarqueePointerMove,
  handleMarqueePointerUp,
  handleMarqueeCancel,
  handleMapEditMouseDown,
  handleMapEditMouseMove,
  handleMapEditMouseUp,
  handleMapEditCancel,
}: UseArmedTouchToolProps): ArmedTouchTool | null {
  return useMemo(() => {
    if (mapEditDragMode) {
      return {
        // Same shape as drawing: the stage carries the pointer, the event
        // carries nothing map-edit needs.
        start: (_event, stageRef) => handleMapEditMouseDown(stageRef),
        move: (stageRef) => handleMapEditMouseMove(stageRef),
        commit: handleMapEditMouseUp,
        // The one that matters on a finger. Releasing is what commits, so a
        // second finger reaching for the pinch must DISCARD the half-built
        // room rather than stamp it onto the table.
        cancel: handleMapEditCancel,
      };
    }

    if (drawMode) {
      return {
        start: (_event, stageRef) => handleDrawMouseDown(stageRef),
        move: (stageRef) => handleDrawMouseMove(stageRef),
        commit: handleDrawMouseUp,
        cancel: handleDrawCancel,
      };
    }

    if (selectMode) {
      return {
        // The marquee reads the same shape of event off either input; Konva
        // gives it a TouchEvent here and a PointerEvent on the mouse path, and
        // it only touches `.evt.button` (absent on touch) and `.target`.
        start: (event) =>
          handleMarqueePointerDown(event as unknown as KonvaEventObject<PointerEvent>),
        move: () => handleMarqueePointerMove(),
        /*
         * Unconditional, deliberately — the mouse path's `if (isMarqueeActive)`
         * guard cannot be reused here. The gesture router pins the tool object
         * at touchstart, and at that instant no marquee exists yet, so a
         * captured `isMarqueeActive` is always the stale `false` and the
         * selection is never applied. (Measured: the marquee ran, every guard
         * passed, and nothing was ever selected.)
         *
         * Safe without the guard: handlePointerUp derives its rect from
         * marqueeRef, and applySelection returns early on a null rect rather
         * than clearing anything.
         */
        commit: handleMarqueePointerUp,
        cancel: handleMarqueeCancel,
      };
    }

    return null;
  }, [
    drawMode,
    selectMode,
    mapEditDragMode,
    handleDrawMouseDown,
    handleDrawMouseMove,
    handleDrawMouseUp,
    handleDrawCancel,
    handleMarqueePointerDown,
    handleMarqueePointerMove,
    handleMarqueePointerUp,
    handleMarqueeCancel,
    handleMapEditMouseDown,
    handleMapEditMouseMove,
    handleMapEditMouseUp,
    handleMapEditCancel,
  ]);
}
