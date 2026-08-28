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
 * Tools reached by touch: draw, marquee-select, the map-edit DRAG sub-tools
 * (room, wall, door, hallway, row, spline, generate) since M4c, and the BRUSH
 * sub-tools (terrain, erase) since M6.
 *
 * The CLICK ones joined in M7, and needed two separate things to be true.
 * First the compat-event trap had to close — a touch TAP generates a full
 * synthetic mouse pair, and the mouse path routes to these same handlers, so
 * one tap used to drop two stamps. useTouchGestureRouter cancels the
 * touchstart a tool claims, so that is gone (M6). Second they needed an AIM: a
 * hover ghost is how all three are pointed, and a finger produces no hover. So
 * the finger gets a different gesture — press aims, release drops — which is
 * what the `input` argument below selects. useMapEditTouchAim owns it.
 *
 * `select` is still armed by NOTHING here, and must stay that way: it resolves
 * through the compat mouse path, and arming it too would run it twice.
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
import type { PointerInput } from "../features/map-edit/useMapEditTool";

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
  /** Map-edit mode AND a sub-tool a finger is armed for (see the note above). */
  mapEditTouchMode: boolean;

  handleDrawMouseDown: (stageRef: RefObject<Konva.Stage | null>) => void;
  handleDrawMouseMove: (stageRef: RefObject<Konva.Stage | null>) => void;
  handleDrawMouseUp: () => void;
  handleDrawCancel: () => void;

  handleMarqueePointerDown: (event: KonvaEventObject<PointerEvent>) => void;
  handleMarqueePointerMove: () => void;
  handleMarqueePointerUp: () => void;
  handleMarqueeCancel: () => void;

  /* The map-edit handlers take an `input` discriminator the others do not:
     the click tools drop on PRESS for a mouse and on RELEASE for a finger, and
     this is the only caller that can say which is happening. */
  handleMapEditMouseDown: (stageRef: RefObject<Konva.Stage | null>, input?: PointerInput) => void;
  handleMapEditMouseMove: (stageRef: RefObject<Konva.Stage | null>, input?: PointerInput) => void;
  handleMapEditMouseUp: (input?: PointerInput) => void;
  handleMapEditCancel: () => void;
}

/** The armed tool, or null when the finger belongs to the camera. */
export function useArmedTouchTool({
  drawMode,
  selectMode,
  mapEditTouchMode,
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
    if (mapEditTouchMode) {
      return {
        // Same shape as drawing: the stage carries the pointer, the event
        // carries nothing map-edit needs.
        start: (_event, stageRef) => handleMapEditMouseDown(stageRef, "touch"),
        move: (stageRef) => handleMapEditMouseMove(stageRef, "touch"),
        commit: () => handleMapEditMouseUp("touch"),
        // The one that matters on a finger. Releasing is what commits, so a
        // second finger reaching for the pinch must DISCARD the half-built
        // room — or the half-painted stroke — rather than stamp it onto the
        // table. useMapEditCancel covers both.
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
    mapEditTouchMode,
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
