import { act, renderHook } from "@testing-library/react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTouchGestureRouter } from "../useTouchGestureRouter";

/**
 * Konva hands the raw TouchEvent through on `.evt`. `touches.length` is what
 * the finger-count arbitration reads; `cancelable` + `preventDefault` are what
 * the compat-mouse claim reads (see the hook's note on event duplication).
 */
function touchEvent(
  fingers: number,
  options: { cancelable?: boolean } = {},
): KonvaEventObject<TouchEvent> {
  return {
    evt: {
      touches: { length: fingers },
      cancelable: options.cancelable ?? true,
      preventDefault: vi.fn(),
    },
  } as unknown as KonvaEventObject<TouchEvent>;
}

describe("useTouchGestureRouter", () => {
  const onCameraStart = vi.fn();
  const onCameraMove = vi.fn();
  const onCameraEnd = vi.fn();
  const onToolStart = vi.fn();
  const onToolMove = vi.fn();
  const onToolCommit = vi.fn();
  const onToolCancel = vi.fn();
  const stageRef = { current: null } as React.RefObject<Konva.Stage | null>;

  const tool = {
    start: onToolStart,
    move: onToolMove,
    commit: onToolCommit,
    cancel: onToolCancel,
  };

  const setup = (toolArmed: boolean) =>
    renderHook(() =>
      useTouchGestureRouter({
        tool: toolArmed ? tool : null,
        // Mirrors production: shouldPan is the negation of "a tool owns the pointer".
        shouldPan: !toolArmed,
        stageRef,
        onCameraStart,
        onCameraMove,
        onCameraEnd,
      }),
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("one finger with a tool armed", () => {
    it("drives the tool through start, move and commit", () => {
      const { result } = setup(true);

      act(() => result.current.onTouchStart(touchEvent(1)));
      act(() => result.current.onTouchMove(touchEvent(1)));
      act(() => result.current.onTouchEnd());

      // start gets the event too — the marquee needs it to check the press
      // landed on the stage rather than on a shape.
      expect(onToolStart).toHaveBeenCalledWith(expect.anything(), stageRef);
      expect(onToolMove).toHaveBeenCalledWith(stageRef);
      expect(onToolCommit).toHaveBeenCalledTimes(1);
      expect(onToolCancel).not.toHaveBeenCalled();
    });

    it("still forwards to the camera so pinch stays reachable", () => {
      const { result } = setup(true);

      act(() => result.current.onTouchStart(touchEvent(1)));
      act(() => result.current.onTouchMove(touchEvent(1)));
      act(() => result.current.onTouchEnd());

      expect(onCameraStart).toHaveBeenCalledTimes(1);
      expect(onCameraMove).toHaveBeenCalledTimes(1);
      expect(onCameraEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe("one finger with no tool armed", () => {
    it("leaves the pointer to the camera", () => {
      const { result } = setup(false);

      act(() => result.current.onTouchStart(touchEvent(1)));
      act(() => result.current.onTouchMove(touchEvent(1)));
      act(() => result.current.onTouchEnd());

      expect(onToolStart).not.toHaveBeenCalled();
      expect(onToolMove).not.toHaveBeenCalled();
      expect(onToolCommit).not.toHaveBeenCalled();
      expect(onCameraStart).toHaveBeenCalledWith(expect.anything(), stageRef, true);
    });
  });

  describe("a second finger lands mid-stroke", () => {
    it("cancels the stroke instead of committing it", () => {
      const { result } = setup(true);

      act(() => result.current.onTouchStart(touchEvent(1)));
      act(() => result.current.onTouchMove(touchEvent(1)));
      // Second finger down: touches.length is 2 on this touchstart.
      act(() => result.current.onTouchStart(touchEvent(2)));

      expect(onToolCancel).toHaveBeenCalledTimes(1);
      expect(onToolCommit).not.toHaveBeenCalled();
    });

    it("does not commit when the fingers finally lift", () => {
      const { result } = setup(true);

      act(() => result.current.onTouchStart(touchEvent(1)));
      act(() => result.current.onTouchStart(touchEvent(2)));
      act(() => result.current.onTouchEnd());

      expect(onToolCommit).not.toHaveBeenCalled();
      expect(onToolCancel).toHaveBeenCalledTimes(1);
    });

    it("cancels when the extra finger lands off-canvas and only touchmove sees it", () => {
      const { result } = setup(true);

      act(() => result.current.onTouchStart(touchEvent(1)));
      act(() => result.current.onTouchMove(touchEvent(1)));
      // A finger on the toolbar/dock never reaches the stage's touchstart, but
      // `touches` is document-wide so the stage's touchmove reports 2.
      act(() => result.current.onTouchMove(touchEvent(2)));
      act(() => result.current.onTouchEnd());

      expect(onToolCancel).toHaveBeenCalledTimes(1);
      expect(onToolCommit).not.toHaveBeenCalled();
    });

    it("stops feeding the tool once the gesture belongs to the camera", () => {
      const { result } = setup(true);

      act(() => result.current.onTouchStart(touchEvent(1)));
      act(() => result.current.onTouchStart(touchEvent(2)));
      act(() => result.current.onTouchMove(touchEvent(2)));

      expect(onToolMove).not.toHaveBeenCalled();
      expect(onCameraMove).toHaveBeenCalledTimes(1);
    });
  });

  describe("two fingers from the outset", () => {
    it("never starts the tool", () => {
      const { result } = setup(true);

      act(() => result.current.onTouchStart(touchEvent(2)));
      act(() => result.current.onTouchMove(touchEvent(2)));
      act(() => result.current.onTouchEnd());

      expect(onToolStart).not.toHaveBeenCalled();
      expect(onToolCommit).not.toHaveBeenCalled();
      // Nothing was in flight, so there is nothing to cancel either.
      expect(onToolCancel).not.toHaveBeenCalled();
    });
  });

  describe("touchcancel", () => {
    it("discards an in-flight stroke when the OS takes the gesture", () => {
      const { result } = setup(true);

      act(() => result.current.onTouchStart(touchEvent(1)));
      act(() => result.current.onTouchCancel());

      expect(onToolCancel).toHaveBeenCalledTimes(1);
      expect(onToolCommit).not.toHaveBeenCalled();
      expect(onCameraEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe("handler freshness", () => {
    /**
     * The tool object is rebuilt mid-gesture in production: useDrawingTool
     * hands back a new onMouseMove the instant `isDrawing` flips true, which
     * happens on the very touchstart that begins the stroke. Pinning the tool
     * at touchstart therefore calls the closure captured BEFORE the stroke
     * began, where every move returns early — it silently killed drawing while
     * leaving every other assertion green.
     */
    it("uses the latest tool object, not the one captured at touchstart", () => {
      const staleMove = vi.fn();
      const freshMove = vi.fn();
      const staleCommit = vi.fn();
      const freshCommit = vi.fn();

      const { result, rerender } = renderHook(
        ({ move, commit }: { move: () => void; commit: () => void }) =>
          useTouchGestureRouter({
            tool: { start: onToolStart, move, commit, cancel: onToolCancel },
            shouldPan: false,
            stageRef,
            onCameraStart,
            onCameraMove,
            onCameraEnd,
          }),
        { initialProps: { move: staleMove, commit: staleCommit } },
      );

      act(() => result.current.onTouchStart(touchEvent(1)));
      // The tool identity changes, exactly as it does when isDrawing flips.
      rerender({ move: freshMove, commit: freshCommit });
      act(() => result.current.onTouchMove(touchEvent(1)));
      act(() => result.current.onTouchEnd());

      expect(freshMove).toHaveBeenCalledTimes(1);
      expect(freshCommit).toHaveBeenCalledTimes(1);
      expect(staleMove).not.toHaveBeenCalled();
      expect(staleCommit).not.toHaveBeenCalled();
    });
  });

  describe("claiming the finger from the compat mouse path", () => {
    // The failure this closes is invisible in the DOM: the compat pair runs the
    // SAME handlers, so a doubled gesture leaves the map looking right and the
    // undo stack twice as deep. Measured on the wire at 2 paint-terrain
    // commands per tap before this, 1 after.
    it("cancels the touchstart a tool takes, so the browser sends no mouse pair", () => {
      const { result } = setup(true);
      const event = touchEvent(1);

      act(() => result.current.onTouchStart(event));

      expect(event.evt.preventDefault).toHaveBeenCalledTimes(1);
      expect(onToolStart).toHaveBeenCalledTimes(1);
    });

    it("leaves a camera gesture alone — nothing armed means the tap is the map's", () => {
      const { result } = setup(false);
      const event = touchEvent(1);

      act(() => result.current.onTouchStart(event));

      expect(event.evt.preventDefault).not.toHaveBeenCalled();
    });

    it("leaves the SECOND finger alone: a pinch must keep the browser's default", () => {
      const { result } = setup(true);
      act(() => result.current.onTouchStart(touchEvent(1)));

      const second = touchEvent(2);
      act(() => result.current.onTouchStart(second));

      expect(second.evt.preventDefault).not.toHaveBeenCalled();
      expect(onToolCancel).toHaveBeenCalledTimes(1);
    });

    it("does not call preventDefault on an uncancelable touchstart", () => {
      // The browser has already committed that gesture to scrolling; calling it
      // there earns a console warning and changes nothing.
      const { result } = setup(true);
      const event = touchEvent(1, { cancelable: false });

      act(() => result.current.onTouchStart(event));

      expect(event.evt.preventDefault).not.toHaveBeenCalled();
      expect(onToolStart).toHaveBeenCalledTimes(1);
    });
  });

  describe("gesture isolation", () => {
    it("does not leak an active stroke into the next gesture", () => {
      const { result } = setup(true);

      act(() => result.current.onTouchStart(touchEvent(1)));
      act(() => result.current.onTouchEnd());
      // A stray touchend with nothing in flight must not commit a second time.
      act(() => result.current.onTouchEnd());

      expect(onToolCommit).toHaveBeenCalledTimes(1);
    });
  });
});
