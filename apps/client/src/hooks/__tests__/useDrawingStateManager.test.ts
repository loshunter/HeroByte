// History/clear assertions move to the bounded snapshot-driven suites beside it.
/**
 * Characterization tests for DrawingStateManager
 *
 * These tests capture the behavior of the drawing state management code
 * BEFORE extraction from App.tsx. They serve as regression tests during
 * and after refactoring.
 *
 * Source: apps/client/src/ui/App.tsx (lines 142-159, 447-450, 796-813, 840-865, 921-928)
 * Target: apps/client/src/hooks/useDrawingStateManager.ts
 *
 * Part of Phase 15 SOLID Refactor Initiative - Phase 3, Priority 15
 */

import { renderHook, act } from "@testing-library/react";
import { vi } from "vitest";
import { useDrawingStateManager } from "../useDrawingStateManager";
import type { ClientMessage } from "@herobyte/shared";

describe("useDrawingStateManager - stable settings and props", () => {
  let sendMessageMock: ReturnType<typeof vi.fn<(message: ClientMessage) => void>>;
  let setActiveToolMock: ReturnType<typeof vi.fn<(tool: string | null) => void>>;

  beforeEach(() => {
    sendMessageMock = vi.fn();
    setActiveToolMock = vi.fn();
  });

  describe("initialization", () => {
    it("should initialize with default drawing state values", () => {
      const { result } = renderHook(() =>
        useDrawingStateManager({
          sendMessage: sendMessageMock,
          drawMode: false,
          setActiveTool: setActiveToolMock,
        }),
      );

      // Drawing props should have default values matching useDrawingState
      expect(result.current.drawingProps.drawTool).toBe("freehand");
      expect(result.current.drawingProps.drawColor).toBe("#ffffff");
      expect(result.current.drawingProps.drawWidth).toBe(3);
      expect(result.current.drawingProps.drawOpacity).toBe(1);
      expect(result.current.drawingProps.drawFilled).toBe(false);
    });

    it("should initialize with no undo/redo available", () => {
      const { result } = renderHook(() =>
        useDrawingStateManager({
          sendMessage: sendMessageMock,
          drawMode: false,
          setActiveTool: setActiveToolMock,
        }),
      );

      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });

    it("should provide toolbar props even when drawMode is false", () => {
      const { result } = renderHook(() =>
        useDrawingStateManager({
          sendMessage: sendMessageMock,
          drawMode: false,
          setActiveTool: setActiveToolMock,
        }),
      );

      // Props are always available; App.tsx handles conditional rendering
      expect(result.current.toolbarProps).toBeDefined();
      expect(result.current.toolbarProps.onClose).toBeInstanceOf(Function);
    });
  });

  describe("toolbar props", () => {
    it("should provide complete toolbar props", () => {
      const { result } = renderHook(() =>
        useDrawingStateManager({
          sendMessage: sendMessageMock,
          drawMode: true,
          setActiveTool: setActiveToolMock,
        }),
      );

      expect(result.current.toolbarProps).toEqual({
        drawTool: "freehand",
        drawColor: "#ffffff",
        drawWidth: 3,
        drawOpacity: 1,
        drawFilled: false,
        canUndo: false,
        canRedo: false,
        canClearAll: false,
        onToolChange: expect.any(Function),
        onColorChange: expect.any(Function),
        onWidthChange: expect.any(Function),
        onOpacityChange: expect.any(Function),
        onFilledChange: expect.any(Function),
        onUndo: expect.any(Function),
        onRedo: expect.any(Function),
        onClearAll: expect.any(Function),
        onClose: expect.any(Function),
      });
    });

    it("should call setActiveTool(null) when onClose is called", () => {
      const { result } = renderHook(() =>
        useDrawingStateManager({
          sendMessage: sendMessageMock,
          drawMode: true,
          setActiveTool: setActiveToolMock,
        }),
      );

      act(() => {
        result.current.toolbarProps.onClose();
      });

      expect(setActiveToolMock).toHaveBeenCalledWith(null);
    });

    it("should maintain stable toolbar props references when state changes", () => {
      const { result, rerender } = renderHook(() =>
        useDrawingStateManager({
          sendMessage: sendMessageMock,
          drawMode: true,
          setActiveTool: setActiveToolMock,
        }),
      );

      const firstProps = result.current.toolbarProps;

      rerender();

      const secondProps = result.current.toolbarProps;

      // Props should be referentially stable
      expect(firstProps.onClose).toBe(secondProps.onClose);
      expect(firstProps.onUndo).toBe(secondProps.onUndo);
      expect(firstProps.onRedo).toBe(secondProps.onRedo);
    });
  });

  describe("drawing props for MapBoard", () => {
    it("should provide all required drawing props", () => {
      const { result } = renderHook(() =>
        useDrawingStateManager({
          sendMessage: sendMessageMock,
          drawMode: true,
          setActiveTool: setActiveToolMock,
        }),
      );

      expect(result.current.drawingProps).toEqual({
        drawTool: "freehand",
        drawColor: "#ffffff",
        drawWidth: 3,
        drawOpacity: 1,
        drawFilled: false,
        onDrawingComplete: expect.any(Function),
      });
    });

    it("should maintain stable onDrawingComplete reference", () => {
      const { result, rerender } = renderHook(() =>
        useDrawingStateManager({
          sendMessage: sendMessageMock,
          drawMode: true,
          setActiveTool: setActiveToolMock,
        }),
      );

      const firstCallback = result.current.drawingProps.onDrawingComplete;

      rerender();

      const secondCallback = result.current.drawingProps.onDrawingComplete;

      expect(firstCallback).toBe(secondCallback);
    });
  });

  describe("integration with useDrawingState", () => {
    it("should use the same default values as useDrawingState", () => {
      const { result } = renderHook(() =>
        useDrawingStateManager({
          sendMessage: sendMessageMock,
          drawMode: true,
          setActiveTool: setActiveToolMock,
        }),
      );

      // These defaults come from useDrawingState hook
      expect(result.current.drawingProps.drawTool).toBe("freehand");
      expect(result.current.drawingProps.drawColor).toBe("#ffffff");
      expect(result.current.drawingProps.drawWidth).toBe(3);
      expect(result.current.drawingProps.drawOpacity).toBe(1);
      expect(result.current.drawingProps.drawFilled).toBe(false);
    });
  });
});
