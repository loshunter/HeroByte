// ============================================================================
// MOBILE FLOATING CONTROLS
// ============================================================================
// Bottom action dock and tool sheet for mobile layout.

import React, { useState } from "react";
import type { ToolMode } from "./Header";
import { HelpPanel } from "../../features/help/HelpPanel";

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
  // Help state is owned HERE rather than by MobileLayout, which sits at 347 of
  // the 348-line ceiling, so lifting it would cost an extraction.
  //
  // The original comment here claimed the manual "arbitrates with nothing".
  // That was wrong: .mobile-help-sheet shares the shared sheet rule block with
  // the tool, selection, drawing and roll-log sheets — same bottom anchor, same
  // z-index — so it stacked with them instead of replacing them. Tapping Tools
  // with the manual open mounted the tool sheet UNDERNEATH it, and a hit test in
  // the tool sheet's own area landed on the help panel, so Tools looked broken.
  const [helpOpen, setHelpOpen] = useState(false);

  // Every dock button that opens a sheet also dismisses the manual, which is
  // what MobileLayout's closeAllSheets does for the sheets it owns. Help cannot
  // simply join that list, hence this.
  const closingHelp = (action: () => void) => () => {
    setHelpOpen(false);
    action();
  };

  // The sheet only renders when toolsOpen, so toggling from here always closes it.
  const selectTool = (tool: ToolMode) => {
    onToolSelect(tool);
    onToggleTools();
  };

  const openHelp = () => {
    onToggleTools();
    setHelpOpen(true);
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
            <button type="button" className="mobile-tool-sheet__button" onClick={openHelp}>
              <span aria-hidden="true">?</span>
              Help
            </button>
          </div>
        </div>
      )}

      {helpOpen && (
        <div className="mobile-help-sheet" role="dialog" aria-label="HeroByte help">
          <div className="mobile-tool-sheet__header">
            <strong>Help</strong>
            <button
              type="button"
              className="mobile-tool-sheet__close"
              onClick={() => setHelpOpen(false)}
              aria-label="Close help"
            >
              ✕
            </button>
          </div>
          <HelpPanel />
        </div>
      )}

      <nav className="mobile-action-dock" aria-label="Mobile actions">
        <button type="button" className="mobile-dock-button" onClick={closingHelp(onShowEntities)}>
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
          onClick={closingHelp(onToggleTools)}
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
          onClick={closingHelp(onToggleDiceRoller)}
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
          onClick={closingHelp(onToggleRollLog)}
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
