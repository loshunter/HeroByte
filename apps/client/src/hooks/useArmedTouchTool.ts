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
 * Tools reached by touch today: draw and marquee-select. Map-edit is
 * deliberately absent — its interactions depend on hover ghosts and modifier
 * keys that a finger does not have, so it needs a design pass, not a wire-up.
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

  handleDrawMouseDown: (stageRef: RefObject<Konva.Stage | null>) => void;
  handleDrawMouseMove: (stageRef: RefObject<Konva.Stage | null>) => void;
  handleDrawMouseUp: () => void;
  handleDrawCancel: () => void;

  handleMarqueePointerDown: (event: KonvaEventObject<PointerEvent>) => void;
  handleMarqueePointerMove: () => void;
  handleMarqueePointerUp: () => void;
  handleMarqueeCancel: () => void;
}

/** The armed tool, or null when the finger belongs to the camera. */
export function useArmedTouchTool({
  drawMode,
  selectMode,
  handleDrawMouseDown,
  handleDrawMouseMove,
  handleDrawMouseUp,
  handleDrawCancel,
  handleMarqueePointerDown,
  handleMarqueePointerMove,
  handleMarqueePointerUp,
  handleMarqueeCancel,
}: UseArmedTouchToolProps): ArmedTouchTool | null {
  return useMemo(() => {
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
    handleDrawMouseDown,
    handleDrawMouseMove,
    handleDrawMouseUp,
    handleDrawCancel,
    handleMarqueePointerDown,
    handleMarqueePointerMove,
    handleMarqueePointerUp,
    handleMarqueeCancel,
  ]);
}
