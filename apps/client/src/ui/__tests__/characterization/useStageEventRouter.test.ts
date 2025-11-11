/**
 * Characterization tests for useStageEventRouter hook
 *
 * These tests capture the current behavior of the unified event routing system
 * BEFORE extracting it from MapBoard.tsx into a standalone hook.
 *
 * Source: MapBoard.tsx lines 268-391 (unified event handlers)
 * Target: /hooks/useStageEventRouter.ts
 *
 * The hook coordinates event delegation based on active tool modes:
 * - alignmentMode: Map grid alignment
 * - selectMode: Marquee selection
 * - pointerMode: Pointer indicator
 * - measureMode: Distance measurement
 * - drawMode: Freehand drawing
 * - transformMode: Object transformation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useStageEventRouter } from "../../../hooks/useStageEventRouter";
import type { KonvaEventObject } from "konva/lib/Node";

describe("useStageEventRouter", () => {
  // Mock dependencies
  const mockHandleAlignmentClick = vi.fn();
  const mockHandlePointerClick = vi.fn();
  const mockHandleCameraMouseDown = vi.fn();
  const mockHandleDrawMouseDown = vi.fn();
  const mockHandleMarqueePointerDown = vi.fn();
  const mockHandleCameraMouseMove = vi.fn();
  const mockHandlePointerMouseMove = vi.fn();
  const mockHandleDrawMouseMove = vi.fn();
  const mockHandleMarqueePointerMove = vi.fn();
  const mockHandleCameraMouseUp = vi.fn();
  const mockHandleDrawMouseUp = vi.fn();
  const mockHandleMarqueePointerUp = vi.fn();
  const mockOnSelectObject = vi.fn();
  const mockDeselectIfEmpty = vi.fn();
  const mockStageRef = { current: null };

  const defaultProps = {
    alignmentMode: false,
    selectMode: false,
    pointerMode: false,
    measureMode: false,
    drawMode: false,
    handleAlignmentClick: mockHandleAlignmentClick,
    handlePointerClick: mockHandlePointerClick,
    handleCameraMouseDown: mockHandleCameraMouseDown,
    handleDrawMouseDown: mockHandleDrawMouseDown,
    handleMarqueePointerDown: mockHandleMarqueePointerDown,
    handleCameraMouseMove: mockHandleCameraMouseMove,
    handlePointerMouseMove: mockHandlePointerMouseMove,
    handleDrawMouseMove: mockHandleDrawMouseMove,
    handleMarqueePointerMove: mockHandleMarqueePointerMove,
    handleCameraMouseUp: mockHandleCameraMouseUp,
    handleDrawMouseUp: mockHandleDrawMouseUp,
    handleMarqueePointerUp: mockHandleMarqueePointerUp,
    isMarqueeActive: false,
    onSelectObject: mockOnSelectObject,
    deselectIfEmpty: mockDeselectIfEmpty,
    stageRef: mockStageRef,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("onStageClick routing", () => {
    it("routes to alignment handler when alignmentMode is true", () => {
      const { result } = renderHook(() =>
        useStageEventRouter({
          ...defaultProps,
          alignmentMode: true,
        }),
      );

      const mockEvent = {} as KonvaEventObject<MouseEvent>;
      result.current.onStageClick(mockEvent);

      expect(mockHandleAlignmentClick).toHaveBeenCalledWith(mockEvent);
      expect(mockHandlePointerClick).not.toHaveBeenCalled();
      expect(mockOnSelectObject).not.toHaveBeenCalled();
    });

    it("returns early in select mode without calling handlers", () => {
      const { result } = renderHook(() =>
        useStageEventRouter({
          ...defaultProps,
          selectMode: true,
        }),
      );

      const mockEvent = {} as KonvaEventObject<MouseEvent>;
      result.current.onStageClick(mockEvent);

      expect(mockHandleAlignmentClick).not.toHaveBeenCalled();
      expect(mockHandlePointerClick).not.toHaveBeenCalled();
      expect(mockOnSelectObject).not.toHaveBeenCalled();
      expect(mockDeselectIfEmpty).not.toHaveBeenCalled();
    });

    it("clears selection when no tools are active and stage is clicked", () => {
      // Create a mock stage that returns itself when getStage is called
      const mockStage = {
        getStage: () => mockStage,
      };

      const mockEvent = {
        target: mockStage,
      } as unknown as KonvaEventObject<MouseEvent>;

      const { result } = renderHook(() =>
        useStageEventRouter({
          ...defaultProps,
          // All modes false
        }),
      );

      result.current.onStageClick(mockEvent);

      expect(mockOnSelectObject).toHaveBeenCalledWith(null);
      expect(mockDeselectIfEmpty).toHaveBeenCalledWith(mockEvent);
      expect(mockHandlePointerClick).not.toHaveBeenCalled();
    });

    it("routes to pointer click handler when pointerMode is active", () => {
      const { result } = renderHook(() =>
        useStageEventRouter({
          ...defaultProps,
          pointerMode: true,
        }),
      );

      const mockEvent = {} as KonvaEventObject<MouseEvent>;
      result.current.onStageClick(mockEvent);

      expect(mockHandlePointerClick).toHaveBeenCalledWith(mockEvent);
      expect(mockOnSelectObject).not.toHaveBeenCalled();
    });

    it("routes to pointer click handler when measureMode is active", () => {
      const { result } = renderHook(() =>
        useStageEventRouter({
          ...defaultProps,
          measureMode: true,
        }),
      );

      const mockEvent = {} as KonvaEventObject<MouseEvent>;
      result.current.onStageClick(mockEvent);

      expect(mockHandlePointerClick).toHaveBeenCalledWith(mockEvent);
    });

    it("routes to pointer click handler when drawMode is active", () => {
      const { result } = renderHook(() =>
        useStageEventRouter({
          ...defaultProps,
          drawMode: true,
        }),
      );

      const mockEvent = {} as KonvaEventObject<MouseEvent>;
      result.current.onStageClick(mockEvent);

      expect(mockHandlePointerClick).toHaveBeenCalledWith(mockEvent);
    });

    it("prioritizes alignment mode over other modes", () => {
      const { result } = renderHook(() =>
        useStageEventRouter({
          ...defaultProps,
          alignmentMode: true,
          pointerMode: true,
          measureMode: true,
        }),
      );

      const mockEvent = {} as KonvaEventObject<MouseEvent>;
      result.current.onStageClick(mockEvent);

      expect(mockHandleAlignmentClick).toHaveBeenCalledWith(mockEvent);
      expect(mockHandlePointerClick).not.toHaveBeenCalled();
    });

    it("prioritizes select mode over pointer/measure/draw modes", () => {
      const { result } = renderHook(() =>
        useStageEventRouter({
          ...defaultProps,
          selectMode: true,
          pointerMode: true,
          measureMode: true,
          drawMode: true,
        }),
      );

      const mockEvent = {} as KonvaEventObject<MouseEvent>;
      result.current.onStageClick(mockEvent);

      expect(mockHandlePointerClick).not.toHaveBeenCalled();
      expect(mockOnSelectObject).not.toHaveBeenCalled();
    });
  });

  describe("onMouseDown routing", () => {
    it("enables panning when no tools are active", () => {
      const { result } = renderHook(() =>
        useStageEventRouter({
          ...defaultProps,
          // All modes false
        }),
      );

      const mockEvent = {} as KonvaEventObject<PointerEvent>;
      result.current.onMouseDown(mockEvent);

      expect(mockHandleCameraMouseDown).toHaveBeenCalledWith(
        mockEvent,
        mockStageRef,
        true, // shouldPan = true
      );
    });

    it("disables panning when alignmentMode is active", () => {
      const { result } = renderHook(() =>
        useStageEventRouter({
          ...defaultProps,
          alignmentMode: true,
        }),
      );

      const mockEvent = {} as KonvaEventObject<PointerEvent>;
      result.current.onMouseDown(mockEvent);

      expect(mockHandleCameraMouseDown).toHaveBeenCalledWith(
        mockEvent,
        mockStageRef,
        false, // shouldPan = false
      );
    });

    it("disables panning when pointerMode is active", () => {
      const { result } = renderHook(() =>
        useStageEventRouter({
          ...defaultProps,
          pointerMode: true,
        }),
      );

      const mockEvent = {} as KonvaEventObject<PointerEvent>;
      result.current.onMouseDown(mockEvent);

      expect(mockHandleCameraMouseDown).toHaveBeenCalledWith(mockEvent, mockStageRef, false);
    });

    it("disables panning when measureMode is active", () => {
      const { result } = renderHook(() =>
        useStageEventRouter({
          ...defaultProps,
          measureMode: true,
        }),
      );

      const mockEvent = {} as KonvaEventObject<PointerEvent>;
      result.current.onMouseDown(mockEvent);

      expect(mockHandleCameraMouseDown).toHaveBeenCalledWith(mockEvent, mockStageRef, false);
    });

    it("disables panning when drawMode is active", () => {
      const { result } = renderHook(() =>
        useStageEventRouter({
          ...defaultProps,
          drawMode: true,
        }),
      );

      const mockEvent = {} as KonvaEventObject<PointerEvent>;
      result.current.onMouseDown(mockEvent);

      expect(mockHandleCameraMouseDown).toHaveBeenCalledWith(mockEvent, mockStageRef, false);
    });

    it("disables panning when selectMode is active", () => {
      const { result } = renderHook(() =>
        useStageEventRouter({
          ...defaultProps,
          selectMode: true,
        }),
      );

      const mockEvent = {} as KonvaEventObject<PointerEvent>;
      result.current.onMouseDown(mockEvent);

      expect(mockHandleCameraMouseDown).toHaveBeenCalledWith(mockEvent, mockStageRef, false);
    });

    it("calls all three handlers in correct order", () => {
      const { result } = renderHook(() => useStageEventRouter(defaultProps));

      const callOrder: string[] = [];
      mockHandleCameraMouseDown.mockImplementation(() => callOrder.push("camera"));
      mockHandleDrawMouseDown.mockImplementation(() => callOrder.push("draw"));
      mockHandleMarqueePointerDown.mockImplementation(() => callOrder.push("marquee"));

      const mockEvent = {} as KonvaEventObject<PointerEvent>;
      result.current.onMouseDown(mockEvent);

      expect(callOrder).toEqual(["camera", "draw", "marquee"]);
      expect(mockHandleDrawMouseDown).toHaveBeenCalledWith(mockStageRef);
      expect(mockHandleMarqueePointerDown).toHaveBeenCalledWith(mockEvent);
    });

    it("disables panning when multiple tools are active", () => {
      const { result } = renderHook(() =>
        useStageEventRouter({
          ...defaultProps,
          alignmentMode: true,
          pointerMode: true,
          measureMode: true,
          drawMode: true,
          selectMode: true,
        }),
      );

      const mockEvent = {} as KonvaEventObject<PointerEvent>;
      result.current.onMouseDown(mockEvent);

      expect(mockHandleCameraMouseDown).toHaveBeenCalledWith(mockEvent, mockStageRef, false);
    });
  });

  describe("onMouseMove routing", () => {
    it("delegates to all four move handlers", () => {
      const { result } = renderHook(() => useStageEventRouter(defaultProps));

      result.current.onMouseMove();

      expect(mockHandleCameraMouseMove).toHaveBeenCalledWith(mockStageRef);
      expect(mockHandlePointerMouseMove).toHaveBeenCalledWith(mockStageRef);
      expect(mockHandleDrawMouseMove).toHaveBeenCalledWith(mockStageRef);
      expect(mockHandleMarqueePointerMove).toHaveBeenCalled();
    });

    it("calls handlers in correct order", () => {
      const { result } = renderHook(() => useStageEventRouter(defaultProps));

      const callOrder: string[] = [];
      mockHandleCameraMouseMove.mockImplementation(() => callOrder.push("camera"));
      mockHandlePointerMouseMove.mockImplementation(() => callOrder.push("pointer"));
      mockHandleDrawMouseMove.mockImplementation(() => callOrder.push("draw"));
      mockHandleMarqueePointerMove.mockImplementation(() => callOrder.push("marquee"));

      result.current.onMouseMove();

      expect(callOrder).toEqual(["camera", "pointer", "draw", "marquee"]);
    });

    it("delegates regardless of active tool modes", () => {
      const { result } = renderHook(() =>
        useStageEventRouter({
          ...defaultProps,
          alignmentMode: true,
          pointerMode: true,
          measureMode: true,
          drawMode: true,
          selectMode: true,
        }),
      );

      result.current.onMouseMove();

      expect(mockHandleCameraMouseMove).toHaveBeenCalled();
      expect(mockHandlePointerMouseMove).toHaveBeenCalled();
      expect(mockHandleDrawMouseMove).toHaveBeenCalled();
      expect(mockHandleMarqueePointerMove).toHaveBeenCalled();
    });
  });

  describe("onMouseUp routing", () => {
    it("delegates to camera and draw handlers when marquee is inactive", () => {
      const { result } = renderHook(() =>
        useStageEventRouter({
          ...defaultProps,
          isMarqueeActive: false,
        }),
      );

      result.current.onMouseUp();

      expect(mockHandleCameraMouseUp).toHaveBeenCalled();
      expect(mockHandleDrawMouseUp).toHaveBeenCalled();
      expect(mockHandleMarqueePointerUp).not.toHaveBeenCalled();
    });

    it("also calls marquee handler when marquee is active", () => {
      const { result } = renderHook(() =>
        useStageEventRouter({
          ...defaultProps,
          isMarqueeActive: true,
        }),
      );

      result.current.onMouseUp();

      expect(mockHandleCameraMouseUp).toHaveBeenCalled();
      expect(mockHandleDrawMouseUp).toHaveBeenCalled();
      expect(mockHandleMarqueePointerUp).toHaveBeenCalled();
    });

    it("calls handlers in correct order", () => {
      const { result } = renderHook(() =>
        useStageEventRouter({
          ...defaultProps,
          isMarqueeActive: true,
        }),
      );

      const callOrder: string[] = [];
      mockHandleCameraMouseUp.mockImplementation(() => callOrder.push("camera"));
      mockHandleDrawMouseUp.mockImplementation(() => callOrder.push("draw"));
      mockHandleMarqueePointerUp.mockImplementation(() => callOrder.push("marquee"));

      result.current.onMouseUp();

      expect(callOrder).toEqual(["camera", "draw", "marquee"]);
    });

    it("delegates regardless of active tool modes (except marquee)", () => {
      const { result } = renderHook(() =>
        useStageEventRouter({
          ...defaultProps,
          alignmentMode: true,
          pointerMode: true,
          measureMode: true,
          drawMode: true,
          selectMode: true,
          isMarqueeActive: false,
        }),
      );

      result.current.onMouseUp();

      expect(mockHandleCameraMouseUp).toHaveBeenCalled();
      expect(mockHandleDrawMouseUp).toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("handles missing onSelectObject callback gracefully", () => {
      const mockStage = {};
      const mockEvent = {
        target: {
          getStage: () => mockStage,
        },
      } as unknown as KonvaEventObject<MouseEvent>;

      Object.defineProperty(mockEvent, "target", {
        value: mockStage,
        writable: false,
      });

      const { result } = renderHook(() =>
        useStageEventRouter({
          ...defaultProps,
          onSelectObject: undefined,
        }),
      );

      // Should not throw
      expect(() => result.current.onStageClick(mockEvent)).not.toThrow();
      expect(mockDeselectIfEmpty).toHaveBeenCalledWith(mockEvent);
    });

    it("handles event with no stage gracefully", () => {
      const mockEvent = {
        target: {
          getStage: () => null,
        },
      } as unknown as KonvaEventObject<MouseEvent>;

      const { result } = renderHook(() => useStageEventRouter(defaultProps));

      // Should not throw
      expect(() => result.current.onStageClick(mockEvent)).not.toThrow();
    });

    it("does not call onSelectObject when event target is not the stage", () => {
      const mockStage = {
        id: "stage",
        getStage: function () {
          return this;
        },
      };
      const mockTarget = {
        id: "other",
        getStage: () => mockStage,
      };
      const mockEvent = {
        target: mockTarget,
      } as unknown as KonvaEventObject<MouseEvent>;

      const { result } = renderHook(() => useStageEventRouter(defaultProps));

      result.current.onStageClick(mockEvent);

      expect(mockOnSelectObject).not.toHaveBeenCalled();
      expect(mockDeselectIfEmpty).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe("handler stability", () => {
    it("returns stable handler references across renders", () => {
      const { result, rerender } = renderHook(() => useStageEventRouter(defaultProps));

      const firstHandlers = result.current;
      rerender();
      const secondHandlers = result.current;

      expect(firstHandlers.onStageClick).toBe(secondHandlers.onStageClick);
      expect(firstHandlers.onMouseDown).toBe(secondHandlers.onMouseDown);
      expect(firstHandlers.onMouseMove).toBe(secondHandlers.onMouseMove);
      expect(firstHandlers.onMouseUp).toBe(secondHandlers.onMouseUp);
    });

    it("updates handlers when dependencies change", () => {
      const { result, rerender } = renderHook(
        (props) => useStageEventRouter(props),
        { initialProps: defaultProps },
      );

      const firstHandlers = result.current;

      rerender({
        ...defaultProps,
        alignmentMode: true,
      });

      const secondHandlers = result.current;

      // Handlers should be new references when dependencies change
      expect(firstHandlers.onStageClick).not.toBe(secondHandlers.onStageClick);
    });
  });
});
