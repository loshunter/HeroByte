// ============================================================================
// MOBILE MAP-EDIT PALETTE — the dock BECOMES the palette
// ============================================================================
// Map authoring is a Mode, not a Sheet (redesign §1): it is the one activity
// where you must see the whole canvas, and a sheet big enough for the tool
// grid eats most of a 375x812 phone. So while map-edit is armed the dock is
// replaced rather than added to, and nothing else covers the map.
//
//   [ ✕ Exit ][ ⚒ Tool ▾ ][ ↶ Undo ][ ↷ Redo ][ ⨯ Cancel ]
//
// Slot five is CANCEL and not the design sketch's "More", deliberately. The
// sketch never said what More held, and M4c has one requirement a keyboard
// makes invisible: a finger cannot press Escape, and RELEASING is what
// commits. Cancel is the only control in this mode that a DM can need mid-
// gesture, so it takes the thumb slot; recentring and the walls overlay live
// in the sheet, where a tap costs an extra step nobody makes under pressure.
//
// Cancel is always enabled. Whether a drag is in flight is known inside
// MapBoard's tool hook and nowhere else, and lifting that back out to grey a
// button would cost a second cross-tree channel to save an inert tap.

import React from "react";
import type { MapEditToolbarProps } from "../../features/map-edit/mapEditTypes";

interface MobileMapEditPaletteProps {
  toolbar: MapEditToolbarProps;
  toolsOpen: boolean;
  onToggleTools: () => void;
  /** Abandon the gesture in flight (bumps MobileLayout's cancel signal). */
  onCancelDrag: () => void;
  onResetCamera: () => void;
}

export const MobileMapEditPalette: React.FC<MobileMapEditPaletteProps> = ({
  toolbar,
  toolsOpen,
  onToggleTools,
  onCancelDrag,
  onResetCamera,
}) => {
  const { isLive, busy, activeSubTool, onSelectSubTool } = toolbar;

  // THE trap this mode carries: the controller no-ops SILENTLY without an
  // active live document, so a tool that looks armed does nothing and says
  // nothing. Every tool stays disabled until the palette can say ● LIVE.
  const selectSubTool = (tool: "room" | "wall") => {
    onSelectSubTool(tool);
    onToggleTools();
  };

  const recenter = () => {
    onResetCamera();
    onToggleTools();
  };

  const subToolClass = (tool: string) =>
    `mobile-tool-sheet__button${activeSubTool === tool ? " mobile-tool-sheet__button--active" : ""}`;

  return (
    <>
      {toolsOpen && (
        <div
          className="mobile-tool-sheet"
          role="dialog"
          aria-label="Map tools"
          data-mobile-surface="tools"
        >
          <div className="mobile-tool-sheet__header">
            <strong>{isLive ? "● Live map" : "Map"}</strong>
            <button
              type="button"
              className="mobile-tool-sheet__close"
              onClick={onToggleTools}
              aria-label="Close tools"
            >
              ✕
            </button>
          </div>

          {!isLive ? (
            <>
              <p className="mobile-tool-sheet__note">
                Author the map on the live table. Rooms and walls appear for every player instantly.
              </p>
              <button
                type="button"
                className="mobile-tool-sheet__button mobile-tool-sheet__button--wide"
                onClick={toolbar.onStartLiveMap}
                disabled={busy}
              >
                {busy ? "Starting…" : "▶ Start live map"}
              </button>
            </>
          ) : (
            <div className="mobile-tool-sheet__grid">
              <button
                type="button"
                className={subToolClass("room")}
                onClick={() => selectSubTool("room")}
              >
                <span aria-hidden="true">🏠</span>
                Room
              </button>
              <button
                type="button"
                className={subToolClass("wall")}
                onClick={() => selectSubTool("wall")}
              >
                <span aria-hidden="true">▬</span>
                Wall
              </button>
              <button type="button" className="mobile-tool-sheet__button" onClick={recenter}>
                <span aria-hidden="true">◇</span>
                Recenter
              </button>
            </div>
          )}

          {toolbar.error && (
            <p className="mobile-tool-sheet__note" role="alert">
              {toolbar.error}
            </p>
          )}
        </div>
      )}

      <nav className="mobile-action-dock" aria-label="Map edit actions">
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
        <button type="button" className="mobile-dock-button" onClick={onCancelDrag}>
          <span className="mobile-dock-button__icon" aria-hidden="true">
            ⨯
          </span>
          Cancel
        </button>
      </nav>
    </>
  );
};
