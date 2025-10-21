/**
 * Characterization tests for useKeyboardShortcuts functionality
 *
 * These tests capture the behavior of the original keyboard shortcuts code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/client/src/ui/App.tsx (lines 389-516)
 *   - Lines 389-516: useEffect for keyboard event handling
 *   - Lines 392-493: Delete/Backspace key handler with complex permission logic
 *   - Lines 496-503: Ctrl+Z/Cmd+Z undo handler
 *   - Lines 505-511: Ctrl+Y/Cmd+Y/Ctrl+Shift+Z redo handler
 *
 * Target: apps/client/src/hooks/useKeyboardShortcuts.ts
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { RoomSnapshot, SceneObject } from "@shared";

// Mock hook implementation that simulates the CURRENT behavior in App.tsx
function useKeyboardShortcuts(options: {
  selectedObjectIds: string[];
  isDM: boolean;
  snapshot: RoomSnapshot | null;
  uid: string;
  sendMessage: (msg: unknown) => void;
  clearSelection: () => void;
  drawMode: boolean;
  drawingManager: {
    canUndo: boolean;
    canRedo: boolean;
    handleUndo: () => void;
    handleRedo: () => void;
  };
}) {
  const {
    selectedObjectIds,
    isDM,
    snapshot,
    uid,
    sendMessage,
    clearSelection,
    drawMode,
    drawingManager,
  } = options;

  // Effect implementation from App.tsx lines 389-516
  const handleKeyDown = (e: KeyboardEvent) => {
    // Delete or Backspace to delete selected object(s)
    if ((e.key === "Delete" || e.key === "Backspace") && selectedObjectIds.length > 0) {
      console.log("[KeyDown] Delete/Backspace pressed:", {
        key: e.key,
        selectedObjectIds,
        isDM,
        target: e.target,
      });

      e.preventDefault();

      // Filter to only objects the user can delete
      // Note: Locked objects CANNOT be deleted by anyone (including DM)
      const objectsToDelete = selectedObjectIds.filter((id) => {
        const obj = snapshot?.sceneObjects?.find((o) => o.id === id);
        if (!obj) return false;

        // LOCK BLOCKS EVERYONE: Can't delete locked objects (even DM must unlock first)
        if (obj.locked) return false;

        // Can't delete the map
        if (id.startsWith("map:")) return false;

        // Can delete if DM (and not locked)
        if (isDM) return true;

        // Can delete if owner (or no owner set) and not locked
        // Owner is stored at the SceneObject level, not in data
        return !obj.owner || obj.owner === uid;
      });

      if (objectsToDelete.length === 0) {
        const hasLocked = selectedObjectIds.some((id) => {
          const obj = snapshot?.sceneObjects?.find((o) => o.id === id);
          return obj?.locked;
        });

        if (hasLocked) {
          alert("Cannot delete locked objects. Unlock them first using the lock icon.");
        } else {
          alert("You can only delete objects you own.");
        }
        return;
      }

      // Show warning if some objects can't be deleted
      if (objectsToDelete.length < selectedObjectIds.length) {
        const skipped = selectedObjectIds.length - objectsToDelete.length;
        const lockedCount = selectedObjectIds.filter((id) => {
          const obj = snapshot?.sceneObjects?.find((o) => o.id === id);
          return obj?.locked;
        }).length;

        const message =
          lockedCount > 0
            ? `Cannot delete ${skipped} locked object${skipped > 1 ? "s" : ""}. Delete the ${objectsToDelete.length} unlocked object${objectsToDelete.length > 1 ? "s" : ""}?`
            : `You can only delete ${objectsToDelete.length} of ${selectedObjectIds.length} selected objects (${skipped} owned by others). Continue?`;

        if (!confirm(message)) {
          return;
        }
      }

      // Separate objects by type
      const tokens = objectsToDelete
        .filter((id) => id.startsWith("token:"))
        .map((id) => id.split(":")[1]!)
        .filter(Boolean);
      const drawings = objectsToDelete
        .filter((id) => id.startsWith("drawing:"))
        .map((id) => id.split(":")[1]!)
        .filter(Boolean);

      if (tokens.length === 0 && drawings.length === 0) {
        return;
      }

      // Build confirmation message
      const parts: string[] = [];
      if (tokens.length > 0) {
        parts.push(`${tokens.length} token${tokens.length > 1 ? "s" : ""}`);
      }
      if (drawings.length > 0) {
        parts.push(`${drawings.length} drawing${drawings.length > 1 ? "s" : ""}`);
      }
      const message = `Delete ${parts.join(" and ")}? This cannot be undone.`;

      if (confirm(message)) {
        console.log("[Delete] Deleting selected objects:", { tokens, drawings });

        // Delete all tokens
        for (const id of tokens) {
          sendMessage({ t: "delete-token", id });
        }

        // Delete all drawings
        for (const id of drawings) {
          sendMessage({ t: "delete-drawing", id });
        }

        clearSelection();
      }
      return;
    }

    // Ctrl+Z or Cmd+Z for undo
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      // Only undo if draw mode is active and there's something to undo
      if (drawMode && drawingManager.canUndo) {
        e.preventDefault();
        drawingManager.handleUndo();
      }
    }

    // Ctrl+Y or Cmd+Y for redo
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "Z"))) {
      if (drawMode && drawingManager.canRedo) {
        e.preventDefault();
        drawingManager.handleRedo();
      }
    }
  };

  return { handleKeyDown };
}

// Helper to create mock snapshots
function createSnapshot(overrides?: Partial<RoomSnapshot>): RoomSnapshot {
  return {
    users: [],
    tokens: [],
    players: [],
    characters: [],
    mapBackground: undefined,
    pointers: [],
    drawings: [],
    gridSize: 50,
    gridSquareSize: 5,
    diceRolls: [],
    sceneObjects: [],
    ...overrides,
  };
}

// Helper to create mock scene objects
function createSceneObject(
  id: string,
  type: "token" | "drawing" | "map",
  overrides?: Partial<SceneObject>,
): SceneObject {
  const baseObject = {
    id,
    type,
    zIndex: 0,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    ...overrides,
  };

  if (type === "token") {
    return { ...baseObject, type: "token", data: { color: "#ff0000" } } as SceneObject;
  } else if (type === "drawing") {
    return {
      ...baseObject,
      type: "drawing",
      data: { drawing: { id: "1", type: "path", points: [0, 0, 1, 1], color: "#000" } },
    } as SceneObject;
  } else {
    return { ...baseObject, type: "map", data: {} } as SceneObject;
  }
}

describe("useKeyboardShortcuts - Characterization", () => {
  let mockSendMessage: ReturnType<typeof vi.fn>;
  let mockClearSelection: ReturnType<typeof vi.fn>;
  let mockHandleUndo: ReturnType<typeof vi.fn>;
  let mockHandleRedo: ReturnType<typeof vi.fn>;
  let mockAlert: ReturnType<typeof vi.spyOn>;
  let mockConfirm: ReturnType<typeof vi.spyOn>;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockSendMessage = vi.fn();
    mockClearSelection = vi.fn();
    mockHandleUndo = vi.fn();
    mockHandleRedo = vi.fn();

    // Mock window.confirm and window.alert
    mockConfirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    mockAlert = vi.spyOn(window, "alert").mockImplementation(() => {});
    mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Delete/Backspace key - No selection cases", () => {
    it("should do nothing when no objects are selected", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: [],
          isDM: true,
          snapshot: createSnapshot(),
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(mockClearSelection).not.toHaveBeenCalled();
      expect(mockAlert).not.toHaveBeenCalled();
      expect(mockConfirm).not.toHaveBeenCalled();
    });

    it("should do nothing with Backspace when no objects are selected", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: [],
          isDM: false,
          snapshot: createSnapshot(),
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Backspace" });
      result.current.handleKeyDown(event);

      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(mockClearSelection).not.toHaveBeenCalled();
    });
  });

  describe("Delete/Backspace key - Single token deletion", () => {
    it("should delete single unlocked token as DM", () => {
      const snapshot = createSnapshot({
        sceneObjects: [createSceneObject("token:123", "token", { locked: false })],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["token:123"],
          isDM: true,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockConsoleLog).toHaveBeenCalledWith("[KeyDown] Delete/Backspace pressed:", {
        key: "Delete",
        selectedObjectIds: ["token:123"],
        isDM: true,
        target: event.target,
      });
      expect(mockConfirm).toHaveBeenCalledWith("Delete 1 token? This cannot be undone.");
      expect(mockSendMessage).toHaveBeenCalledWith({ t: "delete-token", id: "123" });
      expect(mockClearSelection).toHaveBeenCalled();
    });

    it("should delete single unlocked token as owner", () => {
      const snapshot = createSnapshot({
        sceneObjects: [createSceneObject("token:123", "token", { locked: false, owner: "user1" })],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["token:123"],
          isDM: false,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockConfirm).toHaveBeenCalledWith("Delete 1 token? This cannot be undone.");
      expect(mockSendMessage).toHaveBeenCalledWith({ t: "delete-token", id: "123" });
      expect(mockClearSelection).toHaveBeenCalled();
    });

    it("should show alert when non-owner tries to delete token owned by others", () => {
      const snapshot = createSnapshot({
        sceneObjects: [createSceneObject("token:123", "token", { locked: false, owner: "user2" })],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["token:123"],
          isDM: false,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockAlert).toHaveBeenCalledWith("You can only delete objects you own.");
      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(mockClearSelection).not.toHaveBeenCalled();
    });

    it("should show alert when DM tries to delete locked token", () => {
      const snapshot = createSnapshot({
        sceneObjects: [createSceneObject("token:123", "token", { locked: true })],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["token:123"],
          isDM: true,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockAlert).toHaveBeenCalledWith(
        "Cannot delete locked objects. Unlock them first using the lock icon.",
      );
      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(mockClearSelection).not.toHaveBeenCalled();
    });

    it("should show alert when owner tries to delete their own locked token", () => {
      const snapshot = createSnapshot({
        sceneObjects: [createSceneObject("token:123", "token", { locked: true, owner: "user1" })],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["token:123"],
          isDM: false,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockAlert).toHaveBeenCalledWith(
        "Cannot delete locked objects. Unlock them first using the lock icon.",
      );
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("should delete token with no owner set (treated as deletable)", () => {
      const snapshot = createSnapshot({
        sceneObjects: [createSceneObject("token:123", "token", { locked: false, owner: null })],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["token:123"],
          isDM: false,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockSendMessage).toHaveBeenCalledWith({ t: "delete-token", id: "123" });
      expect(mockClearSelection).toHaveBeenCalled();
    });

    it("should delete token with undefined owner (treated as deletable)", () => {
      const snapshot = createSnapshot({
        sceneObjects: [createSceneObject("token:123", "token", { locked: false })],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["token:123"],
          isDM: false,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockSendMessage).toHaveBeenCalledWith({ t: "delete-token", id: "123" });
      expect(mockClearSelection).toHaveBeenCalled();
    });
  });

  describe("Delete/Backspace key - Single drawing deletion", () => {
    it("should delete single unlocked drawing as DM", () => {
      const snapshot = createSnapshot({
        sceneObjects: [createSceneObject("drawing:456", "drawing", { locked: false })],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["drawing:456"],
          isDM: true,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockConfirm).toHaveBeenCalledWith("Delete 1 drawing? This cannot be undone.");
      expect(mockSendMessage).toHaveBeenCalledWith({ t: "delete-drawing", id: "456" });
      expect(mockClearSelection).toHaveBeenCalled();
    });

    it("should delete single unlocked drawing as owner", () => {
      const snapshot = createSnapshot({
        sceneObjects: [
          createSceneObject("drawing:456", "drawing", { locked: false, owner: "user1" }),
        ],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["drawing:456"],
          isDM: false,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockSendMessage).toHaveBeenCalledWith({ t: "delete-drawing", id: "456" });
      expect(mockClearSelection).toHaveBeenCalled();
    });

    it("should show alert when non-owner tries to delete drawing owned by others", () => {
      const snapshot = createSnapshot({
        sceneObjects: [
          createSceneObject("drawing:456", "drawing", { locked: false, owner: "user2" }),
        ],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["drawing:456"],
          isDM: false,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockAlert).toHaveBeenCalledWith("You can only delete objects you own.");
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("should show alert when trying to delete locked drawing", () => {
      const snapshot = createSnapshot({
        sceneObjects: [createSceneObject("drawing:456", "drawing", { locked: true })],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["drawing:456"],
          isDM: true,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockAlert).toHaveBeenCalledWith(
        "Cannot delete locked objects. Unlock them first using the lock icon.",
      );
      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe("Delete/Backspace key - Map object restriction", () => {
    it("should not delete map objects (DM)", () => {
      const snapshot = createSnapshot({
        sceneObjects: [createSceneObject("map:789", "map", { locked: false })],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["map:789"],
          isDM: true,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockAlert).toHaveBeenCalledWith("You can only delete objects you own.");
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("should not delete map objects (non-DM)", () => {
      const snapshot = createSnapshot({
        sceneObjects: [createSceneObject("map:789", "map", { locked: false })],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["map:789"],
          isDM: false,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockAlert).toHaveBeenCalledWith("You can only delete objects you own.");
      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe("Delete/Backspace key - Multiple object deletion", () => {
    it("should delete multiple unlocked objects (all deletable)", () => {
      const snapshot = createSnapshot({
        sceneObjects: [
          createSceneObject("token:1", "token", { locked: false }),
          createSceneObject("token:2", "token", { locked: false }),
          createSceneObject("drawing:3", "drawing", { locked: false }),
        ],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["token:1", "token:2", "drawing:3"],
          isDM: true,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockConfirm).toHaveBeenCalledWith(
        "Delete 2 tokens and 1 drawing? This cannot be undone.",
      );
      expect(mockSendMessage).toHaveBeenCalledTimes(3);
      expect(mockSendMessage).toHaveBeenCalledWith({ t: "delete-token", id: "1" });
      expect(mockSendMessage).toHaveBeenCalledWith({ t: "delete-token", id: "2" });
      expect(mockSendMessage).toHaveBeenCalledWith({ t: "delete-drawing", id: "3" });
      expect(mockClearSelection).toHaveBeenCalled();
    });

    it("should delete multiple objects with some locked - shows confirm and deletes unlocked", () => {
      const snapshot = createSnapshot({
        sceneObjects: [
          createSceneObject("token:1", "token", { locked: false }),
          createSceneObject("token:2", "token", { locked: true }),
          createSceneObject("drawing:3", "drawing", { locked: false }),
        ],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["token:1", "token:2", "drawing:3"],
          isDM: true,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockConfirm).toHaveBeenCalledWith(
        "Cannot delete 1 locked object. Delete the 2 unlocked objects?",
      );
      expect(mockSendMessage).toHaveBeenCalledTimes(2);
      expect(mockSendMessage).toHaveBeenCalledWith({ t: "delete-token", id: "1" });
      expect(mockSendMessage).toHaveBeenCalledWith({ t: "delete-drawing", id: "3" });
      expect(mockClearSelection).toHaveBeenCalled();
    });

    it("should delete multiple objects with some owned by others - shows confirm and deletes owned", () => {
      const snapshot = createSnapshot({
        sceneObjects: [
          createSceneObject("token:1", "token", { locked: false, owner: "user1" }),
          createSceneObject("token:2", "token", { locked: false, owner: "user2" }),
          createSceneObject("drawing:3", "drawing", { locked: false, owner: "user1" }),
        ],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["token:1", "token:2", "drawing:3"],
          isDM: false,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockConfirm).toHaveBeenCalledWith(
        "You can only delete 2 of 3 selected objects (1 owned by others). Continue?",
      );
      expect(mockSendMessage).toHaveBeenCalledTimes(2);
      expect(mockSendMessage).toHaveBeenCalledWith({ t: "delete-token", id: "1" });
      expect(mockSendMessage).toHaveBeenCalledWith({ t: "delete-drawing", id: "3" });
    });

    it("should not delete when user cancels confirm dialog", () => {
      mockConfirm.mockReturnValue(false);

      const snapshot = createSnapshot({
        sceneObjects: [
          createSceneObject("token:1", "token", { locked: false }),
          createSceneObject("token:2", "token", { locked: true }),
        ],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["token:1", "token:2"],
          isDM: true,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(mockClearSelection).not.toHaveBeenCalled();
    });

    it("should delete both tokens and drawings together with correct message", () => {
      const snapshot = createSnapshot({
        sceneObjects: [
          createSceneObject("token:1", "token", { locked: false }),
          createSceneObject("token:2", "token", { locked: false }),
          createSceneObject("token:3", "token", { locked: false }),
          createSceneObject("drawing:4", "drawing", { locked: false }),
          createSceneObject("drawing:5", "drawing", { locked: false }),
        ],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["token:1", "token:2", "token:3", "drawing:4", "drawing:5"],
          isDM: true,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockConfirm).toHaveBeenCalledWith(
        "Delete 3 tokens and 2 drawings? This cannot be undone.",
      );
      expect(mockSendMessage).toHaveBeenCalledTimes(5);
    });

    it("should use singular form in message for single locked object", () => {
      const snapshot = createSnapshot({
        sceneObjects: [
          createSceneObject("token:1", "token", { locked: false }),
          createSceneObject("token:2", "token", { locked: true }),
        ],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["token:1", "token:2"],
          isDM: true,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockConfirm).toHaveBeenCalledWith(
        "Cannot delete 1 locked object. Delete the 1 unlocked object?",
      );
    });

    it("should use plural form in message for multiple locked objects", () => {
      const snapshot = createSnapshot({
        sceneObjects: [
          createSceneObject("token:1", "token", { locked: false }),
          createSceneObject("token:2", "token", { locked: true }),
          createSceneObject("token:3", "token", { locked: true }),
        ],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["token:1", "token:2", "token:3"],
          isDM: true,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockConfirm).toHaveBeenCalledWith(
        "Cannot delete 2 locked objects. Delete the 1 unlocked object?",
      );
    });
  });

  describe("Delete/Backspace key - Edge cases", () => {
    it("should handle object not found in snapshot", () => {
      const snapshot = createSnapshot({
        sceneObjects: [],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["token:999"],
          isDM: true,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockAlert).toHaveBeenCalledWith("You can only delete objects you own.");
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("should handle null snapshot gracefully", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["token:123"],
          isDM: true,
          snapshot: null,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockAlert).toHaveBeenCalledWith("You can only delete objects you own.");
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("should call preventDefault on Delete key when objects are selected", () => {
      const snapshot = createSnapshot({
        sceneObjects: [createSceneObject("token:123", "token", { locked: false })],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["token:123"],
          isDM: true,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete", cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");
      result.current.handleKeyDown(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it("should work identically with Backspace key", () => {
      const snapshot = createSnapshot({
        sceneObjects: [createSceneObject("token:123", "token", { locked: false })],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["token:123"],
          isDM: true,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Backspace" });
      result.current.handleKeyDown(event);

      expect(mockConsoleLog).toHaveBeenCalledWith("[KeyDown] Delete/Backspace pressed:", {
        key: "Backspace",
        selectedObjectIds: ["token:123"],
        isDM: true,
        target: event.target,
      });
      expect(mockSendMessage).toHaveBeenCalledWith({ t: "delete-token", id: "123" });
    });

    it("should not delete when user cancels final confirmation", () => {
      let confirmCallCount = 0;
      mockConfirm.mockImplementation(() => {
        confirmCallCount++;
        return confirmCallCount === 1 ? true : false; // Accept first (partial), reject second (final)
      });

      const snapshot = createSnapshot({
        sceneObjects: [
          createSceneObject("token:1", "token", { locked: false }),
          createSceneObject("token:2", "token", { locked: true }),
        ],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["token:1", "token:2"],
          isDM: true,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      // First confirm for partial deletion warning
      expect(mockConfirm).toHaveBeenNthCalledWith(
        1,
        "Cannot delete 1 locked object. Delete the 1 unlocked object?",
      );
      // Second confirm for final deletion
      expect(mockConfirm).toHaveBeenNthCalledWith(2, "Delete 1 token? This cannot be undone.");
      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(mockClearSelection).not.toHaveBeenCalled();
    });

    it("should log console message with delete action details", () => {
      const snapshot = createSnapshot({
        sceneObjects: [
          createSceneObject("token:1", "token", { locked: false }),
          createSceneObject("drawing:2", "drawing", { locked: false }),
        ],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["token:1", "drawing:2"],
          isDM: true,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockConsoleLog).toHaveBeenCalledWith("[Delete] Deleting selected objects:", {
        tokens: ["1"],
        drawings: ["2"],
      });
    });

    it("should return early if no tokens or drawings after filtering", () => {
      const snapshot = createSnapshot({
        sceneObjects: [createSceneObject("map:1", "map", { locked: false })],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["map:1"],
          isDM: true,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockAlert).toHaveBeenCalled();
      expect(mockClearSelection).not.toHaveBeenCalled();
    });
  });

  describe("Undo/Redo - Undo functionality", () => {
    it("should undo when in draw mode with Ctrl+Z and canUndo is true", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: [],
          isDM: false,
          snapshot: createSnapshot(),
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: true,
          drawingManager: {
            canUndo: true,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "z", ctrlKey: true });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");
      result.current.handleKeyDown(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(mockHandleUndo).toHaveBeenCalled();
    });

    it("should undo when in draw mode with Meta+Z (Mac) and canUndo is true", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: [],
          isDM: false,
          snapshot: createSnapshot(),
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: true,
          drawingManager: {
            canUndo: true,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "z", metaKey: true });
      result.current.handleKeyDown(event);

      expect(mockHandleUndo).toHaveBeenCalled();
    });

    it("should not undo when not in draw mode", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: [],
          isDM: false,
          snapshot: createSnapshot(),
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: true,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "z", ctrlKey: true });
      result.current.handleKeyDown(event);

      expect(mockHandleUndo).not.toHaveBeenCalled();
    });

    it("should not undo when canUndo is false", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: [],
          isDM: false,
          snapshot: createSnapshot(),
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: true,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "z", ctrlKey: true });
      result.current.handleKeyDown(event);

      expect(mockHandleUndo).not.toHaveBeenCalled();
    });

    it("should not undo when Shift key is pressed (that would be redo)", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: [],
          isDM: false,
          snapshot: createSnapshot(),
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: true,
          drawingManager: {
            canUndo: true,
            canRedo: true,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Z", ctrlKey: true, shiftKey: true });
      result.current.handleKeyDown(event);

      expect(mockHandleUndo).not.toHaveBeenCalled();
      expect(mockHandleRedo).toHaveBeenCalled();
    });

    it("should prevent default browser behavior when undoing", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: [],
          isDM: false,
          snapshot: createSnapshot(),
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: true,
          drawingManager: {
            canUndo: true,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");
      result.current.handleKeyDown(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe("Undo/Redo - Redo functionality", () => {
    it("should redo when in draw mode with Ctrl+Y and canRedo is true", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: [],
          isDM: false,
          snapshot: createSnapshot(),
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: true,
          drawingManager: {
            canUndo: false,
            canRedo: true,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "y", ctrlKey: true });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");
      result.current.handleKeyDown(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(mockHandleRedo).toHaveBeenCalled();
    });

    it("should redo when in draw mode with Ctrl+Shift+Z and canRedo is true", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: [],
          isDM: false,
          snapshot: createSnapshot(),
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: true,
          drawingManager: {
            canUndo: false,
            canRedo: true,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Z", ctrlKey: true, shiftKey: true });
      result.current.handleKeyDown(event);

      expect(mockHandleRedo).toHaveBeenCalled();
    });

    it("should redo when in draw mode with Meta+Y (Mac) and canRedo is true", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: [],
          isDM: false,
          snapshot: createSnapshot(),
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: true,
          drawingManager: {
            canUndo: false,
            canRedo: true,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "y", metaKey: true });
      result.current.handleKeyDown(event);

      expect(mockHandleRedo).toHaveBeenCalled();
    });

    it("should not redo when not in draw mode", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: [],
          isDM: false,
          snapshot: createSnapshot(),
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: true,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "y", ctrlKey: true });
      result.current.handleKeyDown(event);

      expect(mockHandleRedo).not.toHaveBeenCalled();
    });

    it("should not redo when canRedo is false", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: [],
          isDM: false,
          snapshot: createSnapshot(),
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: true,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "y", ctrlKey: true });
      result.current.handleKeyDown(event);

      expect(mockHandleRedo).not.toHaveBeenCalled();
    });

    it("should prevent default browser behavior when redoing", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: [],
          isDM: false,
          snapshot: createSnapshot(),
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: true,
          drawingManager: {
            canUndo: false,
            canRedo: true,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "y", ctrlKey: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");
      result.current.handleKeyDown(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe("Edge cases and integration", () => {
    it("should not trigger shortcuts for other keys like Escape", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["token:123"],
          isDM: true,
          snapshot: createSnapshot({
            sceneObjects: [createSceneObject("token:123", "token", { locked: false })],
          }),
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: true,
          drawingManager: {
            canUndo: true,
            canRedo: true,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Escape" });
      result.current.handleKeyDown(event);

      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(mockHandleUndo).not.toHaveBeenCalled();
      expect(mockHandleRedo).not.toHaveBeenCalled();
    });

    it("should handle Delete and undo commands independently", () => {
      const snapshot = createSnapshot({
        sceneObjects: [createSceneObject("token:123", "token", { locked: false })],
      });

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["token:123"],
          isDM: true,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: true,
          drawingManager: {
            canUndo: true,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      // First, delete
      const deleteEvent = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(deleteEvent);
      expect(mockSendMessage).toHaveBeenCalled();

      // Then, undo
      const undoEvent = new KeyboardEvent("keydown", { key: "z", ctrlKey: true });
      result.current.handleKeyDown(undoEvent);
      expect(mockHandleUndo).toHaveBeenCalled();
    });

    it("should handle lowercase 'z' for undo", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: [],
          isDM: false,
          snapshot: createSnapshot(),
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: true,
          drawingManager: {
            canUndo: true,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "z", ctrlKey: true });
      result.current.handleKeyDown(event);

      expect(mockHandleUndo).toHaveBeenCalled();
    });

    it("should handle uppercase 'Z' for redo with Shift", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: [],
          isDM: false,
          snapshot: createSnapshot(),
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: true,
          drawingManager: {
            canUndo: false,
            canRedo: true,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Z", ctrlKey: true, shiftKey: true });
      result.current.handleKeyDown(event);

      expect(mockHandleRedo).toHaveBeenCalled();
    });

    it("should not prevent default for keys that don't match shortcuts", () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: [],
          isDM: false,
          snapshot: createSnapshot(),
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "a", ctrlKey: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");
      result.current.handleKeyDown(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it("should handle case where sceneObjects is undefined in snapshot", () => {
      const snapshot = createSnapshot();
      delete (snapshot as { sceneObjects?: unknown }).sceneObjects;

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          selectedObjectIds: ["token:123"],
          isDM: true,
          snapshot,
          uid: "user1",
          sendMessage: mockSendMessage,
          clearSelection: mockClearSelection,
          drawMode: false,
          drawingManager: {
            canUndo: false,
            canRedo: false,
            handleUndo: mockHandleUndo,
            handleRedo: mockHandleRedo,
          },
        }),
      );

      const event = new KeyboardEvent("keydown", { key: "Delete" });
      result.current.handleKeyDown(event);

      expect(mockAlert).toHaveBeenCalledWith("You can only delete objects you own.");
    });
  });
});
