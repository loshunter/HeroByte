// ============================================================================
// MOBILE MAP-EDIT DOCK — the five slots that replace the player dock
// ============================================================================
// Split out of MobileMapEditPalette ahead of M5, which adds five tools and
// their sub-panels to the sheet; the two halves cannot share one file under the
// 348-line cap. Behaviour is unchanged — this is the same markup, moved.
//
//   [ ✕ Exit ][ ⚒ Tool ▾ ][ ↶ Undo ][ ↷ Redo ][ ⨯ Abort ]
//
// Slot five is ABORT and not the design sketch's "More", deliberately. The
// sketch never said what More held, and M4c has one requirement a keyboard
// makes invisible: a finger cannot press Escape, and RELEASING is what commits.
// Abort is the only control in this mode that a DM can need mid-gesture, so it
// takes the thumb slot; recentring and the walls overlay live in the sheet,
// where a tap costs an extra step nobody makes under pressure.
//
// Abort is always enabled. Whether a drag is in flight is known inside
// MapBoard's tool hook and nowhere else, and lifting that back out to grey a
// button would cost a second cross-tree channel to save an inert tap.
//
// It takes the WHOLE toolbar bag rather than the four fields it reads. A subset
// is how a forwarding prop goes missing with a green typecheck — the shape that
// removed Map Studio from both layouts in M4b.

import React from "react";
import type { MapEditToolbarProps } from "../../features/map-edit/mapEditTypes";

interface MobileMapEditDockProps {
  toolbar: MapEditToolbarProps;
  toolsOpen: boolean;
  onToggleTools: () => void;
  /** Abandon the gesture in flight (bumps MobileLayout's cancel signal). */
  onCancelDrag: () => void;
}

export const MobileMapEditDock: React.FC<MobileMapEditDockProps> = ({
  toolbar,
  toolsOpen,
  onToggleTools,
  onCancelDrag,
}) => {
  const { isLive } = toolbar;

  return (
    <nav className="mobile-action-dock" aria-label="Map edit actions">
      {/* The in-flight window, on the surface that needs it most: a phone DM
          authors over a real round trip, and a gesture finished inside one is
          dropped (useMapEditTool's mouse-up gate). The toast says so after the
          fact; this is what lets the rhythm be learned instead.

          Absolutely positioned, which is load-bearing rather than cosmetic:
          the dock is `grid-template-columns: repeat(5, minmax(0, 1fr))`, a
          sixth IN-FLOW child takes a column and overlaps rather than wraps,
          and a ::after on a grid container is itself a grid item. Out of flow
          is what keeps the five slots — and the test that pins them — intact.

          No role="status" and no aria-live, on purpose. There is no
          visually-hidden utility here, and a live region that fires on every
          command — a few hundred milliseconds apart while authoring — would
          narrate a screen reader into uselessness. The event actually worth
          announcing already speaks: the dropped-gesture toast, which fires
          only when something was LOST. This is ambient, and reads as ordinary
          text to anyone browsing the dock. */}
      {toolbar.saving && <span className="mobile-dock-saving">Saving…</span>}
      <button type="button" className="mobile-dock-button" onClick={toolbar.onClose}>
        <span className="mobile-dock-button__icon" aria-hidden="true">
          ✕
        </span>
        Exit
      </button>
      <button
        type="button"
        className={`mobile-dock-button${toolsOpen ? " mobile-dock-button--active" : ""}`}
        onClick={onToggleTools}
        aria-expanded={toolsOpen}
      >
        <span className="mobile-dock-button__icon" aria-hidden="true">
          ⚒
        </span>
        Tool
      </button>
      <button
        type="button"
        className="mobile-dock-button"
        onClick={toolbar.onUndo}
        disabled={!isLive || !toolbar.canUndo}
      >
        <span className="mobile-dock-button__icon" aria-hidden="true">
          ↶
        </span>
        Undo
      </button>
      <button
        type="button"
        className="mobile-dock-button"
        onClick={toolbar.onRedo}
        disabled={!isLive || !toolbar.canRedo}
      >
        <span className="mobile-dock-button__icon" aria-hidden="true">
          ↷
        </span>
        Redo
      </button>
      {/* "Abort", not "Cancel", and the reason is measured rather than
          stylistic: at the 11px readability floor "Cancel" renders 67px in a
          59px content box on a 375px phone and is CLIPPED — no padding can
          fix it, and a single word has no break opportunity to wrap on.
          Five characters is the real constraint every other dock label in
          the app already happens to respect. */}
      {/* onPointerDown, not just onClick, and this is the whole reason the
          control works at all. The gesture it exists for is "my finger is
          down on the canvas and I want out", which needs a SECOND touch —
          and Chromium generates no compat click for a second finger during
          an active multi-touch sequence. Measured on the real gesture: the
          button received pointerdown, touchstart and touchend, and no click
          at all, so an onClick-only abort silently did nothing and the
          release committed the room anyway.

          onClick stays for the keyboard, which fires click and no pointer
          event. Both firing on a mouse press is harmless: cancelling twice
          clears an already-cleared drag. */}
      <button
        type="button"
        className="mobile-dock-button"
        onPointerDown={onCancelDrag}
        onClick={onCancelDrag}
      >
        <span className="mobile-dock-button__icon" aria-hidden="true">
          ⨯
        </span>
        Abort
      </button>
    </nav>
  );
};
