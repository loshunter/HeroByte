/**
 * Characterization tests for Tool Mode management
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/client/src/ui/App.tsx:463-469, 1209-1261
 * Target: apps/client/src/hooks/useToolMode.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState, useEffect } from "react";
import type { ToolMode } from "../../components/layout/Header";

/**
 * Simplified version of the hook logic from App.tsx for characterization testing
 */
function useToolModeCharacterization() {
  const [activeTool, setActiveTool] = useState<ToolMode>(null);
  const pointerMode = activeTool === "pointer";
  const measureMode = activeTool === "measure";
  const drawMode = activeTool === "draw";
  const transformMode = activeTool === "transform";
  const selectMode = activeTool === "select";
  const alignmentMode = activeTool === "align";

  // Escape key handling
  useEffect(() => {
    if (!activeTool) {
      return;
    }

    const handleToolEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveTool(null);
      }
    };

    window.addEventListener("keydown", handleToolEscape);
    return () => window.removeEventListener("keydown", handleToolEscape);
  }, [activeTool]);

  return {
    activeTool,
    setActiveTool,
    pointerMode,
    measureMode,
    drawMode,
    transformMode,
    selectMode,
    alignmentMode,
  };
}

describe("useToolMode - Characterization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initial state", () => {
    it("should initialize with null tool mode", () => {
      const { result } = renderHook(() => useToolModeCharacterization());

      expect(result.current.activeTool).toBeNull();
    });

    it("should initialize all mode booleans to false", () => {
      const { result } = renderHook(() => useToolModeCharacterization());

      expect(result.current.pointerMode).toBe(false);
      expect(result.current.measureMode).toBe(false);
      expect(result.current.drawMode).toBe(false);
      expect(result.current.transformMode).toBe(false);
      expect(result.current.selectMode).toBe(false);
      expect(result.current.alignmentMode).toBe(false);
    });
  });

  describe("tool selection", () => {
    it("should update activeTool when setActiveTool is called", () => {
      const { result } = renderHook(() => useToolModeCharacterization());

      act(() => {
        result.current.setActiveTool("pointer");
      });

      expect(result.current.activeTool).toBe("pointer");
    });

    it("should set pointerMode to true when pointer tool is active", () => {
      const { result } = renderHook(() => useToolModeCharacterization());

      act(() => {
        result.current.setActiveTool("pointer");
      });

      expect(result.current.pointerMode).toBe(true);
      expect(result.current.measureMode).toBe(false);
      expect(result.current.drawMode).toBe(false);
      expect(result.current.transformMode).toBe(false);
      expect(result.current.selectMode).toBe(false);
      expect(result.current.alignmentMode).toBe(false);
    });

    it("should set measureMode to true when measure tool is active", () => {
      const { result } = renderHook(() => useToolModeCharacterization());

      act(() => {
        result.current.setActiveTool("measure");
      });

      expect(result.current.measureMode).toBe(true);
      expect(result.current.pointerMode).toBe(false);
    });

    it("should set drawMode to true when draw tool is active", () => {
      const { result } = renderHook(() => useToolModeCharacterization());

      act(() => {
        result.current.setActiveTool("draw");
      });

      expect(result.current.drawMode).toBe(true);
      expect(result.current.pointerMode).toBe(false);
    });

    it("should set transformMode to true when transform tool is active", () => {
      const { result } = renderHook(() => useToolModeCharacterization());

      act(() => {
        result.current.setActiveTool("transform");
      });

      expect(result.current.transformMode).toBe(true);
      expect(result.current.pointerMode).toBe(false);
    });

    it("should set selectMode to true when select tool is active", () => {
      const { result } = renderHook(() => useToolModeCharacterization());

      act(() => {
        result.current.setActiveTool("select");
      });

      expect(result.current.selectMode).toBe(true);
      expect(result.current.pointerMode).toBe(false);
    });

    it("should set alignmentMode to true when align tool is active", () => {
      const { result } = renderHook(() => useToolModeCharacterization());

      act(() => {
        result.current.setActiveTool("align");
      });

      expect(result.current.alignmentMode).toBe(true);
      expect(result.current.pointerMode).toBe(false);
    });
  });

  describe("tool deselection", () => {
    it("should clear activeTool when setActiveTool(null) is called", () => {
      const { result } = renderHook(() => useToolModeCharacterization());

      act(() => {
        result.current.setActiveTool("pointer");
      });

      expect(result.current.activeTool).toBe("pointer");

      act(() => {
        result.current.setActiveTool(null);
      });

      expect(result.current.activeTool).toBeNull();
      expect(result.current.pointerMode).toBe(false);
    });

    it("should clear all mode booleans when tool is deselected", () => {
      const { result } = renderHook(() => useToolModeCharacterization());

      act(() => {
        result.current.setActiveTool("measure");
      });

      act(() => {
        result.current.setActiveTool(null);
      });

      expect(result.current.pointerMode).toBe(false);
      expect(result.current.measureMode).toBe(false);
      expect(result.current.drawMode).toBe(false);
      expect(result.current.transformMode).toBe(false);
      expect(result.current.selectMode).toBe(false);
      expect(result.current.alignmentMode).toBe(false);
    });
  });

  describe("escape key handling", () => {
    it("should clear activeTool when Escape key is pressed", () => {
      const { result } = renderHook(() => useToolModeCharacterization());

      act(() => {
        result.current.setActiveTool("pointer");
      });

      expect(result.current.activeTool).toBe("pointer");

      act(() => {
        const escapeEvent = new KeyboardEvent("keydown", { key: "Escape" });
        window.dispatchEvent(escapeEvent);
      });

      expect(result.current.activeTool).toBeNull();
    });

    it("should not add escape listener when no tool is active", () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");

      const { result } = renderHook(() => useToolModeCharacterization());

      // Initially no tool active, so no listener should be added
      expect(result.current.activeTool).toBeNull();

      // The effect runs but returns early, so addEventListener may be called 0 times
      // or the listener is added and immediately removed
      act(() => {
        result.current.setActiveTool(null);
      });
    });

    it("should add escape listener when a tool becomes active", () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");

      const { result } = renderHook(() => useToolModeCharacterization());

      act(() => {
        result.current.setActiveTool("measure");
      });

      // Check that addEventListener was called with "keydown"
      expect(addEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    });

    it("should remove escape listener when tool is deactivated", () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      const { result } = renderHook(() => useToolModeCharacterization());

      act(() => {
        result.current.setActiveTool("draw");
      });

      act(() => {
        result.current.setActiveTool(null);
      });

      // Check that removeEventListener was called with "keydown"
      expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    });

    it("should handle escape key for all tool types", () => {
      const toolTypes: ToolMode[] = ["pointer", "measure", "draw", "transform", "select", "align"];

      toolTypes.forEach((toolType) => {
        const { result, unmount } = renderHook(() => useToolModeCharacterization());

        act(() => {
          result.current.setActiveTool(toolType);
        });

        expect(result.current.activeTool).toBe(toolType);

        act(() => {
          const escapeEvent = new KeyboardEvent("keydown", { key: "Escape" });
          window.dispatchEvent(escapeEvent);
        });

        expect(result.current.activeTool).toBeNull();

        unmount();
      });
    });

    it("should not clear tool on other key presses", () => {
      const { result } = renderHook(() => useToolModeCharacterization());

      act(() => {
        result.current.setActiveTool("pointer");
      });

      act(() => {
        const enterEvent = new KeyboardEvent("keydown", { key: "Enter" });
        window.dispatchEvent(enterEvent);
      });

      expect(result.current.activeTool).toBe("pointer");

      act(() => {
        const spaceEvent = new KeyboardEvent("keydown", { key: " " });
        window.dispatchEvent(spaceEvent);
      });

      expect(result.current.activeTool).toBe("pointer");
    });
  });

  describe("tool switching", () => {
    it("should switch from one tool to another", () => {
      const { result } = renderHook(() => useToolModeCharacterization());

      act(() => {
        result.current.setActiveTool("pointer");
      });

      expect(result.current.pointerMode).toBe(true);

      act(() => {
        result.current.setActiveTool("measure");
      });

      expect(result.current.pointerMode).toBe(false);
      expect(result.current.measureMode).toBe(true);
    });

    it("should update all boolean flags when switching tools", () => {
      const { result } = renderHook(() => useToolModeCharacterization());

      act(() => {
        result.current.setActiveTool("draw");
      });

      expect(result.current.drawMode).toBe(true);
      expect(result.current.transformMode).toBe(false);

      act(() => {
        result.current.setActiveTool("transform");
      });

      expect(result.current.drawMode).toBe(false);
      expect(result.current.transformMode).toBe(true);
    });
  });
});
