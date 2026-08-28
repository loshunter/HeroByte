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
 *   1 finger  -> the armed tool (drawing or marquee-select, whichever owns the
 *                pointer — see useArmedTouchTool), or the camera if none is
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
 *   TAP  - compat events fire unless the touchstart is cancelled. Measured
 *          directly: with the degenerate-shape guard removed, two taps
 *          produced FOUR drawings, one per path per tap.
 *
 * So the drag half is safe by mechanism. The tap half is closed HERE, by
 * calling preventDefault on the touchstart that a tool takes ownership of —
 * the Touch Events spec's own way of saying "this finger is not also a mouse".
 * Only when a tool owns it: a camera gesture wants the browser's default
 * behaviour, and a tap with nothing armed must still reach the map (which is
 * why mobile-draw's idle-tap recorder still sees the pair).
 *
 * M6 is why this became necessary rather than merely tidy. A drag tool
 * survived the doubling because a tap makes a zero-length drag that
 * commitSegmentDrag rejects, and drawing survives it by the same kind of send
 * gate. A BRUSH has no such guard — painting one cell is exactly what a tap is
 * for — so the repeat committed a second identical paint-terrain command and
 * cost two undo steps for one cell. Measured at 2 before this line existed and
 * 1 after, in mobile-map-edit-paint.spec.ts.
 *
 * Konva's own `tap` is unaffected: it is synthesised from the touch events
 * themselves, not from the compat mouse pair, so onTap keeps firing and the
 * click-shaped tools keep working.
 *
 * @module hooks/useTouchGestureRouter
 */

import { useCallback, useEffect, useRef, type RefObject } from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { ArmedTouchTool } from "./useArmedTouchTool";

export interface UseTouchGestureRouterProps {
  /** The tool that owns a one-finger gesture, or null for camera-only. */
  tool: ArmedTouchTool | null;
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
}

export interface UseTouchGestureRouterReturn {
  onTouchStart: (event: KonvaEventObject<TouchEvent>) => void;
  onTouchMove: (event: KonvaEventObject<TouchEvent>) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
}

export function useTouchGestureRouter({
  tool,
  shouldPan,
  stageRef,
  onCameraStart,
  onCameraMove,
  onCameraEnd,
}: UseTouchGestureRouterProps): UseTouchGestureRouterReturn {
  // Whether a one-finger tool gesture is in flight. A ref, not state: it is
  // read and written inside the same event tick that Konva dispatches, and a
  // re-render between touchstart and touchmove would drop the stroke.
  const toolGestureActive = useRef(false);

  /*
   * The latest tool, refreshed every render.
   *
   * It must NOT be pinned at touchstart. The tool object wraps handlers whose
   * identity changes mid-gesture — useDrawingTool rebuilds onMouseMove when
   * `isDrawing` flips true, which happens on the very first touchstart — so a
   * pinned object keeps calling the closure captured before the stroke began,
   * where `isDrawing` is still false and every move returns early. Measured:
   * pinning silently killed drawing while leaving every other assertion green.
   *
   * Assigning during render is the standard latest-ref pattern: idempotent, no
   * subscription, and it has to be readable by an event that may fire before
   * any effect would have run.
   */
  const toolRef = useRef<ArmedTouchTool | null>(tool);
  toolRef.current = tool;

  const onTouchStart = useCallback(
    (event: KonvaEventObject<TouchEvent>) => {
      const fingers = event.evt.touches.length;

      if (fingers > 1) {
        // Promotion to a camera gesture. Discard whatever the tool had.
        if (toolGestureActive.current) {
          toolGestureActive.current = false;
          toolRef.current?.cancel();
        }
      } else if (tool) {
        toolGestureActive.current = true;
        // Claim the finger from the compat mouse path — see the note above.
        // Guarded on `cancelable` only to be honest about it: a touchstart the
        // browser has already committed to scrolling cannot be taken back, and
        // calling preventDefault on one logs a console warning for nothing.
        if (event.evt.cancelable) event.evt.preventDefault();
        tool.start(event, stageRef);
      }

      onCameraStart(event, stageRef, shouldPan);
    },
    [tool, shouldPan, stageRef, onCameraStart],
  );

  const onTouchMove = useCallback(
    (event: KonvaEventObject<TouchEvent>) => {
      if (toolGestureActive.current) {
        if (event.evt.touches.length === 1) {
          toolRef.current?.move(stageRef);
        } else {
          /*
           * `touches` is document-wide, so a finger landing anywhere — the
           * toolbar, the dock, the bezel — makes this 2 without ever reaching
           * the stage's touchstart. Cancel rather than fall through: skipping
           * the move alone would freeze the stroke and then COMMIT the
           * truncated version on lift, which is worse than discarding it.
           */
          toolGestureActive.current = false;
          toolRef.current?.cancel();
        }
      }

      onCameraMove(event, stageRef);
    },
    [stageRef, onCameraMove],
  );

  const onTouchEnd = useCallback(() => {
    if (toolGestureActive.current) {
      toolGestureActive.current = false;
      toolRef.current?.commit();
    }

    onCameraEnd();
  }, [onCameraEnd]);

  const onTouchCancel = useCallback(() => {
    if (toolGestureActive.current) {
      toolGestureActive.current = false;
      toolRef.current?.cancel();
    }

    onCameraEnd();
  }, [onCameraEnd]);

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
