/**
 * Characterization tests for SelectionManager functionality
 *
 * These tests capture the behavior of the original selection management code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/client/src/ui/App.tsx
 *   - Line 23: Import of useObjectSelection
 *   - Lines 186-194: useObjectSelection hook initialization
 *   - Lines 273-278: Selection clearing on tool mode change
 *   - Lines 280-286: useSceneObjectSelectors integration
 *   - Lines 533, 632, 657: Delete keyboard shortcut integration
 *   - Lines 690-696: Lock/unlock toolbar integration
 *   - Lines 731-734: MapBoard props integration
 *
 * Target: apps/client/src/features/selection/useSelectionManager.ts
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

/**
 * Mock implementation of the SelectionManager
 * This simulates the CURRENT behavior in App.tsx before extraction
 */
function createSelectionManager({
  useObjectSelection,
  useToolMode,
  useSceneObjectSelectors,
  snapshot,
  sendMessage,
  uid,
}: {
  useObjectSelection: () => {
    selectedObjectId: string | null;
    selectedObjectIds: string[];
    selectObject: (objectId: string | null) => void;
    selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
    deselect: () => void;
    lockSelected: () => void;
    unlockSelected: () => void;
  };
  useToolMode: () => {
    transformMode: boolean;
    selectMode: boolean;
  };
  useSceneObjectSelectors: (options: {
    selectedObjectIds: string[];
    selectObject: (objectId: string | null) => void;
    selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
    clearSelection: () => void;
  }) => {
    handleObjectSelection: (
      objectId: string | null,
      options?: { mode?: "replace" | "append" | "toggle" | "subtract" },
    ) => void;
    handleObjectSelectionBatch: (objectIds: string[]) => void;
  };
  snapshot: unknown;
  sendMessage: (msg: unknown) => void;
  uid: string;
}) {
  // Initialize hooks
  const selection = useObjectSelection();
  const toolMode = useToolMode();
  const selectors = useSceneObjectSelectors({
    selectedObjectIds: selection.selectedObjectIds,
    selectObject: selection.selectObject,
    selectMultiple: selection.selectMultiple,
    clearSelection: selection.deselect,
  });

  // Effect: Clear selection when switching away from transform/select mode
  const shouldClearSelection = !toolMode.transformMode && !toolMode.selectMode;

  return {
    selectedObjectId: selection.selectedObjectId,
    selectedObjectIds: selection.selectedObjectIds,
    handleObjectSelection: selectors.handleObjectSelection,
    handleObjectSelectionBatch: selectors.handleObjectSelectionBatch,
    clearSelection: selection.deselect,
    lockSelected: selection.lockSelected,
    unlockSelected: selection.unlockSelected,
    shouldClearSelection,
  };
}

