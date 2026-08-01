/**
 * useTouchGestureRouter
 *
 * Finger-count arbitration for the map canvas.
 *
 * The mouse path can be naive about this: a mouse has one cursor and a button
 * that is either down or up, so every tool can self-gate on its own mode flag
 * and they never collide. Touch has no such guarantee. The same surface has to
 * carry both "I am using a tool" and "I am moving the map", and the only thing
 * distinguishing them is how many fingers are down.
 *
 * The contract:
 *
 *   1 finger  -> the armed tool (today: drawing), or the camera if no tool is
 *                armed. `shouldPan` already encodes that second half — it is
 *                false whenever a tool owns the pointer — so the two never
 *                both claim a single finger.
 *   2 fingers -> always the camera. Pinch stays ungated so the user can never
 *                lose the ability to move the map, whatever tool is selected.
 *   1 -> 2    -> CANCEL the in-flight tool gesture. Not commit it. Someone who
 *                starts a stroke and then reaches for a second finger wants to
 *                zoom; committing at that point leaves a stray mark on the map
 *                every time they do it.
 *
 * touchcancel (the OS taking the gesture away — an incoming call, the app
 * backgrounding) discards too, for the same reason.
 *
 * NOTE ON EVENT DUPLICATION: browsers can synthesise compatibility mouse
 * events from touch, which would double-fire against the mouse path that
 * already routes to these same tool handlers. Measured under Chromium touch
 * emulation in apps/e2e/mobile/mobile-draw.spec.ts: a one-finger drag produces
 * zero mousedown and zero mouseup. If that ever changes, this is the seam
 * where it would show up as doubled strokes.
 *
 * @module hooks/useTouchGestureRouter
 */

import { useCallback, useRef, type RefObject } from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";

export interface UseTouchGestureRouterProps {
  /** True when a one-finger tool owns the pointer. Today: draw mode. */
  toolArmed: boolean;
  /** False when any tool owns the pointer — the camera's own gate. */
  shouldPan: boolean;
  stageRef: RefObject<Konva.Stage | null>;

  // Camera
  onCameraStart: (
    event: KonvaEventObject<TouchEvent>,
    stageRef: RefObject<Konva.Stage | null>,
    shouldPan: boolean,
  ) => void;
  onCameraMove: (
    event: KonvaEventObject<TouchEvent>,
    stageRef: RefObject<Konva.Stage | null>,
  ) => void;
  onCameraEnd: () => void;

  // Armed tool
  onToolStart: (stageRef: RefObject<Konva.Stage | null>) => void;
  onToolMove: (stageRef: RefObject<Konva.Stage | null>) => void;
  onToolCommit: () => void;
  onToolCancel: () => void;
}

export interface UseTouchGestureRouterReturn {
  onTouchStart: (event: KonvaEventObject<TouchEvent>) => void;
  onTouchMove: (event: KonvaEventObject<TouchEvent>) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
}

export function useTouchGestureRouter({
  toolArmed,
  shouldPan,
  stageRef,
  onCameraStart,
  onCameraMove,
  onCameraEnd,
  onToolStart,
  onToolMove,
  onToolCommit,
  onToolCancel,
}: UseTouchGestureRouterProps): UseTouchGestureRouterReturn {
  // Whether a one-finger tool gesture is in flight. A ref, not state: it is
  // read and written inside the same event tick that Konva dispatches, and a
  // re-render between touchstart and touchmove would drop the stroke.
  const toolGestureActive = useRef(false);

  const onTouchStart = useCallback(
    (event: KonvaEventObject<TouchEvent>) => {
      const fingers = event.evt.touches.length;

      if (fingers > 1) {
        // Promotion to a camera gesture. Discard whatever the tool had.
        if (toolGestureActive.current) {
          toolGestureActive.current = false;
          onToolCancel();
        }
      } else if (toolArmed) {
        toolGestureActive.current = true;
        onToolStart(stageRef);
      }

      onCameraStart(event, stageRef, shouldPan);
    },
    [toolArmed, shouldPan, stageRef, onCameraStart, onToolStart, onToolCancel],
  );

  const onTouchMove = useCallback(
    (event: KonvaEventObject<TouchEvent>) => {
      if (toolGestureActive.current && event.evt.touches.length === 1) {
        onToolMove(stageRef);
      }

      onCameraMove(event, stageRef);
    },
    [stageRef, onCameraMove, onToolMove],
  );

  const onTouchEnd = useCallback(() => {
    if (toolGestureActive.current) {
      toolGestureActive.current = false;
      onToolCommit();
    }

    onCameraEnd();
  }, [onCameraEnd, onToolCommit]);

  const onTouchCancel = useCallback(() => {
    if (toolGestureActive.current) {
      toolGestureActive.current = false;
      onToolCancel();
    }

    onCameraEnd();
  }, [onCameraEnd, onToolCancel]);

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel };
}
