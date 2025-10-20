/**
 * Characterization tests for useSceneObjectSelectors
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/client/src/ui/App.tsx (lines 620-668)
 * Target: apps/client/src/hooks/useSceneObjectSelectors.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSceneObjectSelectors } from "../useSceneObjectSelectors";

describe("useSceneObjectSelectors - Characterization", () => {
  let mockSelectObject: ReturnType<typeof vi.fn>;
  let mockSelectMultiple: ReturnType<typeof vi.fn>;
  let mockClearSelection: ReturnType<typeof vi.fn>;
  let mockSelectedObjectIds: string[];

  beforeEach(() => {
    mockSelectObject = vi.fn();
    mockSelectMultiple = vi.fn();
    mockClearSelection = vi.fn();
    mockSelectedObjectIds = [];
  });

  describe("handleObjectSelection - happy paths", () => {
    it("should clear selection when objectId is null", () => {
      const { result } = renderHook(() =>
        useSceneObjectSelectors({
          selectedObjectIds: mockSelectedObjectIds,
          selectObject: mockSelectObject,
          selectMultiple: mockSelectMultiple,
          clearSelection: mockClearSelection,
        }),
      );

      result.current.handleObjectSelection(null);

      expect(mockClearSelection).toHaveBeenCalledOnce();
      expect(mockSelectObject).not.toHaveBeenCalled();
      expect(mockSelectMultiple).not.toHaveBeenCalled();
    });

    it("should select object in replace mode by default", () => {
      const { result } = renderHook(() =>
        useSceneObjectSelectors({
          selectedObjectIds: mockSelectedObjectIds,
          selectObject: mockSelectObject,
          selectMultiple: mockSelectMultiple,
          clearSelection: mockClearSelection,
        }),
      );

      result.current.handleObjectSelection("obj1");

      expect(mockSelectObject).toHaveBeenCalledWith("obj1");
      expect(mockSelectMultiple).not.toHaveBeenCalled();
      expect(mockClearSelection).not.toHaveBeenCalled();
    });

    it("should select object in explicit replace mode", () => {
      const { result } = renderHook(() =>
        useSceneObjectSelectors({
          selectedObjectIds: mockSelectedObjectIds,
          selectObject: mockSelectObject,
          selectMultiple: mockSelectMultiple,
          clearSelection: mockClearSelection,
        }),
      );

      result.current.handleObjectSelection("obj1", { mode: "replace" });

      expect(mockSelectObject).toHaveBeenCalledWith("obj1");
      expect(mockSelectMultiple).not.toHaveBeenCalled();
      expect(mockClearSelection).not.toHaveBeenCalled();
    });

    it("should append object to selection in append mode", () => {
      const { result } = renderHook(() =>
        useSceneObjectSelectors({
          selectedObjectIds: ["obj1"],
          selectObject: mockSelectObject,
          selectMultiple: mockSelectMultiple,
          clearSelection: mockClearSelection,
        }),
      );

      result.current.handleObjectSelection("obj2", { mode: "append" });

      expect(mockSelectMultiple).toHaveBeenCalledWith(["obj2"], "append");
      expect(mockSelectObject).not.toHaveBeenCalled();
      expect(mockClearSelection).not.toHaveBeenCalled();
    });

    it("should subtract object from selection in subtract mode", () => {
      const { result } = renderHook(() =>
        useSceneObjectSelectors({
          selectedObjectIds: ["obj1", "obj2"],
          selectObject: mockSelectObject,
          selectMultiple: mockSelectMultiple,
          clearSelection: mockClearSelection,
        }),
      );

      result.current.handleObjectSelection("obj2", { mode: "subtract" });

      expect(mockSelectMultiple).toHaveBeenCalledWith(["obj2"], "subtract");
      expect(mockSelectObject).not.toHaveBeenCalled();
      expect(mockClearSelection).not.toHaveBeenCalled();
    });
  });

  describe("handleObjectSelection - toggle mode", () => {
    it("should subtract object if already selected", () => {
      const { result } = renderHook(() =>
        useSceneObjectSelectors({
          selectedObjectIds: ["obj1", "obj2"],
          selectObject: mockSelectObject,
          selectMultiple: mockSelectMultiple,
          clearSelection: mockClearSelection,
        }),
      );

      result.current.handleObjectSelection("obj2", { mode: "toggle" });

      expect(mockSelectMultiple).toHaveBeenCalledWith(["obj2"], "subtract");
      expect(mockSelectObject).not.toHaveBeenCalled();
      expect(mockClearSelection).not.toHaveBeenCalled();
    });

    it("should append object if not selected and selection exists", () => {
      const { result } = renderHook(() =>
        useSceneObjectSelectors({
          selectedObjectIds: ["obj1"],
          selectObject: mockSelectObject,
          selectMultiple: mockSelectMultiple,
          clearSelection: mockClearSelection,
        }),
      );

      result.current.handleObjectSelection("obj2", { mode: "toggle" });

      expect(mockSelectMultiple).toHaveBeenCalledWith(["obj2"], "append");
      expect(mockSelectObject).not.toHaveBeenCalled();
      expect(mockClearSelection).not.toHaveBeenCalled();
    });

    it("should use selectObject if not selected and no selection exists", () => {
      const { result } = renderHook(() =>
        useSceneObjectSelectors({
          selectedObjectIds: [],
          selectObject: mockSelectObject,
          selectMultiple: mockSelectMultiple,
          clearSelection: mockClearSelection,
        }),
      );

      result.current.handleObjectSelection("obj1", { mode: "toggle" });

      expect(mockSelectObject).toHaveBeenCalledWith("obj1");
      expect(mockSelectMultiple).not.toHaveBeenCalled();
      expect(mockClearSelection).not.toHaveBeenCalled();
    });
  });

  describe("handleObjectSelectionBatch - happy paths", () => {
    it("should clear selection when array is empty", () => {
      const { result } = renderHook(() =>
        useSceneObjectSelectors({
          selectedObjectIds: ["obj1"],
          selectObject: mockSelectObject,
          selectMultiple: mockSelectMultiple,
          clearSelection: mockClearSelection,
        }),
      );

      result.current.handleObjectSelectionBatch([]);

      expect(mockClearSelection).toHaveBeenCalledOnce();
      expect(mockSelectObject).not.toHaveBeenCalled();
      expect(mockSelectMultiple).not.toHaveBeenCalled();
    });

    it("should select multiple objects in replace mode", () => {
      const { result } = renderHook(() =>
        useSceneObjectSelectors({
          selectedObjectIds: mockSelectedObjectIds,
          selectObject: mockSelectObject,
          selectMultiple: mockSelectMultiple,
          clearSelection: mockClearSelection,
        }),
      );

      result.current.handleObjectSelectionBatch(["obj1", "obj2", "obj3"]);

      expect(mockSelectMultiple).toHaveBeenCalledWith(["obj1", "obj2", "obj3"], "replace");
      expect(mockSelectObject).not.toHaveBeenCalled();
      expect(mockClearSelection).not.toHaveBeenCalled();
    });

    it("should handle single object in batch", () => {
      const { result } = renderHook(() =>
        useSceneObjectSelectors({
          selectedObjectIds: mockSelectedObjectIds,
          selectObject: mockSelectObject,
          selectMultiple: mockSelectMultiple,
          clearSelection: mockClearSelection,
        }),
      );

      result.current.handleObjectSelectionBatch(["obj1"]);

      expect(mockSelectMultiple).toHaveBeenCalledWith(["obj1"], "replace");
      expect(mockSelectObject).not.toHaveBeenCalled();
      expect(mockClearSelection).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle objectId with null and undefined mode option", () => {
      const { result } = renderHook(() =>
        useSceneObjectSelectors({
          selectedObjectIds: mockSelectedObjectIds,
          selectObject: mockSelectObject,
          selectMultiple: mockSelectMultiple,
          clearSelection: mockClearSelection,
        }),
      );

      result.current.handleObjectSelection("obj1", { mode: undefined });

      expect(mockSelectObject).toHaveBeenCalledWith("obj1");
    });

    it("should handle objectId with empty options object", () => {
      const { result } = renderHook(() =>
        useSceneObjectSelectors({
          selectedObjectIds: mockSelectedObjectIds,
          selectObject: mockSelectObject,
          selectMultiple: mockSelectMultiple,
          clearSelection: mockClearSelection,
        }),
      );

      result.current.handleObjectSelection("obj1", {});

      expect(mockSelectObject).toHaveBeenCalledWith("obj1");
    });

    it("should handle toggle mode with empty selectedObjectIds array", () => {
      const { result } = renderHook(() =>
        useSceneObjectSelectors({
          selectedObjectIds: [],
          selectObject: mockSelectObject,
          selectMultiple: mockSelectMultiple,
          clearSelection: mockClearSelection,
        }),
      );

      result.current.handleObjectSelection("obj1", { mode: "toggle" });

      expect(mockSelectObject).toHaveBeenCalledWith("obj1");
      expect(mockSelectMultiple).not.toHaveBeenCalled();
    });
  });

  describe("stability", () => {
    it("should provide stable callback references across re-renders", () => {
      const { result, rerender } = renderHook(() =>
        useSceneObjectSelectors({
          selectedObjectIds: mockSelectedObjectIds,
          selectObject: mockSelectObject,
          selectMultiple: mockSelectMultiple,
          clearSelection: mockClearSelection,
        }),
      );

      const firstHandleObjectSelection = result.current.handleObjectSelection;
      const firstHandleObjectSelectionBatch = result.current.handleObjectSelectionBatch;

      rerender();

      expect(result.current.handleObjectSelection).toBe(firstHandleObjectSelection);
      expect(result.current.handleObjectSelectionBatch).toBe(firstHandleObjectSelectionBatch);
    });

    it("should update callbacks when dependencies change", () => {
      const { result, rerender } = renderHook(
        ({ selectedObjectIds }) =>
          useSceneObjectSelectors({
            selectedObjectIds,
            selectObject: mockSelectObject,
            selectMultiple: mockSelectMultiple,
            clearSelection: mockClearSelection,
          }),
        {
          initialProps: { selectedObjectIds: [] },
        },
      );

      const firstHandleObjectSelection = result.current.handleObjectSelection;

      rerender({ selectedObjectIds: ["obj1"] });

      // Callbacks should be new references when dependencies change
      expect(result.current.handleObjectSelection).not.toBe(firstHandleObjectSelection);
    });
  });
});
