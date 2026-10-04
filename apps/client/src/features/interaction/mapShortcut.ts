// ============================================================================
// MAP SHORTCUTS
// ============================================================================
// The one gate for a single-key or Ctrl/Cmd map shortcut (Delete, undo/redo,
// the DM's G). A shortcut belongs to the map when the map has keyboard focus —
// pressing the map gives it focus (MapBoard) — and nothing in front owns the
// key but a desktop floating window that opted in (Chat & Rolls, Dice, the DM
// Menu …): a nonmodal window beside the map must not swallow the map's keys.
// A modal, a popover, a phone screen or sheet, a text field, IME composition
// and a consumed event still win (escapeRegistry.canHandleShortcut). Without
// map focus it is the old rule: only when nothing is in front at all.

import { escapeRegistry } from "./useEscapeOwner";

export const MAP_SURFACE_SELECTOR = "[data-map-history-surface]";

export function mapShortcutAllowed(event: KeyboardEvent): boolean {
  const active = document.activeElement;
  const mapFocused = active instanceof HTMLElement && active.matches(MAP_SURFACE_SELECTOR);
  return escapeRegistry.canHandleShortcut(
    event,
    { root: null, anchor: mapFocused ? active : document.body },
    { allowFocusedCanvas: mapFocused },
  );
}
