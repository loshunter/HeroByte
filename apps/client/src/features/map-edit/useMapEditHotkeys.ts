// ============================================================================
// MAP-EDIT UNDO/REDO HOTKEYS
// ============================================================================
// While map-edit mode is active, Ctrl/Cmd+Z undoes and Ctrl/Cmd+Y (or
// Ctrl/Cmd+Shift+Z) redoes on the LIVE map document — and ONLY the map
// document. The companion guard in useKeyboardShortcuts skips its DM
// selection-undo branch in the same mode, so exactly one handler acts (no
// double-fire). Gated on mapEditMode so the listener is absent everywhere else;
// gated on canUndo/canRedo so an empty history leaves the keystroke untouched
// rather than sending a no-op command to the server.

import { useEffect } from "react";

interface UseMapEditHotkeysOptions {
  mapEditMode: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

export function useMapEditHotkeys({
  mapEditMode,
  canUndo,
  canRedo,
  undo,
  redo,
}: UseMapEditHotkeysOptions): void {
  useEffect(() => {
    if (!mapEditMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      // Redo: Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z (checked first — Shift+Z is redo,
      // not undo). Shift normalizes the key to "Z"; toLowerCase folds both.
      if (key === "y" || (event.shiftKey && key === "z")) {
        if (!canRedo) return;
        event.preventDefault();
        redo();
        return;
      }
      // Undo: Ctrl/Cmd+Z with no Shift.
      if (key === "z" && !event.shiftKey) {
        if (!canUndo) return;
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mapEditMode, canUndo, canRedo, undo, redo]);
}