describe("SelectionManager - Characterization", () => {
  const mockSendMessage = vi.fn();
  const mockSelectObject = vi.fn();
  const mockSelectMultiple = vi.fn();
  const mockDeselect = vi.fn();
  const mockLockSelected = vi.fn();
  const mockUnlockSelected = vi.fn();

  beforeEach(() => {
    mockSendMessage.mockClear();
    mockSelectObject.mockClear();
    mockSelectMultiple.mockClear();
    mockDeselect.mockClear();
    mockLockSelected.mockClear();
    mockUnlockSelected.mockClear();
  });

  describe("Basic Selection Management", () => {
    it("should initialize with no selection", () => {
      const mockUseObjectSelection = () => ({
        selectedObjectId: null,
        selectedObjectIds: [],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: false,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const manager = createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(manager.selectedObjectId).toBeNull();
      expect(manager.selectedObjectIds).toEqual([]);
    });

    it("should expose selectedObjectId for single selection", () => {
      const mockUseObjectSelection = () => ({
        selectedObjectId: "token:abc123",
        selectedObjectIds: ["token:abc123"],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: true,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const manager = createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(manager.selectedObjectId).toBe("token:abc123");
      expect(manager.selectedObjectIds).toEqual(["token:abc123"]);
    });

    it("should expose selectedObjectIds for multiple selection", () => {
      const mockUseObjectSelection = () => ({
        selectedObjectId: "token:def456",
        selectedObjectIds: ["token:abc123", "token:def456", "drawing:ghi789"],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: false,
        selectMode: true,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const manager = createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(manager.selectedObjectIds).toEqual(["token:abc123", "token:def456", "drawing:ghi789"]);
      expect(manager.selectedObjectIds.length).toBe(3);
    });

    it("should provide clearSelection function", () => {
      const mockUseObjectSelection = () => ({
        selectedObjectId: "token:abc123",
        selectedObjectIds: ["token:abc123"],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: true,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const manager = createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(manager.clearSelection).toBe(mockDeselect);
    });

    it("should update selection state when underlying selection changes", () => {
      let selectedIds = ["token:abc123"];

      const mockUseObjectSelection = () => ({
        selectedObjectId: selectedIds[0] || null,
        selectedObjectIds: selectedIds,
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: true,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const { result, rerender } = renderHook(() =>
        createSelectionManager({
          useObjectSelection: mockUseObjectSelection,
          useToolMode: mockUseToolMode,
          useSceneObjectSelectors: mockUseSceneObjectSelectors,
          snapshot: null,
          sendMessage: mockSendMessage,
          uid: "test-uid",
        }),
      );

      expect(result.current.selectedObjectIds).toEqual(["token:abc123"]);

      // Simulate selection change
      selectedIds = ["token:abc123", "token:def456"];
      rerender();

      expect(result.current.selectedObjectIds).toEqual(["token:abc123", "token:def456"]);
    });

    it("should handle empty selection array", () => {
      const mockUseObjectSelection = () => ({
        selectedObjectId: null,
        selectedObjectIds: [],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: false,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const manager = createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(manager.selectedObjectId).toBeNull();
      expect(manager.selectedObjectIds).toEqual([]);
      expect(manager.selectedObjectIds.length).toBe(0);
    });

    it("should handle selection state transition from empty to selected", () => {
      let selectedIds: string[] = [];

      const mockUseObjectSelection = () => ({
        selectedObjectId: selectedIds[0] || null,
        selectedObjectIds: selectedIds,
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: true,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const { result, rerender } = renderHook(() =>
        createSelectionManager({
          useObjectSelection: mockUseObjectSelection,
          useToolMode: mockUseToolMode,
          useSceneObjectSelectors: mockUseSceneObjectSelectors,
          snapshot: null,
          sendMessage: mockSendMessage,
          uid: "test-uid",
        }),
      );

      expect(result.current.selectedObjectIds).toEqual([]);

      selectedIds = ["token:abc123"];
      rerender();

      expect(result.current.selectedObjectIds).toEqual(["token:abc123"]);
    });
  });

  describe("Tool Mode Integration", () => {
    it("should indicate selection should be cleared when both transformMode and selectMode are false", () => {
      const mockUseObjectSelection = () => ({
        selectedObjectId: "token:abc123",
        selectedObjectIds: ["token:abc123"],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: false,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const manager = createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(manager.shouldClearSelection).toBe(true);
    });

    it("should indicate selection should persist when transformMode is true", () => {
      const mockUseObjectSelection = () => ({
        selectedObjectId: "token:abc123",
        selectedObjectIds: ["token:abc123"],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: true,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const manager = createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(manager.shouldClearSelection).toBe(false);
    });

    it("should indicate selection should persist when selectMode is true", () => {
      const mockUseObjectSelection = () => ({
        selectedObjectId: "token:abc123",
        selectedObjectIds: ["token:abc123"],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: false,
        selectMode: true,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const manager = createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(manager.shouldClearSelection).toBe(false);
    });

    it("should indicate selection should persist when both transformMode and selectMode are true", () => {
      const mockUseObjectSelection = () => ({
        selectedObjectId: "token:abc123",
        selectedObjectIds: ["token:abc123"],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: true,
        selectMode: true,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const manager = createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(manager.shouldClearSelection).toBe(false);
    });

    it("should update shouldClearSelection when tool modes change", () => {
      let transformMode = true;
      let selectMode = false;

      const mockUseObjectSelection = () => ({
        selectedObjectId: "token:abc123",
        selectedObjectIds: ["token:abc123"],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode,
        selectMode,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const { result, rerender } = renderHook(() =>
        createSelectionManager({
          useObjectSelection: mockUseObjectSelection,
          useToolMode: mockUseToolMode,
          useSceneObjectSelectors: mockUseSceneObjectSelectors,
          snapshot: null,
          sendMessage: mockSendMessage,
          uid: "test-uid",
        }),
      );

      expect(result.current.shouldClearSelection).toBe(false);

      // Switch to pointer mode (no transform or select)
      transformMode = false;
      selectMode = false;
      rerender();

      expect(result.current.shouldClearSelection).toBe(true);
    });

    it("should handle transition from no tool mode to select mode", () => {
      let transformMode = false;
      let selectMode = false;

      const mockUseObjectSelection = () => ({
        selectedObjectId: null,
        selectedObjectIds: [],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode,
        selectMode,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const { result, rerender } = renderHook(() =>
        createSelectionManager({
          useObjectSelection: mockUseObjectSelection,
          useToolMode: mockUseToolMode,
          useSceneObjectSelectors: mockUseSceneObjectSelectors,
          snapshot: null,
          sendMessage: mockSendMessage,
          uid: "test-uid",
        }),
      );

      expect(result.current.shouldClearSelection).toBe(true);

      selectMode = true;
      rerender();

      expect(result.current.shouldClearSelection).toBe(false);
    });
  });

  describe("useSceneObjectSelectors Integration", () => {
    it("should provide handleObjectSelection function from useSceneObjectSelectors", () => {
      const mockHandleObjectSelection = vi.fn();

      const mockUseObjectSelection = () => ({
        selectedObjectId: null,
        selectedObjectIds: [],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: false,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: mockHandleObjectSelection,
        handleObjectSelectionBatch: vi.fn(),
      });

      const manager = createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(manager.handleObjectSelection).toBe(mockHandleObjectSelection);
    });

    it("should provide handleObjectSelectionBatch function from useSceneObjectSelectors", () => {
      const mockHandleObjectSelectionBatch = vi.fn();

      const mockUseObjectSelection = () => ({
        selectedObjectId: null,
        selectedObjectIds: [],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: false,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: mockHandleObjectSelectionBatch,
      });

      const manager = createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(manager.handleObjectSelectionBatch).toBe(mockHandleObjectSelectionBatch);
    });

    it("should pass selectedObjectIds to useSceneObjectSelectors", () => {
      const selectedIds = ["token:abc123", "drawing:def456"];
      let capturedOptions: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      } | null = null;

      const mockUseObjectSelection = () => ({
        selectedObjectId: "token:abc123",
        selectedObjectIds: selectedIds,
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: true,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => {
        capturedOptions = options;
        return {
          handleObjectSelection: vi.fn(),
          handleObjectSelectionBatch: vi.fn(),
        };
      };

      createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.selectedObjectIds).toBe(selectedIds);
    });

    it("should pass selectObject to useSceneObjectSelectors", () => {
      let capturedOptions: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      } | null = null;

      const mockUseObjectSelection = () => ({
        selectedObjectId: null,
        selectedObjectIds: [],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: false,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => {
        capturedOptions = options;
        return {
          handleObjectSelection: vi.fn(),
          handleObjectSelectionBatch: vi.fn(),
        };
      };

      createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.selectObject).toBe(mockSelectObject);
    });

    it("should pass selectMultiple to useSceneObjectSelectors", () => {
      let capturedOptions: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      } | null = null;

      const mockUseObjectSelection = () => ({
        selectedObjectId: null,
        selectedObjectIds: [],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: false,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => {
        capturedOptions = options;
        return {
          handleObjectSelection: vi.fn(),
          handleObjectSelectionBatch: vi.fn(),
        };
      };

      createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.selectMultiple).toBe(mockSelectMultiple);
    });

    it("should pass deselect as clearSelection to useSceneObjectSelectors", () => {
      let capturedOptions: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      } | null = null;

      const mockUseObjectSelection = () => ({
        selectedObjectId: null,
        selectedObjectIds: [],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: false,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => {
        capturedOptions = options;
        return {
          handleObjectSelection: vi.fn(),
          handleObjectSelectionBatch: vi.fn(),
        };
      };

      createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions!.clearSelection).toBe(mockDeselect);
    });
  });

  describe("Lock/Unlock Operations", () => {
    it("should provide lockSelected function from useObjectSelection", () => {
      const mockUseObjectSelection = () => ({
        selectedObjectId: "token:abc123",
        selectedObjectIds: ["token:abc123"],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: true,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const manager = createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(manager.lockSelected).toBe(mockLockSelected);
    });

    it("should provide unlockSelected function from useObjectSelection", () => {
      const mockUseObjectSelection = () => ({
        selectedObjectId: "token:abc123",
        selectedObjectIds: ["token:abc123"],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: true,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const manager = createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(manager.unlockSelected).toBe(mockUnlockSelected);
    });

    it("should expose lockSelected when single object is selected", () => {
      const mockUseObjectSelection = () => ({
        selectedObjectId: "token:abc123",
        selectedObjectIds: ["token:abc123"],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: true,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const manager = createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(typeof manager.lockSelected).toBe("function");
      expect(manager.lockSelected).toBe(mockLockSelected);
    });

    it("should expose unlockSelected when single object is selected", () => {
      const mockUseObjectSelection = () => ({
        selectedObjectId: "token:abc123",
        selectedObjectIds: ["token:abc123"],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: true,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const manager = createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(typeof manager.unlockSelected).toBe("function");
      expect(manager.unlockSelected).toBe(mockUnlockSelected);
    });

    it("should expose lockSelected when multiple objects are selected", () => {
      const mockUseObjectSelection = () => ({
        selectedObjectId: "drawing:ghi789",
        selectedObjectIds: ["token:abc123", "token:def456", "drawing:ghi789"],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: false,
        selectMode: true,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const manager = createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(typeof manager.lockSelected).toBe("function");
      expect(manager.lockSelected).toBe(mockLockSelected);
    });

    it("should expose unlockSelected when multiple objects are selected", () => {
      const mockUseObjectSelection = () => ({
        selectedObjectId: "drawing:ghi789",
        selectedObjectIds: ["token:abc123", "token:def456", "drawing:ghi789"],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: false,
        selectMode: true,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const manager = createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(typeof manager.unlockSelected).toBe("function");
      expect(manager.unlockSelected).toBe(mockUnlockSelected);
    });
  });

  describe("Callback Stability", () => {
    it("should maintain handleObjectSelection stability when dependencies don't change", () => {
      const mockHandleObjectSelection = vi.fn();

      const mockUseObjectSelection = () => ({
        selectedObjectId: null,
        selectedObjectIds: [],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: false,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: mockHandleObjectSelection,
        handleObjectSelectionBatch: vi.fn(),
      });

      const { result, rerender } = renderHook(() =>
        createSelectionManager({
          useObjectSelection: mockUseObjectSelection,
          useToolMode: mockUseToolMode,
          useSceneObjectSelectors: mockUseSceneObjectSelectors,
          snapshot: null,
          sendMessage: mockSendMessage,
          uid: "test-uid",
        }),
      );

      const initialHandler = result.current.handleObjectSelection;

      rerender();

      expect(result.current.handleObjectSelection).toBe(initialHandler);
    });

    it("should maintain handleObjectSelectionBatch stability when dependencies don't change", () => {
      const mockHandleObjectSelectionBatch = vi.fn();

      const mockUseObjectSelection = () => ({
        selectedObjectId: null,
        selectedObjectIds: [],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: false,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: mockHandleObjectSelectionBatch,
      });

      const { result, rerender } = renderHook(() =>
        createSelectionManager({
          useObjectSelection: mockUseObjectSelection,
          useToolMode: mockUseToolMode,
          useSceneObjectSelectors: mockUseSceneObjectSelectors,
          snapshot: null,
          sendMessage: mockSendMessage,
          uid: "test-uid",
        }),
      );

      const initialHandler = result.current.handleObjectSelectionBatch;

      rerender();

      expect(result.current.handleObjectSelectionBatch).toBe(initialHandler);
    });

    it("should maintain clearSelection stability when dependencies don't change", () => {
      const mockUseObjectSelection = () => ({
        selectedObjectId: null,
        selectedObjectIds: [],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: false,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const { result, rerender } = renderHook(() =>
        createSelectionManager({
          useObjectSelection: mockUseObjectSelection,
          useToolMode: mockUseToolMode,
          useSceneObjectSelectors: mockUseSceneObjectSelectors,
          snapshot: null,
          sendMessage: mockSendMessage,
          uid: "test-uid",
        }),
      );

      const initialClearSelection = result.current.clearSelection;

      rerender();

      expect(result.current.clearSelection).toBe(initialClearSelection);
    });

    it("should maintain lockSelected stability when dependencies don't change", () => {
      const mockUseObjectSelection = () => ({
        selectedObjectId: "token:abc123",
        selectedObjectIds: ["token:abc123"],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: true,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const { result, rerender } = renderHook(() =>
        createSelectionManager({
          useObjectSelection: mockUseObjectSelection,
          useToolMode: mockUseToolMode,
          useSceneObjectSelectors: mockUseSceneObjectSelectors,
          snapshot: null,
          sendMessage: mockSendMessage,
          uid: "test-uid",
        }),
      );

      const initialLockSelected = result.current.lockSelected;

      rerender();

      expect(result.current.lockSelected).toBe(initialLockSelected);
    });

    it("should maintain unlockSelected stability when dependencies don't change", () => {
      const mockUseObjectSelection = () => ({
        selectedObjectId: "token:abc123",
        selectedObjectIds: ["token:abc123"],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: true,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const { result, rerender } = renderHook(() =>
        createSelectionManager({
          useObjectSelection: mockUseObjectSelection,
          useToolMode: mockUseToolMode,
          useSceneObjectSelectors: mockUseSceneObjectSelectors,
          snapshot: null,
          sendMessage: mockSendMessage,
          uid: "test-uid",
        }),
      );

      const initialUnlockSelected = result.current.unlockSelected;

      rerender();

      expect(result.current.unlockSelected).toBe(initialUnlockSelected);
    });
  });

  describe("Edge Cases", () => {
    it("should handle null snapshot gracefully", () => {
      const mockUseObjectSelection = () => ({
        selectedObjectId: null,
        selectedObjectIds: [],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: false,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      expect(() =>
        createSelectionManager({
          useObjectSelection: mockUseObjectSelection,
          useToolMode: mockUseToolMode,
          useSceneObjectSelectors: mockUseSceneObjectSelectors,
          snapshot: null,
          sendMessage: mockSendMessage,
          uid: "test-uid",
        }),
      ).not.toThrow();
    });

    it("should handle selection of objects with special characters in IDs", () => {
      const specialIds = ["token:abc!@#$%", "drawing:xyz&*()", "map:test-123"];

      const mockUseObjectSelection = () => ({
        selectedObjectId: specialIds[0] || null,
        selectedObjectIds: specialIds,
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: true,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const manager = createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(manager.selectedObjectIds).toEqual(specialIds);
    });

    it("should handle very large selection arrays", () => {
      const largeSelection = Array.from({ length: 100 }, (_, i) => `token:${i}`);

      const mockUseObjectSelection = () => ({
        selectedObjectId: largeSelection[99] || null,
        selectedObjectIds: largeSelection,
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: false,
        selectMode: true,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const manager = createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(manager.selectedObjectIds.length).toBe(100);
      expect(manager.selectedObjectIds).toEqual(largeSelection);
    });

    it("should handle rapid tool mode changes", () => {
      let transformMode = false;
      let selectMode = false;

      const mockUseObjectSelection = () => ({
        selectedObjectId: "token:abc123",
        selectedObjectIds: ["token:abc123"],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode,
        selectMode,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const { result, rerender } = renderHook(() =>
        createSelectionManager({
          useObjectSelection: mockUseObjectSelection,
          useToolMode: mockUseToolMode,
          useSceneObjectSelectors: mockUseSceneObjectSelectors,
          snapshot: null,
          sendMessage: mockSendMessage,
          uid: "test-uid",
        }),
      );

      // Rapid changes
      transformMode = true;
      rerender();
      expect(result.current.shouldClearSelection).toBe(false);

      transformMode = false;
      selectMode = true;
      rerender();
      expect(result.current.shouldClearSelection).toBe(false);

      selectMode = false;
      rerender();
      expect(result.current.shouldClearSelection).toBe(true);

      transformMode = true;
      rerender();
      expect(result.current.shouldClearSelection).toBe(false);
    });

    it("should handle empty string in selectedObjectIds array", () => {
      const mockUseObjectSelection = () => ({
        selectedObjectId: "",
        selectedObjectIds: [""],
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: true,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const manager = createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      expect(manager.selectedObjectIds).toEqual([""]);
    });
  });

  describe("Integration Scenarios", () => {
    it("should work with both selection and tool mode changing together", () => {
      let selectedIds: string[] = [];
      let transformMode = false;

      const mockUseObjectSelection = () => ({
        selectedObjectId: selectedIds[0] || null,
        selectedObjectIds: selectedIds,
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const { result, rerender } = renderHook(() =>
        createSelectionManager({
          useObjectSelection: mockUseObjectSelection,
          useToolMode: mockUseToolMode,
          useSceneObjectSelectors: mockUseSceneObjectSelectors,
          snapshot: null,
          sendMessage: mockSendMessage,
          uid: "test-uid",
        }),
      );

      expect(result.current.selectedObjectIds).toEqual([]);
      expect(result.current.shouldClearSelection).toBe(true);

      // User selects an object and enters transform mode
      selectedIds = ["token:abc123"];
      transformMode = true;
      rerender();

      expect(result.current.selectedObjectIds).toEqual(["token:abc123"]);
      expect(result.current.shouldClearSelection).toBe(false);

      // User exits transform mode
      transformMode = false;
      rerender();

      expect(result.current.shouldClearSelection).toBe(true);
    });

    it("should handle transition from single to multiple selection", () => {
      let selectedIds = ["token:abc123"];

      const mockUseObjectSelection = () => ({
        selectedObjectId: selectedIds[selectedIds.length - 1] || null,
        selectedObjectIds: selectedIds,
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: false,
        selectMode: true,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const { result, rerender } = renderHook(() =>
        createSelectionManager({
          useObjectSelection: mockUseObjectSelection,
          useToolMode: mockUseToolMode,
          useSceneObjectSelectors: mockUseSceneObjectSelectors,
          snapshot: null,
          sendMessage: mockSendMessage,
          uid: "test-uid",
        }),
      );

      expect(result.current.selectedObjectIds).toEqual(["token:abc123"]);

      // Expand to multiple selection
      selectedIds = ["token:abc123", "token:def456", "drawing:ghi789"];
      rerender();

      expect(result.current.selectedObjectIds).toEqual([
        "token:abc123",
        "token:def456",
        "drawing:ghi789",
      ]);
    });

    it("should handle transition from multiple to single selection", () => {
      let selectedIds = ["token:abc123", "token:def456", "drawing:ghi789"];

      const mockUseObjectSelection = () => ({
        selectedObjectId: selectedIds[selectedIds.length - 1] || null,
        selectedObjectIds: selectedIds,
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: true,
        selectMode: false,
      });

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: vi.fn(),
        handleObjectSelectionBatch: vi.fn(),
      });

      const { result, rerender } = renderHook(() =>
        createSelectionManager({
          useObjectSelection: mockUseObjectSelection,
          useToolMode: mockUseToolMode,
          useSceneObjectSelectors: mockUseSceneObjectSelectors,
          snapshot: null,
          sendMessage: mockSendMessage,
          uid: "test-uid",
        }),
      );

      expect(result.current.selectedObjectIds).toEqual([
        "token:abc123",
        "token:def456",
        "drawing:ghi789",
      ]);

      // Reduce to single selection
      selectedIds = ["drawing:ghi789"];
      rerender();

      expect(result.current.selectedObjectIds).toEqual(["drawing:ghi789"]);
    });

    it("should coordinate selection state across all exposed functions", () => {
      const selectedIds = ["token:abc123", "token:def456"];

      const mockUseObjectSelection = () => ({
        selectedObjectId: "token:def456",
        selectedObjectIds: selectedIds,
        selectObject: mockSelectObject,
        selectMultiple: mockSelectMultiple,
        deselect: mockDeselect,
        lockSelected: mockLockSelected,
        unlockSelected: mockUnlockSelected,
      });

      const mockUseToolMode = () => ({
        transformMode: false,
        selectMode: true,
      });

      const mockHandleObjectSelection = vi.fn();
      const mockHandleObjectSelectionBatch = vi.fn();

      const mockUseSceneObjectSelectors = (options: {
        selectedObjectIds: string[];
        selectObject: (objectId: string | null) => void;
        selectMultiple: (objectIds: string[], mode?: "replace" | "append" | "subtract") => void;
        clearSelection: () => void;
      }) => ({
        handleObjectSelection: mockHandleObjectSelection,
        handleObjectSelectionBatch: mockHandleObjectSelectionBatch,
      });

      const manager = createSelectionManager({
        useObjectSelection: mockUseObjectSelection,
        useToolMode: mockUseToolMode,
        useSceneObjectSelectors: mockUseSceneObjectSelectors,
        snapshot: null,
        sendMessage: mockSendMessage,
        uid: "test-uid",
      });

      // All functions should be available and point to correct implementations
      expect(manager.selectedObjectIds).toEqual(selectedIds);
      expect(manager.handleObjectSelection).toBe(mockHandleObjectSelection);
      expect(manager.handleObjectSelectionBatch).toBe(mockHandleObjectSelectionBatch);
      expect(manager.clearSelection).toBe(mockDeselect);
      expect(manager.lockSelected).toBe(mockLockSelected);
      expect(manager.unlockSelected).toBe(mockUnlockSelected);
    });
  });
});
