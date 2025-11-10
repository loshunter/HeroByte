/**
 * useKeyboardShortcuts
 *
 * Manages keyboard shortcuts for the VTT application.
 *
 * Handles:
 * - Delete/Backspace: Delete selected scene objects with permission checks
 * - Ctrl+Z/Cmd+Z: Undo drawing action (in draw mode) or undo player token selection (DM only)
 * - Ctrl+Y/Cmd+Y or Ctrl+Shift+Z: Redo drawing action
 * - Escape: Clear selection (when objects are selected)
 *
 * Extracted from: apps/client/src/ui/App.tsx (lines 389-516)
 * Extraction date: 2025-10-20
 *
 * @module hooks/useKeyboardShortcuts
 */

import { useEffect } from "react";
import type { RoomSnapshot, ClientMessage } from "@shared";

/**
 * Drawing manager interface for undo/redo operations
 */
export interface DrawingManager {
  /**
   * Whether there are actions available to undo
   */
  canUndo: boolean;

  /**
   * Whether there are actions available to redo
   */
  canRedo: boolean;

  /**
   * Handler to undo the last drawing action
   */
  handleUndo: () => void;

  /**
   * Handler to redo the last undone drawing action
   */
  handleRedo: () => void;
}

/**
 * Options for the useKeyboardShortcuts hook
 */
export interface UseKeyboardShortcutsOptions {
  /**
   * Array of currently selected object IDs
   */
  selectedObjectIds: string[];

  /**
   * Whether the current user is a DM (Dungeon Master)
   */
  isDM: boolean;

  /**
   * Current game state snapshot from the server
   */
  snapshot: RoomSnapshot | null;

  /**
   * Current user's unique identifier
   */
  uid: string;

  /**
   * Function to send messages to the server
   */
  sendMessage: (msg: ClientMessage) => void;

  /**
   * Function to clear all selected objects
   */
  clearSelection: () => void;

  /**
   * Whether draw mode is currently active
   */
  drawMode: boolean;

  /**
   * Drawing manager for undo/redo operations
   */
  drawingManager: DrawingManager;

  /**
   * Optional: Function to undo player token selection (DM only)
   */
  undoSelection?: () => void;

  /**
   * Optional: Whether there is a player token selection to undo (DM only)
   */
  canUndoSelection?: boolean;
}

/**
 * Hook for managing keyboard shortcuts in the VTT application.
 *
 * This hook sets up global keyboard event listeners to handle:
 *
 * 1. **Delete/Backspace**: Deletes selected scene objects
 *    - Performs permission checks (owner, DM, locked state)
 *    - Shows confirmation dialogs
 *    - Separates tokens and drawings for batch deletion
 *    - Locked objects cannot be deleted by anyone (including DM)
 *
 * 2. **Ctrl+Z/Cmd+Z**: Undo last drawing action
 *    - Only works when draw mode is active
 *    - Checks if undo is available via drawingManager
 *
 * 3. **Ctrl+Y/Cmd+Y or Ctrl+Shift+Z**: Redo last undone drawing action
 *    - Only works when draw mode is active
 *    - Checks if redo is available via drawingManager
 *
 * @param options - Configuration options for keyboard shortcuts
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts({
 *   selectedObjectIds,
 *   isDM,
 *   snapshot,
 *   uid,
 *   sendMessage,
 *   clearSelection,
 *   drawMode,
 *   drawingManager,
 * });
 * ```
 *
 * @see {@link UseKeyboardShortcutsOptions} for all available options
 * @see {@link DrawingManager} for drawing manager interface
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void {
  const {
    selectedObjectIds,
    isDM,
    snapshot,
    uid,
    sendMessage,
    clearSelection,
    drawMode,
    drawingManager,
    undoSelection,
    canUndoSelection,
  } = options;

  useEffect(() => {
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
        // Priority 1: Undo drawing if draw mode is active and there's something to undo
        if (drawMode && drawingManager.canUndo) {
          e.preventDefault();
          drawingManager.handleUndo();
          return;
        }

        // Priority 2: Undo player token selection (DM only) if available
        if (isDM && canUndoSelection && undoSelection) {
          e.preventDefault();
          console.log("[KeyDown] Ctrl+Z: Undoing player token selection");
          undoSelection();
          return;
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

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedObjectIds,
    isDM,
    snapshot,
    uid,
    sendMessage,
    clearSelection,
    drawMode,
    drawingManager,
    undoSelection,
    canUndoSelection,
  ]);
}
