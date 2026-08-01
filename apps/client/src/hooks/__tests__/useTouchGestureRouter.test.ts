import { act, renderHook } from "@testing-library/react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTouchGestureRouter } from "../useTouchGestureRouter";

/** Konva hands the raw TouchEvent through on `.evt`; only `touches.length` is read. */
function touchEvent(fingers: number): KonvaEventObject<TouchEvent> {
  return {
    evt: { touches: { length: fingers } },
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

  const setup = (toolArmed: boolean) =>
    renderHook(() =>
      useTouchGestureRouter({
        toolArmed,
        // Mirrors production: shouldPan is the negation of "a tool owns the pointer".
        shouldPan: !toolArmed,
        stageRef,
        onCameraStart,
        onCameraMove,
        onCameraEnd,
        onToolStart,
        onToolMove,
        onToolCommit,
        onToolCancel,
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

      expect(onToolStart).toHaveBeenCalledWith(stageRef);
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
