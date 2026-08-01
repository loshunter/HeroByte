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
 * NOTE ON EVENT DUPLICATION: browsers synthesise compatibility mouse events
 * from touch, and the mouse path already routes to these same tool handlers,
 * so the two can double-fire. Both halves are measured under Chromium touch
 * emulation in apps/e2e/mobile/mobile-draw.spec.ts:
 *
 *   DRAG - zero mousedown, zero mouseup. Movement past the tap slop cancels
 *          the tap gesture, so no compat events are generated. Strokes drawn
 *          by dragging commit exactly once.
 *   TAP  - compat events DO fire. Measured directly: with the degenerate-shape
 *          guard removed, two taps produced FOUR drawings, one per path per
 *          tap. The guard in useDrawingTool.onMouseUp rejects a zero-size
 *          shape, which closes both paths at once rather than trying to
 *          de-duplicate the events.
 *
 * So a drag is safe by mechanism and a tap is safe by the send gate. If that
 * gate is ever loosened, this is the seam where doubling reappears.
 *
 * @module hooks/useTouchGestureRouter
 */

import { useCallback, useEffect, useRef, type RefObject } from "react";
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
      if (toolGestureActive.current) {
        if (event.evt.touches.length === 1) {
          onToolMove(stageRef);
        } else {
          /*
           * `touches` is document-wide, so a finger landing anywhere — the
           * toolbar, the dock, the bezel — makes this 2 without ever reaching
           * the stage's touchstart. Cancel rather than fall through: skipping
           * the move alone would freeze the stroke and then COMMIT the
           * truncated version on lift, which is worse than discarding it.
           */
          toolGestureActive.current = false;
          onToolCancel();
        }
      }

      onCameraMove(event, stageRef);
    },
    [stageRef, onCameraMove, onToolMove, onToolCancel],
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

  /*
   * touchcancel has to come off the DOM, not off the Konva Stage.
   *
   * react-konva would turn an `onTouchCancel` prop into a node event named
   * "touchcancel", and Konva never fires one: Stage.js maps the DOM event to
   * _pointercancel, which fires the hardcoded `pointerup` constant on an
   * intersected shape and returns (konva 10.0.2, Stage.js:598-606). On an
   * empty canvas no shape is hit and nothing runs at all. Verified by reading
   * the installed package — the EVENTS_MAP touchcancel entry is unreachable.
   *
   * Without this the OS taking a gesture away (a call, the notification shade,
   * backgrounding) leaves the half-drawn stroke painted until the next touch.
   */
  useEffect(() => {
    // Optional-called: test doubles for the Stage do not implement container().
    const container = stageRef.current?.container?.();
    if (!container?.addEventListener) return;

    const handle = () => onTouchCancel();
    container.addEventListener("touchcancel", handle);
    return () => container.removeEventListener("touchcancel", handle);
  }, [stageRef, onTouchCancel]);

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel };
}
