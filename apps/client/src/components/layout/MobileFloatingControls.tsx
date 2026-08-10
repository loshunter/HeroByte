// ============================================================================
// MOBILE FLOATING CONTROLS
// ============================================================================
// Bottom action dock and tool sheet for mobile layout. Which surface is open
// is useMobileSurface's call, not this component's — every button here just
// reports the surface it stands for, and the machine arbitrates.

import React from "react";
import type { ToolMode } from "./Header";
import type { MobileSurface } from "../../hooks/useMobileSurface";

interface MobileFloatingControlsProps {
  surface: MobileSurface;
  onToggleSurface: (surface: Exclude<MobileSurface, "none">) => void;
  onToolSelect: (mode: ToolMode) => void;
  onSnapToGridChange: (snap: boolean) => void;
  onResetCamera: () => void;
  activeTool: ToolMode;
  snapToGrid: boolean;
  /** Slot five is contextual: `DM` for a DM, `View` (reset camera) otherwise. */
  isDM: boolean;
}

export const MobileFloatingControls: React.FC<MobileFloatingControlsProps> = ({
  surface,
  onToggleSurface,
  onToolSelect,
  onSnapToGridChange,
  onResetCamera,
  activeTool,
  snapToGrid,
  isDM,
}) => {
  const toolsOpen = surface === "tools";

  // Recenter lives in the sheet so a DM — whose dock slot five is `DM`, not
  // `View` — still has reset-camera. Closing the sheet on tap is the point:
  // you recenter to SEE the map.
  const recenter = () => {
    onResetCamera();
    onToggleSurface("tools");
  };

  // The sheet only renders while the tools surface is open, so toggling from
  // here always closes it.
  const selectTool = (tool: ToolMode) => {
    onToolSelect(tool);
    onToggleSurface("tools");
  };

  const toolButtonClass = (tool: ToolMode) =>
    `mobile-tool-sheet__button${activeTool === tool ? " mobile-tool-sheet__button--active" : ""}`;

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
            <strong>Tools</strong>
            <button
              type="button"
              className="mobile-tool-sheet__close"
              onClick={() => onToggleSurface("tools")}
              aria-label="Close tools"
            >
              ✕
            </button>
          </div>
          <div className="mobile-tool-sheet__grid">
            <button
              type="button"
              className={toolButtonClass(null)}
              onClick={() => selectTool(null)}
            >
              <span aria-hidden="true">✥</span>
              Move
            </button>
            <button
              type="button"
              className={toolButtonClass("pointer")}
              onClick={() => selectTool(activeTool === "pointer" ? null : "pointer")}
            >
              <span aria-hidden="true">⌖</span>
              Ping
            </button>
            <button
              type="button"
              className={toolButtonClass("measure")}
              onClick={() => selectTool(activeTool === "measure" ? null : "measure")}
            >
              <span aria-hidden="true">↔</span>
              Measure
            </button>
            <button
              type="button"
              className={toolButtonClass("draw")}
              onClick={() => selectTool(activeTool === "draw" ? null : "draw")}
            >
              <span aria-hidden="true">✎</span>
              Draw
            </button>
            <button
              type="button"
              className={toolButtonClass("transform")}
              onClick={() => selectTool(activeTool === "transform" ? null : "transform")}
            >
              <span aria-hidden="true">⤢</span>
              Transform
            </button>
            <button
              type="button"
              className={toolButtonClass("select")}
              onClick={() => selectTool(activeTool === "select" ? null : "select")}
            >
              <span aria-hidden="true">□</span>
              Select
            </button>
            <button
              type="button"
              className={`mobile-tool-sheet__button${
                snapToGrid ? " mobile-tool-sheet__button--active" : ""
              }`}
              onClick={() => onSnapToGridChange(!snapToGrid)}
            >
              <span aria-hidden="true">#</span>
              Snap
            </button>
            <button type="button" className="mobile-tool-sheet__button" onClick={recenter}>
              <span aria-hidden="true">◇</span>
              Recenter
            </button>
            <button
              type="button"
              className="mobile-tool-sheet__button"
              onClick={() => onToggleSurface("help")}
            >
              <span aria-hidden="true">?</span>
              Help
            </button>
          </div>
        </div>
      )}

      <nav className="mobile-action-dock" aria-label="Mobile actions">
        <button
          type="button"
          className="mobile-dock-button"
          onClick={() => onToggleSurface("party")}
        >
          <span className="mobile-dock-button__icon" aria-hidden="true">
            ◉
          </span>
          Party
        </button>
        <button
          type="button"
          className={`mobile-dock-button${
            toolsOpen || activeTool ? " mobile-dock-button--active" : ""
          }`}
          onClick={() => onToggleSurface("tools")}
          aria-expanded={toolsOpen}
        >
          <span className="mobile-dock-button__icon" aria-hidden="true">
            ⚒
          </span>
          Tools
        </button>
        <button
          type="button"
          className={`mobile-dock-button${surface === "dice" ? " mobile-dock-button--active" : ""}`}
          onClick={() => onToggleSurface("dice")}
          aria-pressed={surface === "dice"}
        >
          <span className="mobile-dock-button__icon" aria-hidden="true">
            ⚂
          </span>
          Dice
        </button>
        <button
          type="button"
          className={`mobile-dock-button${surface === "log" ? " mobile-dock-button--active" : ""}`}
          onClick={() => onToggleSurface("log")}
          aria-pressed={surface === "log"}
        >
          <span className="mobile-dock-button__icon" aria-hidden="true">
            ≡
          </span>
          Log
        </button>
        {isDM ? (
          // Slot five, not slot six: the dock is a hardcoded 5-column grid and
          // a sixth child overlaps rather than wraps (settled, handoff §9).
          <button
            type="button"
            className={`mobile-dock-button${surface === "dm" ? " mobile-dock-button--active" : ""}`}
            onClick={() => onToggleSurface("dm")}
            aria-pressed={surface === "dm"}
          >
            <span className="mobile-dock-button__icon" aria-hidden="true">
              ♛
            </span>
            DM
          </button>
        ) : (
          <button type="button" className="mobile-dock-button" onClick={onResetCamera}>
            <span className="mobile-dock-button__icon" aria-hidden="true">
              ◇
            </span>
            View
          </button>
        )}
      </nav>
    </>
  );
};
