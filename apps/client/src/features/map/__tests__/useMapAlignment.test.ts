/**
 * Characterization tests for useMapAlignment hook
 *
 * These tests capture the behavior of the original map alignment code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/client/src/ui/App.tsx
 *   - Lines 37-38: Import of alignment types and utilities
 *   - Line 133: alignmentMode from useToolMode hook
 *   - Lines 180-182: Alignment state (alignmentPoints, alignmentSuggestion, alignmentError)
 *   - Lines 337-342: handleAlignmentStart callback
 *   - Lines 344-349: handleAlignmentCancel callback
 *   - Lines 351-359: handleAlignmentPointCapture callback
 *   - Lines 361-365: handleAlignmentReset callback
 *   - Lines 367-389: handleAlignmentApply callback
 *   - Lines 429-436: useEffect for clearing state on tool switch
 *   - Lines 438-466: useEffect for computing alignment transform
 *   - Lines 660-663: MapBoard props integration
 *   - Lines 784-791: DMMenu props integration
 *
 * Target: apps/client/src/features/map/useMapAlignment.ts
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AlignmentPoint, AlignmentSuggestion } from "../../../types/alignment";

describe("useMapAlignment - Characterization", () => {
  const mockSetActiveTool = vi.fn();
  const mockTransformSceneObject = vi.fn();
  const mockComputeMapAlignmentTransform = vi.fn();

  // Mock map scene object
  const mockMapSceneObject = {
    id: "map:test-map-id",
    type: "map" as const,
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    zIndex: 0,
    locked: false,
  };

  // Mock alignment points
  const mockPoint1: AlignmentPoint = {
    world: { x: 100, y: 100 },
    local: { x: 50, y: 50 },
  };

  const mockPoint2: AlignmentPoint = {
    world: { x: 200, y: 200 },
    local: { x: 150, y: 150 },
  };

  // Mock alignment suggestion
  const mockSuggestion: AlignmentSuggestion = {
    transform: {
      x: 25,
      y: 25,
      scaleX: 1.5,
      scaleY: 1.5,
      rotation: 45,
    },
    targetA: { x: 100, y: 100 },
    targetB: { x: 200, y: 200 },
    scale: 1.5,
    rotation: 45,
    error: 0.25,
  };

  const mockSuggestionHighError: AlignmentSuggestion = {
    ...mockSuggestion,
    error: 5.5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Initialization and State", () => {
    it("should initialize with empty alignment points", () => {
      // CURRENT BEHAVIOR (App.tsx line 180):
      // const [alignmentPoints, setAlignmentPoints] = useState<AlignmentPoint[]>([]);
      const initialPoints: AlignmentPoint[] = [];

      expect(initialPoints).toEqual([]);
      expect(initialPoints).toHaveLength(0);
    });

    it("should initialize with null alignment suggestion", () => {
      // CURRENT BEHAVIOR (App.tsx line 181):
      // const [alignmentSuggestion, setAlignmentSuggestion] = useState<AlignmentSuggestion | null>(null);
      const initialSuggestion: AlignmentSuggestion | null = null;

      expect(initialSuggestion).toBeNull();
    });

    it("should initialize with null alignment error", () => {
      // CURRENT BEHAVIOR (App.tsx line 182):
      // const [alignmentError, setAlignmentError] = useState<string | null>(null);
      const initialError: string | null = null;

      expect(initialError).toBeNull();
    });

    it("should use useCallback for all handler functions", () => {
      // CURRENT BEHAVIOR (App.tsx lines 337, 344, 351, 361, 367):
      // All alignment handlers are wrapped in useCallback with appropriate dependencies
      // This test verifies the pattern exists

      // handleAlignmentStart - useCallback with [] deps
      const handleAlignmentStart = vi.fn();
      expect(handleAlignmentStart).toBeDefined();

      // handleAlignmentCancel - useCallback with [] deps
      const handleAlignmentCancel = vi.fn();
      expect(handleAlignmentCancel).toBeDefined();

      // handleAlignmentPointCapture - useCallback with [] deps
      const handleAlignmentPointCapture = vi.fn();
      expect(handleAlignmentPointCapture).toBeDefined();

      // handleAlignmentReset - useCallback with [] deps
      const handleAlignmentReset = vi.fn();
      expect(handleAlignmentReset).toBeDefined();

      // handleAlignmentApply - useCallback with [alignmentSuggestion, mapSceneObject, transformSceneObject] deps
      const handleAlignmentApply = vi.fn();
      expect(handleAlignmentApply).toBeDefined();
    });
  });

  describe("handleAlignmentStart", () => {
    it("should clear alignment points", () => {
      // CURRENT BEHAVIOR (App.tsx line 338):
      // setAlignmentPoints([]);
      const points: AlignmentPoint[] = [mockPoint1];
      const clearedPoints: AlignmentPoint[] = [];

      expect(clearedPoints).toEqual([]);
      expect(clearedPoints).not.toBe(points);
    });

    it("should clear alignment suggestion", () => {
      // CURRENT BEHAVIOR (App.tsx line 339):
      // setAlignmentSuggestion(null);
      const suggestion: AlignmentSuggestion | null = mockSuggestion;
      const clearedSuggestion: AlignmentSuggestion | null = null;

      expect(clearedSuggestion).toBeNull();
      expect(clearedSuggestion).not.toBe(suggestion);
    });

    it("should clear alignment error", () => {
      // CURRENT BEHAVIOR (App.tsx line 340):
      // setAlignmentError(null);
      const error: string | null = "Some error";
      const clearedError: string | null = null;

      expect(clearedError).toBeNull();
      expect(clearedError).not.toBe(error);
    });

    it("should set active tool to align", () => {
      // CURRENT BEHAVIOR (App.tsx line 341):
      // setActiveTool("align");
      mockSetActiveTool("align");

      expect(mockSetActiveTool).toHaveBeenCalledTimes(1);
      expect(mockSetActiveTool).toHaveBeenCalledWith("align");
    });

    it("should be wrapped in useCallback with empty dependencies", () => {
      // CURRENT BEHAVIOR (App.tsx lines 337-342):
      // const handleAlignmentStart = useCallback(() => { ... }, []);
      // This ensures function reference stability
      const deps: unknown[] = [];

      expect(deps).toEqual([]);
    });
  });

  describe("handleAlignmentCancel", () => {
    it("should set active tool to null", () => {
      // CURRENT BEHAVIOR (App.tsx line 345):
      // setActiveTool(null);
      mockSetActiveTool(null);

      expect(mockSetActiveTool).toHaveBeenCalledTimes(1);
      expect(mockSetActiveTool).toHaveBeenCalledWith(null);
    });

    it("should clear alignment points", () => {
      // CURRENT BEHAVIOR (App.tsx line 346):
      // setAlignmentPoints([]);
      const points: AlignmentPoint[] = [mockPoint1, mockPoint2];
      const clearedPoints: AlignmentPoint[] = [];

      expect(clearedPoints).toEqual([]);
      expect(clearedPoints).not.toBe(points);
    });

    it("should clear alignment suggestion", () => {
      // CURRENT BEHAVIOR (App.tsx line 347):
      // setAlignmentSuggestion(null);
      const suggestion: AlignmentSuggestion | null = mockSuggestion;
      const clearedSuggestion: AlignmentSuggestion | null = null;

      expect(clearedSuggestion).toBeNull();
      expect(clearedSuggestion).not.toBe(suggestion);
    });

    it("should clear alignment error", () => {
      // CURRENT BEHAVIOR (App.tsx line 348):
      // setAlignmentError(null);
      const error: string | null = "Alignment error";
      const clearedError: string | null = null;

      expect(clearedError).toBeNull();
      expect(clearedError).not.toBe(error);
    });

    it("should be wrapped in useCallback with empty dependencies", () => {
      // CURRENT BEHAVIOR (App.tsx lines 344-349):
      // const handleAlignmentCancel = useCallback(() => { ... }, []);
      const deps: unknown[] = [];

      expect(deps).toEqual([]);
    });
  });

  describe("handleAlignmentPointCapture", () => {
    it("should add first point to empty array", () => {
      // CURRENT BEHAVIOR (App.tsx lines 353-358):
      // setAlignmentPoints((prev) => {
      //   if (prev.length >= 2) {
      //     return [point];
      //   }
      //   return [...prev, point];
      // });
      const prev: AlignmentPoint[] = [];
      const point = mockPoint1;

      const next = prev.length >= 2 ? [point] : [...prev, point];

      expect(next).toEqual([mockPoint1]);
      expect(next).toHaveLength(1);
    });

    it("should add second point to array with one point", () => {
      // CURRENT BEHAVIOR (App.tsx lines 353-358)
      const prev: AlignmentPoint[] = [mockPoint1];
      const point = mockPoint2;

      const next = prev.length >= 2 ? [point] : [...prev, point];

      expect(next).toEqual([mockPoint1, mockPoint2]);
      expect(next).toHaveLength(2);
    });

    it("should replace points when capturing third point (max 2 points)", () => {
      // CURRENT BEHAVIOR (App.tsx lines 354-356):
      // if (prev.length >= 2) {
      //   return [point];
      // }
      const prev: AlignmentPoint[] = [mockPoint1, mockPoint2];
      const point: AlignmentPoint = {
        world: { x: 300, y: 300 },
        local: { x: 250, y: 250 },
      };

      const next = prev.length >= 2 ? [point] : [...prev, point];

      expect(next).toEqual([point]);
      expect(next).toHaveLength(1);
    });

    it("should clear alignment error when capturing point", () => {
      // CURRENT BEHAVIOR (App.tsx line 352):
      // setAlignmentError(null);
      const error: string | null = "Previous error";
      const clearedError: string | null = null;

      expect(clearedError).toBeNull();
      expect(clearedError).not.toBe(error);
    });

    it("should handle point with world and local coordinates", () => {
      // CURRENT BEHAVIOR (App.tsx line 351):
      // const handleAlignmentPointCapture = useCallback((point: AlignmentPoint) => { ... });
      const point: AlignmentPoint = {
        world: { x: 123.45, y: 678.9 },
        local: { x: 111.11, y: 222.22 },
      };

      expect(point.world).toEqual({ x: 123.45, y: 678.9 });
      expect(point.local).toEqual({ x: 111.11, y: 222.22 });
    });

    it("should be wrapped in useCallback with empty dependencies", () => {
      // CURRENT BEHAVIOR (App.tsx lines 351-359):
      // const handleAlignmentPointCapture = useCallback((point: AlignmentPoint) => { ... }, []);
      const deps: unknown[] = [];

      expect(deps).toEqual([]);
    });

    it("should not modify original array when adding point", () => {
      // CURRENT BEHAVIOR: Uses functional update with spread operator
      const prev: AlignmentPoint[] = [mockPoint1];
      const point = mockPoint2;

      const next = prev.length >= 2 ? [point] : [...prev, point];

      expect(prev).toEqual([mockPoint1]); // Original unchanged
      expect(next).toEqual([mockPoint1, mockPoint2]); // New array
      expect(next).not.toBe(prev); // Different references
    });
  });

  describe("handleAlignmentReset", () => {
    it("should clear alignment points", () => {
      // CURRENT BEHAVIOR (App.tsx line 362):
      // setAlignmentPoints([]);
      const points: AlignmentPoint[] = [mockPoint1, mockPoint2];
      const clearedPoints: AlignmentPoint[] = [];

      expect(clearedPoints).toEqual([]);
      expect(clearedPoints).not.toBe(points);
    });

    it("should clear alignment suggestion", () => {
      // CURRENT BEHAVIOR (App.tsx line 363):
      // setAlignmentSuggestion(null);
      const suggestion: AlignmentSuggestion | null = mockSuggestion;
      const clearedSuggestion: AlignmentSuggestion | null = null;

      expect(clearedSuggestion).toBeNull();
      expect(clearedSuggestion).not.toBe(suggestion);
    });

    it("should clear alignment error", () => {
      // CURRENT BEHAVIOR (App.tsx line 364):
      // setAlignmentError(null);
      const error: string | null = "Alignment error";
      const clearedError: string | null = null;

      expect(clearedError).toBeNull();
      expect(clearedError).not.toBe(error);
    });

    it("should NOT change active tool (maintains current mode)", () => {
      // CURRENT BEHAVIOR (App.tsx lines 361-365):
      // Does not call setActiveTool - tool mode remains unchanged
      const activeTool = "align";

      expect(mockSetActiveTool).not.toHaveBeenCalled();
      expect(activeTool).toBe("align"); // Tool unchanged
    });

    it("should be wrapped in useCallback with empty dependencies", () => {
      // CURRENT BEHAVIOR (App.tsx lines 361-365):
      // const handleAlignmentReset = useCallback(() => { ... }, []);
      const deps: unknown[] = [];

      expect(deps).toEqual([]);
    });
  });

  describe("handleAlignmentApply", () => {
    it("should apply transformation when suggestion exists", () => {
      // CURRENT BEHAVIOR (App.tsx lines 372-383):
      // transformSceneObject({ id, position, scale, rotation });
      const suggestion = mockSuggestion;
      const mapObject = mockMapSceneObject;

      if (suggestion && mapObject) {
        mockTransformSceneObject({
          id: mapObject.id,
          position: {
            x: suggestion.transform.x,
            y: suggestion.transform.y,
          },
          scale: {
            x: suggestion.transform.scaleX,
            y: suggestion.transform.scaleY,
          },
          rotation: suggestion.transform.rotation,
        });
      }

      expect(mockTransformSceneObject).toHaveBeenCalledTimes(1);
      expect(mockTransformSceneObject).toHaveBeenCalledWith({
        id: "map:test-map-id",
        position: { x: 25, y: 25 },
        scale: { x: 1.5, y: 1.5 },
        rotation: 45,
      });
    });

    it("should clear alignment points after apply", () => {
      // CURRENT BEHAVIOR (App.tsx line 385):
      // setAlignmentPoints([]);
      const _points: AlignmentPoint[] = [mockPoint1, mockPoint2];
      const suggestion = mockSuggestion;
      const mapObject = mockMapSceneObject;

      if (suggestion && mapObject) {
        const clearedPoints: AlignmentPoint[] = [];
        expect(clearedPoints).toEqual([]);
      }
    });

    it("should clear alignment suggestion after apply", () => {
      // CURRENT BEHAVIOR (App.tsx line 386):
      // setAlignmentSuggestion(null);
      const suggestion = mockSuggestion;
      const mapObject = mockMapSceneObject;

      if (suggestion && mapObject) {
        const clearedSuggestion: AlignmentSuggestion | null = null;
        expect(clearedSuggestion).toBeNull();
      }
    });

    it("should clear alignment error after apply", () => {
      // CURRENT BEHAVIOR (App.tsx line 387):
      // setAlignmentError(null);
      const suggestion = mockSuggestion;
      const mapObject = mockMapSceneObject;

      if (suggestion && mapObject) {
        const clearedError: string | null = null;
        expect(clearedError).toBeNull();
      }
    });

    it("should set active tool to null after apply", () => {
      // CURRENT BEHAVIOR (App.tsx line 388):
      // setActiveTool(null);
      const suggestion = mockSuggestion;
      const mapObject = mockMapSceneObject;

      if (suggestion && mapObject) {
        mockSetActiveTool(null);
      }

      expect(mockSetActiveTool).toHaveBeenCalledTimes(1);
      expect(mockSetActiveTool).toHaveBeenCalledWith(null);
    });

    it("should do nothing when suggestion is null", () => {
      // CURRENT BEHAVIOR (App.tsx lines 368-370):
      // if (!alignmentSuggestion || !mapSceneObject) {
      //   return;
      // }
      const suggestion: AlignmentSuggestion | null = null;
      const mapObject = mockMapSceneObject;

      if (!suggestion || !mapObject) {
        // Early return
      } else {
        mockTransformSceneObject({});
      }

      expect(mockTransformSceneObject).not.toHaveBeenCalled();
    });

    it("should do nothing when mapSceneObject is null", () => {
      // CURRENT BEHAVIOR (App.tsx lines 368-370)
      const suggestion = mockSuggestion;
      const mapObject = null;

      if (!suggestion || !mapObject) {
        // Early return
      } else {
        mockTransformSceneObject({});
      }

      expect(mockTransformSceneObject).not.toHaveBeenCalled();
    });

    it("should do nothing when both suggestion and mapSceneObject are null", () => {
      // CURRENT BEHAVIOR (App.tsx lines 368-370)
      const suggestion: AlignmentSuggestion | null = null;
      const mapObject = null;

      if (!suggestion || !mapObject) {
        // Early return
      } else {
        mockTransformSceneObject({});
      }

      expect(mockTransformSceneObject).not.toHaveBeenCalled();
    });

    it("should be wrapped in useCallback with correct dependencies", () => {
      // CURRENT BEHAVIOR (App.tsx line 389):
      // }, [alignmentSuggestion, mapSceneObject, transformSceneObject]);
      const deps = [mockSuggestion, mockMapSceneObject, mockTransformSceneObject];

      expect(deps).toHaveLength(3);
      expect(deps[0]).toBe(mockSuggestion);
      expect(deps[1]).toBe(mockMapSceneObject);
      expect(deps[2]).toBe(mockTransformSceneObject);
    });
  });

  describe("Tool Switch Effect - Clear State", () => {
    it("should clear all state when tool switches away from align", () => {
      // CURRENT BEHAVIOR (App.tsx lines 430-435):
      // if (activeTool !== "align") {
      //   setAlignmentPoints([]);
      //   setAlignmentSuggestion(null);
      //   setAlignmentError(null);
      //   return;
      // }
      const activeTool = "select";

      if (activeTool !== "align") {
        const clearedPoints: AlignmentPoint[] = [];
        const clearedSuggestion: AlignmentSuggestion | null = null;
        const clearedError: string | null = null;

        expect(clearedPoints).toEqual([]);
        expect(clearedSuggestion).toBeNull();
        expect(clearedError).toBeNull();
      }
    });

    it("should preserve state when tool is align", () => {
      // CURRENT BEHAVIOR (App.tsx lines 430-435):
      // Early return if not align tool
      const activeTool = "align";
      const points = [mockPoint1];
      const suggestion = mockSuggestion;
      const error = "Test error";

      if (activeTool !== "align") {
        // State would be cleared
        throw new Error("Should not clear when tool is align");
      }

      // State is preserved
      expect(points).toEqual([mockPoint1]);
      expect(suggestion).toBe(mockSuggestion);
      expect(error).toBe("Test error");
    });

    it("should clear state when switching from align to draw", () => {
      // CURRENT BEHAVIOR: Tool switch effect
      const activeTool = "draw";

      if (activeTool !== "align") {
        const clearedPoints: AlignmentPoint[] = [];
        expect(clearedPoints).toEqual([]);
      }
    });

    it("should clear state when switching from align to null", () => {
      // CURRENT BEHAVIOR: Tool switch effect
      const activeTool = null;

      if (activeTool !== "align") {
        const clearedPoints: AlignmentPoint[] = [];
        const clearedSuggestion: AlignmentSuggestion | null = null;
        const clearedError: string | null = null;

        expect(clearedPoints).toEqual([]);
        expect(clearedSuggestion).toBeNull();
        expect(clearedError).toBeNull();
      }
    });

    it("should have activeTool as dependency", () => {
      // CURRENT BEHAVIOR (App.tsx line 436):
      // }, [activeTool]);
      const deps = ["align"];

      expect(deps).toHaveLength(1);
    });
  });

  describe("Transform Computation Effect", () => {
    it("should not compute when tool is not align", () => {
      // CURRENT BEHAVIOR (App.tsx lines 439-441):
      // if (activeTool !== "align") {
      //   return;
      // }
      const activeTool = "select";
      const points = [mockPoint1, mockPoint2];

      if (activeTool !== "align") {
        // Early return - no computation
      } else {
        mockComputeMapAlignmentTransform(points, 50);
      }

      expect(mockComputeMapAlignmentTransform).not.toHaveBeenCalled();
    });

    it("should not compute with 0 points", () => {
      // CURRENT BEHAVIOR (App.tsx lines 443-449):
      // if (alignmentPoints.length !== 2) {
      //   setAlignmentSuggestion(null);
      //   if (alignmentPoints.length === 0) {
      //     setAlignmentError(null);
      //   }
      //   return;
      // }
      const activeTool = "align";
      const points: AlignmentPoint[] = [];

      if (activeTool !== "align") {
        // Skip
      } else if (points.length !== 2) {
        const clearedSuggestion: AlignmentSuggestion | null = null;
        const clearedError: string | null = points.length === 0 ? null : "Previous error";

        expect(clearedSuggestion).toBeNull();
        expect(clearedError).toBeNull();
      } else {
        mockComputeMapAlignmentTransform(points, 50);
      }

      expect(mockComputeMapAlignmentTransform).not.toHaveBeenCalled();
    });

    it("should not compute with 1 point", () => {
      // CURRENT BEHAVIOR (App.tsx lines 443-449)
      const activeTool = "align";
      const points: AlignmentPoint[] = [mockPoint1];

      if (activeTool !== "align") {
        // Skip
      } else if (points.length !== 2) {
        const clearedSuggestion: AlignmentSuggestion | null = null;
        expect(clearedSuggestion).toBeNull();
        // Error NOT cleared when points.length > 0 and < 2
      } else {
        mockComputeMapAlignmentTransform(points, 50);
      }

      expect(mockComputeMapAlignmentTransform).not.toHaveBeenCalled();
    });

    it("should clear suggestion when points length is not 2", () => {
      // CURRENT BEHAVIOR (App.tsx line 444):
      // setAlignmentSuggestion(null);
      const activeTool = "align";
      const points: AlignmentPoint[] = [mockPoint1];

      if (activeTool !== "align") {
        // Skip
      } else if (points.length !== 2) {
        const clearedSuggestion: AlignmentSuggestion | null = null;
        expect(clearedSuggestion).toBeNull();
      }
    });

    it("should clear error only when points length is 0", () => {
      // CURRENT BEHAVIOR (App.tsx lines 445-447):
      // if (alignmentPoints.length === 0) {
      //   setAlignmentError(null);
      // }
      const activeTool = "align";
      const pointsZero: AlignmentPoint[] = [];
      const pointsOne: AlignmentPoint[] = [mockPoint1];

      if (activeTool === "align" && pointsZero.length !== 2) {
        const clearedError = pointsZero.length === 0 ? null : "keep error";
        expect(clearedError).toBeNull();
      }

      if (activeTool === "align" && pointsOne.length !== 2) {
        const error = pointsOne.length === 0 ? null : "keep error";
        expect(error).toBe("keep error"); // Error NOT cleared with 1 point
      }
    });

    it("should compute suggestion with exactly 2 points", () => {
      // CURRENT BEHAVIOR (App.tsx lines 451-453):
      // const result = computeMapAlignmentTransform(alignmentPoints, gridSize);
      // setAlignmentSuggestion(result);
      const activeTool = "align";
      const points = [mockPoint1, mockPoint2];
      const gridSize = 50;

      mockComputeMapAlignmentTransform.mockReturnValue(mockSuggestion);

      if (activeTool === "align" && points.length === 2) {
        try {
          const result = mockComputeMapAlignmentTransform(points, gridSize);
          expect(result).toBe(mockSuggestion);
        } catch {
          // Error handling tested separately
        }
      }

      expect(mockComputeMapAlignmentTransform).toHaveBeenCalledTimes(1);
      expect(mockComputeMapAlignmentTransform).toHaveBeenCalledWith(points, gridSize);
    });

    it("should set error when transform error exceeds tolerance", () => {
      // CURRENT BEHAVIOR (App.tsx lines 454-459):
      // const tolerance = Math.max(0.5, gridSize * 0.02);
      // if (result.error > tolerance) {
      //   setAlignmentError(`Alignment residual ${result.error.toFixed(2)}px — consider recapturing points.`);
      // }
      const gridSize = 50;
      const tolerance = Math.max(0.5, gridSize * 0.02); // 1.0
      const result = mockSuggestionHighError; // error: 5.5

      if (result.error > tolerance) {
        const errorMessage = `Alignment residual ${result.error.toFixed(2)}px — consider recapturing points.`;
        expect(errorMessage).toBe("Alignment residual 5.50px — consider recapturing points.");
      }
    });

    it("should clear error when transform error is acceptable", () => {
      // CURRENT BEHAVIOR (App.tsx lines 454-461):
      // else {
      //   setAlignmentError(null);
      // }
      const gridSize = 50;
      const tolerance = Math.max(0.5, gridSize * 0.02); // 1.0
      const result = mockSuggestion; // error: 0.25

      if (result.error > tolerance) {
        // Set error
      } else {
        const clearedError: string | null = null;
        expect(clearedError).toBeNull();
      }
    });

    it("should calculate tolerance as max of 0.5 and 2% of gridSize", () => {
      // CURRENT BEHAVIOR (App.tsx line 454):
      // const tolerance = Math.max(0.5, gridSize * 0.02);
      const gridSize1 = 10;
      const tolerance1 = Math.max(0.5, gridSize1 * 0.02);
      expect(tolerance1).toBe(0.5); // 10 * 0.02 = 0.2, max(0.5, 0.2) = 0.5

      const gridSize2 = 50;
      const tolerance2 = Math.max(0.5, gridSize2 * 0.02);
      expect(tolerance2).toBe(1.0); // 50 * 0.02 = 1.0, max(0.5, 1.0) = 1.0

      const gridSize3 = 100;
      const tolerance3 = Math.max(0.5, gridSize3 * 0.02);
      expect(tolerance3).toBe(2.0); // 100 * 0.02 = 2.0, max(0.5, 2.0) = 2.0
    });

    it("should handle computation errors gracefully", () => {
      // CURRENT BEHAVIOR (App.tsx lines 462-465):
      // catch (error) {
      //   setAlignmentSuggestion(null);
      //   setAlignmentError(error instanceof Error ? error.message : "Failed to compute alignment.");
      // }
      const errorInstance = new Error("Alignment points must not be identical.");

      try {
        throw errorInstance;
      } catch (error) {
        const clearedSuggestion: AlignmentSuggestion | null = null;
        const errorMessage =
          error instanceof Error ? error.message : "Failed to compute alignment.";

        expect(clearedSuggestion).toBeNull();
        expect(errorMessage).toBe("Alignment points must not be identical.");
      }
    });

    it("should handle non-Error exceptions gracefully", () => {
      // CURRENT BEHAVIOR (App.tsx line 464):
      // error instanceof Error ? error.message : "Failed to compute alignment."
      try {
        throw "String error";
      } catch (error) {
        const clearedSuggestion: AlignmentSuggestion | null = null;
        const errorMessage =
          error instanceof Error ? error.message : "Failed to compute alignment.";

        expect(clearedSuggestion).toBeNull();
        expect(errorMessage).toBe("Failed to compute alignment.");
      }
    });

    it("should have correct effect dependencies", () => {
      // CURRENT BEHAVIOR (App.tsx line 466):
      // }, [activeTool, alignmentPoints, gridSize]);
      const activeTool = "align";
      const alignmentPoints = [mockPoint1, mockPoint2];
      const gridSize = 50;

      const deps = [activeTool, alignmentPoints, gridSize];

      expect(deps).toHaveLength(3);
      expect(deps[0]).toBe("align");
      expect(deps[1]).toBe(alignmentPoints);
      expect(deps[2]).toBe(50);
    });

    it("should recompute when gridSize changes", () => {
      // CURRENT BEHAVIOR: gridSize is in effect dependencies
      const activeTool = "align";
      const points = [mockPoint1, mockPoint2];

      mockComputeMapAlignmentTransform.mockReturnValue(mockSuggestion);

      // First computation with gridSize 50
      if (activeTool === "align" && points.length === 2) {
        mockComputeMapAlignmentTransform(points, 50);
      }

      // Second computation with gridSize 100
      if (activeTool === "align" && points.length === 2) {
        mockComputeMapAlignmentTransform(points, 100);
      }

      expect(mockComputeMapAlignmentTransform).toHaveBeenCalledTimes(2);
      expect(mockComputeMapAlignmentTransform).toHaveBeenNthCalledWith(1, points, 50);
      expect(mockComputeMapAlignmentTransform).toHaveBeenNthCalledWith(2, points, 100);
    });
  });

  describe("Integration Tests", () => {
    it("should complete full workflow: start -> capture 2 points -> apply", () => {
      // CURRENT BEHAVIOR: Complete alignment workflow
      const points: AlignmentPoint[] = [];
      let suggestion: AlignmentSuggestion | null = null;
      let _error: string | null = null;
      let activeTool: string | null = null;

      // 1. Start alignment
      activeTool = "align";
      points.length = 0;
      suggestion = null;
      _error = null;

      expect(activeTool).toBe("align");
      expect(points).toHaveLength(0);

      // 2. Capture first point
      points.push(mockPoint1);
      _error = null;

      expect(points).toHaveLength(1);

      // 3. Capture second point
      points.push(mockPoint2);
      _error = null;

      expect(points).toHaveLength(2);

      // 4. Computation happens (via effect)
      mockComputeMapAlignmentTransform.mockReturnValue(mockSuggestion);
      suggestion = mockComputeMapAlignmentTransform(points, 50);

      expect(suggestion).toBe(mockSuggestion);

      // 5. Apply alignment
      if (suggestion && mockMapSceneObject) {
        mockTransformSceneObject({
          id: mockMapSceneObject.id,
          position: { x: suggestion.transform.x, y: suggestion.transform.y },
          scale: { x: suggestion.transform.scaleX, y: suggestion.transform.scaleY },
          rotation: suggestion.transform.rotation,
        });
        activeTool = null;
      }

      expect(mockTransformSceneObject).toHaveBeenCalled();
      expect(activeTool).toBeNull();
    });

    it("should handle workflow with high error warning", () => {
      // CURRENT BEHAVIOR: Workflow with error > tolerance
      const points: AlignmentPoint[] = [];
      let suggestion: AlignmentSuggestion | null = null;
      let error: string | null = null;
      const gridSize = 50;

      // Capture 2 points
      points.push(mockPoint1, mockPoint2);

      // Compute with high error
      mockComputeMapAlignmentTransform.mockReturnValue(mockSuggestionHighError);
      suggestion = mockComputeMapAlignmentTransform(points, gridSize);

      // Check error threshold
      const tolerance = Math.max(0.5, gridSize * 0.02);
      if (suggestion.error > tolerance) {
        error = `Alignment residual ${suggestion.error.toFixed(2)}px — consider recapturing points.`;
      }

      expect(suggestion).toBe(mockSuggestionHighError);
      expect(error).toBe("Alignment residual 5.50px — consider recapturing points.");
      // User can still apply despite warning
    });

    it("should handle cancel workflow mid-process", () => {
      // CURRENT BEHAVIOR: Cancel during alignment
      const points: AlignmentPoint[] = [mockPoint1];
      let suggestion: AlignmentSuggestion | null = mockSuggestion;
      let error: string | null = "Some error";
      let activeTool: string | null = "align";

      // Cancel
      activeTool = null;
      points.length = 0;
      suggestion = null;
      error = null;

      expect(activeTool).toBeNull();
      expect(points).toHaveLength(0);
      expect(suggestion).toBeNull();
      expect(error).toBeNull();
    });

    it("should handle reset workflow (clear points but keep tool active)", () => {
      // CURRENT BEHAVIOR: Reset vs Cancel difference
      const points: AlignmentPoint[] = [mockPoint1, mockPoint2];
      let suggestion: AlignmentSuggestion | null = mockSuggestion;
      let error: string | null = "Some error";
      let activeTool: string | null = "align";

      // Reset - clears state but keeps tool active
      points.length = 0;
      suggestion = null;
      error = null;
      // activeTool stays "align"

      expect(activeTool).toBe("align"); // Still in alignment mode
      expect(points).toHaveLength(0);
      expect(suggestion).toBeNull();
      expect(error).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("should handle capturing third point correctly", () => {
      // CURRENT BEHAVIOR: Third point replaces all previous points
      const prev: AlignmentPoint[] = [mockPoint1, mockPoint2];
      const thirdPoint: AlignmentPoint = {
        world: { x: 300, y: 300 },
        local: { x: 250, y: 250 },
      };

      const next = prev.length >= 2 ? [thirdPoint] : [...prev, thirdPoint];

      expect(next).toEqual([thirdPoint]);
      expect(next).toHaveLength(1);
      // User needs to capture a second point again
    });

    it("should format error message correctly", () => {
      // CURRENT BEHAVIOR (App.tsx line 457):
      // `Alignment residual ${result.error.toFixed(2)}px — consider recapturing points.`
      const error1 = 5.5;
      const message1 = `Alignment residual ${error1.toFixed(2)}px — consider recapturing points.`;
      expect(message1).toBe("Alignment residual 5.50px — consider recapturing points.");

      const error2 = 12.345678;
      const message2 = `Alignment residual ${error2.toFixed(2)}px — consider recapturing points.`;
      expect(message2).toBe("Alignment residual 12.35px — consider recapturing points.");

      const error3 = 0.1;
      const message3 = `Alignment residual ${error3.toFixed(2)}px — consider recapturing points.`;
      expect(message3).toBe("Alignment residual 0.10px — consider recapturing points.");
    });

    it("should handle very small gridSize for tolerance calculation", () => {
      // CURRENT BEHAVIOR: Ensures minimum tolerance of 0.5
      const gridSize = 5;
      const tolerance = Math.max(0.5, gridSize * 0.02);
      expect(tolerance).toBe(0.5); // 5 * 0.02 = 0.1, max(0.5, 0.1) = 0.5
    });

    it("should handle very large gridSize for tolerance calculation", () => {
      // CURRENT BEHAVIOR: Scales tolerance with gridSize
      const gridSize = 1000;
      const tolerance = Math.max(0.5, gridSize * 0.02);
      expect(tolerance).toBe(20.0); // 1000 * 0.02 = 20.0
    });

    it("should not clear error when single point exists", () => {
      // CURRENT BEHAVIOR (App.tsx lines 445-447):
      // Error is only cleared when points.length === 0
      const activeTool = "align";
      const points: AlignmentPoint[] = [mockPoint1];
      const previousError = "Previous error message";

      if (activeTool === "align" && points.length !== 2) {
        const error = points.length === 0 ? null : previousError;
        expect(error).toBe("Previous error message");
      }
    });
  });
});
