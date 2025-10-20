/**
 * Characterization tests for useLayoutMeasurement
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/client/src/ui/App.tsx (lines 494-497, 565-578)
 * Target: apps/client/src/hooks/useLayoutMeasurement.ts
 */

import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { useEffect, useState } from "react";

/**
 * Current implementation extracted from App.tsx for testing
 * This is the EXACT code we're extracting (lines 494-497, 565-578)
 */
function useLayoutMeasurementCurrent(options: {
  topPanelRef: React.RefObject<HTMLDivElement>;
  bottomPanelRef: React.RefObject<HTMLDivElement>;
  dependencies?: unknown[];
}) {
  const { topPanelRef, bottomPanelRef, dependencies = [] } = options;
  const [topHeight, setTopHeight] = useState(180);
  const [bottomHeight, setBottomHeight] = useState(210);

  useEffect(() => {
    const measureHeights = () => {
      if (topPanelRef.current) {
        setTopHeight(topPanelRef.current.offsetHeight);
      }
      if (bottomPanelRef.current) {
        setBottomHeight(bottomPanelRef.current.offsetHeight);
      }
    };

    measureHeights();
    window.addEventListener("resize", measureHeights);
    return () => window.removeEventListener("resize", measureHeights);
  }, dependencies);

  return { topHeight, bottomHeight };
}

describe("useLayoutMeasurement - Characterization", () => {
  let topPanel: HTMLDivElement;
  let bottomPanel: HTMLDivElement;

  beforeEach(() => {
    // Create mock DOM elements
    topPanel = document.createElement("div");
    bottomPanel = document.createElement("div");

    // Mock offsetHeight
    Object.defineProperty(topPanel, "offsetHeight", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(bottomPanel, "offsetHeight", {
      configurable: true,
      value: 250,
    });
  });

  describe("happy paths", () => {
    it("should initialize with default heights", () => {
      const topPanelRef = { current: null };
      const bottomPanelRef = { current: null };

      const { result } = renderHook(() =>
        useLayoutMeasurementCurrent({ topPanelRef, bottomPanelRef }),
      );

      // Default values from state initialization (lines 496-497)
      expect(result.current.topHeight).toBe(180);
      expect(result.current.bottomHeight).toBe(210);
    });

    it("should measure panel heights when refs are set", () => {
      const topPanelRef = { current: topPanel };
      const bottomPanelRef = { current: bottomPanel };

      const { result } = renderHook(() =>
        useLayoutMeasurementCurrent({ topPanelRef, bottomPanelRef }),
      );

      // Heights should be measured from DOM elements
      expect(result.current.topHeight).toBe(200);
      expect(result.current.bottomHeight).toBe(250);
    });

    it("should update heights on window resize", () => {
      const topPanelRef = { current: topPanel };
      const bottomPanelRef = { current: bottomPanel };

      const { result } = renderHook(() =>
        useLayoutMeasurementCurrent({ topPanelRef, bottomPanelRef }),
      );

      // Initial measurement
      expect(result.current.topHeight).toBe(200);

      // Change offsetHeight and trigger resize
      Object.defineProperty(topPanel, "offsetHeight", {
        configurable: true,
        value: 300,
      });

      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      // Height should update
      expect(result.current.topHeight).toBe(300);
    });

    it("should re-measure when dependencies change", () => {
      const topPanelRef = { current: topPanel };
      const bottomPanelRef = { current: bottomPanel };
      const dependencies = [1];

      const { result, rerender } = renderHook(
        ({ deps }) =>
          useLayoutMeasurementCurrent({ topPanelRef, bottomPanelRef, dependencies: deps }),
        { initialProps: { deps: dependencies } },
      );

      // Initial measurement
      expect(result.current.topHeight).toBe(200);

      // Change offsetHeight
      Object.defineProperty(topPanel, "offsetHeight", {
        configurable: true,
        value: 350,
      });

      // Trigger dependency change (like snapshot.players changing)
      rerender({ deps: [2] });

      // Height should update due to dependency change
      expect(result.current.topHeight).toBe(350);
    });
  });

  describe("edge cases", () => {
    it("should handle null topPanelRef gracefully", () => {
      const topPanelRef = { current: null };
      const bottomPanelRef = { current: bottomPanel };

      const { result } = renderHook(() =>
        useLayoutMeasurementCurrent({ topPanelRef, bottomPanelRef }),
      );

      // Top stays at default, bottom is measured
      expect(result.current.topHeight).toBe(180);
      expect(result.current.bottomHeight).toBe(250);
    });

    it("should handle null bottomPanelRef gracefully", () => {
      const topPanelRef = { current: topPanel };
      const bottomPanelRef = { current: null };

      const { result } = renderHook(() =>
        useLayoutMeasurementCurrent({ topPanelRef, bottomPanelRef }),
      );

      // Top is measured, bottom stays at default
      expect(result.current.topHeight).toBe(200);
      expect(result.current.bottomHeight).toBe(210);
    });

    it("should handle both refs being null", () => {
      const topPanelRef = { current: null };
      const bottomPanelRef = { current: null };

      const { result } = renderHook(() =>
        useLayoutMeasurementCurrent({ topPanelRef, bottomPanelRef }),
      );

      // Both stay at defaults
      expect(result.current.topHeight).toBe(180);
      expect(result.current.bottomHeight).toBe(210);
    });

    it("should handle offsetHeight of 0", () => {
      Object.defineProperty(topPanel, "offsetHeight", {
        configurable: true,
        value: 0,
      });
      Object.defineProperty(bottomPanel, "offsetHeight", {
        configurable: true,
        value: 0,
      });

      const topPanelRef = { current: topPanel };
      const bottomPanelRef = { current: bottomPanel };

      const { result } = renderHook(() =>
        useLayoutMeasurementCurrent({ topPanelRef, bottomPanelRef }),
      );

      // Should measure 0 (collapsed panels)
      expect(result.current.topHeight).toBe(0);
      expect(result.current.bottomHeight).toBe(0);
    });
  });

  describe("cleanup", () => {
    it("should remove resize listener on unmount", () => {
      const topPanelRef = { current: topPanel };
      const bottomPanelRef = { current: null };

      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      const { unmount } = renderHook(() =>
        useLayoutMeasurementCurrent({ topPanelRef, bottomPanelRef }),
      );

      // Verify listener was added
      expect(addEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));

      unmount();

      // Verify listener was removed
      expect(removeEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });
});
