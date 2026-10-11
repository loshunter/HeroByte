/**
 * useKeyboardShortcuts
 *
 * Manages keyboard shortcuts for the VTT application.
 *
 * Handles:
 * - Delete/Backspace: Delete selected scene objects with permission checks
 * - Ctrl+Z/Cmd+Z: Undo drawing action (in draw mode) or undo player token selection (DM only)
 * - Ctrl+Y/Cmd+Y or Ctrl+Shift+Z: Redo drawing action
 *
 * Extracted from: apps/client/src/ui/App.tsx (lines 389-516)
 * Extraction date: 2025-10-20
 *
 * @module hooks/useKeyboardShortcuts
 */

import { useEffect } from "react";
import type { RoomSnapshot, ClientMessage } from "@herobyte/shared";
import { mapShortcutAllowed } from "../features/interaction/mapShortcut";
import { deleteConfirmText, planSelectionDelete } from "./selectionDelete";

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

  /**
   * Optional: Whether live map-edit mode is active. When true, Ctrl+Z/Ctrl+Y
   * belong to the map document (handled by useMapEditHotkeys), so the DM
   * selection-undo branch below is skipped — exactly one handler acts.
   */
  mapEditMode?: boolean;

  /**
   * A short, non-blocking notice (the app's toast). Delete says through it that props are deleted in
   * their own panel, and why a selection could not be deleted (locked, or not yours); these were
   * blocking alert()s.
   */
  notify: (message: string) => void;
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
/** Said (a toast, not a blocking alert) when Delete is pressed on a selection that cannot be deleted. */
export const LOCKED_CANNOT_DELETE = "Locked: only the DM can unlock it.";
export const LOCKED_CANNOT_DELETE_DM = "Locked: select it and press 🔓 Unlock first.";
export const NOT_YOURS_CANNOT_DELETE = "You can only delete objects you own.";
export const PROPS_OFF_CANNOT_DELETE =
  "The DM has player props off: your props cannot be deleted now.";

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
    mapEditMode,
    notify,
  } = options;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Typing surfaces own their keystrokes (chat box, brush/asset search,
      // inspector fields): Backspace there edits text — it must not delete
      // the selected tokens — and Ctrl+Z is native text undo. The focused map
      // keeps its keys beside an open floating window (see mapShortcut).
      if (!mapShortcutAllowed(e)) return;
      // Delete or Backspace deletes what the viewer may of the selection (selectionDelete.ts).
      if ((e.key === "Delete" || e.key === "Backspace") && selectedObjectIds.length > 0) {
        e.preventDefault();
        const plan = planSelectionDelete(selectedObjectIds, snapshot, isDM, uid);
        const deleting = plan.tokens.length + plan.drawings.length + plan.props.length;
        if (deleting === 0) {
          // A lock stops everyone, the DM included, until it is unlocked. Only the map
          // or a staging zone selected: nothing to delete, and nothing to say.
          if (plan.locked > 0) notify(isDM ? LOCKED_CANNOT_DELETE_DM : LOCKED_CANNOT_DELETE);
          else if (plan.propsOff > 0) notify(PROPS_OFF_CANNOT_DELETE);
          else if (plan.skipped > 0) notify(NOT_YOURS_CANNOT_DELETE);
          return;
        }
        if (plan.skipped > 0) {
          const selected = selectedObjectIds.length - plan.ignored;
          const message =
            plan.locked > 0
              ? `Cannot delete ${plan.skipped} locked object${plan.skipped > 1 ? "s" : ""}. Delete the ${deleting} unlocked object${deleting > 1 ? "s" : ""}?`
              : `You can only delete ${deleting} of ${selected} selected objects (${plan.skipped} owned by others). Continue?`;
          if (!confirm(message)) return;
        }
        if (confirm(deleteConfirmText(plan))) {
          for (const id of plan.tokens) sendMessage({ t: "delete-token", id });
          for (const id of plan.drawings) sendMessage({ t: "delete-drawing", id });
          for (const id of plan.props) sendMessage({ t: "delete-prop", id });
          clearSelection();
        }
        return;
      }

      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        // Priority 1: Undo drawing if draw mode is active and there's something to undo
        if (drawMode && drawingManager.canUndo) {
          e.preventDefault();
          drawingManager.handleUndo();
          return;
        }

        // Priority 2: Undo player token selection (DM only) if available.
        // Skipped in live map-edit mode — there Ctrl+Z undoes the map document
        // (useMapEditHotkeys), and this branch would otherwise double-fire.
        if (isDM && canUndoSelection && undoSelection && !mapEditMode && !drawMode) {
          e.preventDefault();
          console.log("[KeyDown] Ctrl+Z: Undoing player token selection");
          undoSelection();
          return;
        }
      }

      // Ctrl+Y or Cmd+Y for redo
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))
      ) {
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
    mapEditMode,
    notify,
  ]);
}
