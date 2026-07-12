// ============================================================================
// MOBILE FLOATING CONTROLS
// ============================================================================
// Bottom action dock and tool sheet for mobile layout.

import React from "react";
import type { ToolMode } from "./Header";

interface MobileFloatingControlsProps {
  onShowEntities: () => void;
  onToggleDiceRoller: () => void;
  onToggleRollLog: () => void;
  onToolSelect: (mode: ToolMode) => void;
  onSnapToGridChange: (snap: boolean) => void;
  onResetCamera: () => void;
  activeTool: ToolMode;
  snapToGrid: boolean;
  diceRollerOpen: boolean;
  rollLogOpen: boolean;
  /** Tool sheet open state is owned by MobileLayout for single-sheet arbitration. */
  toolsOpen: boolean;
  onToggleTools: () => void;
}

export const MobileFloatingControls: React.FC<MobileFloatingControlsProps> = ({
  onShowEntities,
  onToggleDiceRoller,
  onToggleRollLog,
  onToolSelect,
  onSnapToGridChange,
  onResetCamera,
  activeTool,
  snapToGrid,
  diceRollerOpen,
  rollLogOpen,
  toolsOpen,
  onToggleTools,
}) => {
  // The sheet only renders when toolsOpen, so toggling from here always closes it.
  const selectTool = (tool: ToolMode) => {
    onToolSelect(tool);
    onToggleTools();
  };

  const toolButtonClass = (tool: ToolMode) =>
    `mobile-tool-sheet__button${activeTool === tool ? " mobile-tool-sheet__button--active" : ""}`;

  return (
    <>
      {toolsOpen && (
        <div className="mobile-tool-sheet" role="dialog" aria-label="Map tools">
          <div className="mobile-tool-sheet__header">
            <strong>Tools</strong>
            <button
              type="button"
              className="mobile-tool-sheet__close"
              onClick={onToggleTools}
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
          </div>
        </div>
      )}

      <nav className="mobile-action-dock" aria-label="Mobile actions">
        <button type="button" className="mobile-dock-button" onClick={onShowEntities}>
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
          onClick={onToggleTools}
          aria-expanded={toolsOpen}
        >
          <span className="mobile-dock-button__icon" aria-hidden="true">
            ⚒
          </span>
          Tools
        </button>
        <button
          type="button"
          className={`mobile-dock-button${diceRollerOpen ? " mobile-dock-button--active" : ""}`}
          onClick={onToggleDiceRoller}
          aria-pressed={diceRollerOpen}
        >
          <span className="mobile-dock-button__icon" aria-hidden="true">
            ⚂
          </span>
          Dice
        </button>
        <button
          type="button"
          className={`mobile-dock-button${rollLogOpen ? " mobile-dock-button--active" : ""}`}
          onClick={onToggleRollLog}
          aria-pressed={rollLogOpen}
        >
          <span className="mobile-dock-button__icon" aria-hidden="true">
            ≡
          </span>
          Log
        </button>
        <button type="button" className="mobile-dock-button" onClick={onResetCamera}>
          <span className="mobile-dock-button__icon" aria-hidden="true">
            ◇
          </span>
          View
        </button>
      </nav>
    </>
  );
};
