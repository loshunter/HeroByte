// ============================================================================
// MOBILE FLOATING CONTROLS
// ============================================================================
// Bottom action dock and tool sheet for mobile layout. Which surface is open
// is useMobileSurface's call, not this component's — every button here just
// reports the surface it stands for, and the machine arbitrates.

import React from "react";
import { activatePanelLauncher } from "../../features/interaction/useExplicitDismissal";
import { MobileSheet } from "../../layouts/mobile/MobileSheet";
import type { MobileWorldReturnControls } from "../../hooks/useMobileWorldReturn";
import type { ToolMode } from "./Header";
import type { MobileSurface } from "../../hooks/useMobileSurface";
import type { MapEditToolbarProps } from "../../features/map-edit/mapEditTypes";
import { MobileMapEditPalette } from "./MobileMapEditPalette";
import { PING_TITLE, RESET_VIEW_TITLE } from "./viewWords";

interface MobileFloatingControlsProps {
  surface: MobileSurface;
  worldReturn?: MobileWorldReturnControls;
  onToggleSurface: (surface: Exclude<MobileSurface, "none">) => void;
  onToolSelect: (mode: ToolMode) => void;
  onSnapToGridChange: (snap: boolean) => void;
  onResetCamera: () => void;
  activeTool: ToolMode;
  snapToGrid: boolean;
  /** Slot five is contextual: `DM` for a DM, `View` (reset camera) otherwise. */
  isDM: boolean;
  /** The table's player-props toggle — gates the Props tile in the sheet.
   *  Optional (default off) so the existing fixtures stay untouched, the
   *  same escape hatch MainLayoutProps documents. */
  playerPropsEnabled?: boolean;
  /** Map-edit armed — the dock is REPLACED by the palette (redesign §1). */
  mode: boolean;
  /** A kick is in flight (pending and not expired): the ⏳ chip floats over the dock. */
  kickPending?: boolean;
  mapEditToolbarProps: MapEditToolbarProps;
}

export const MobileFloatingControls: React.FC<MobileFloatingControlsProps> = ({
  surface,
  worldReturn,
  onToggleSurface,
  onToolSelect,
  onSnapToGridChange,
  onResetCamera,
  activeTool,
  snapToGrid,
  isDM,
  playerPropsEnabled = false,
  mode,
  kickPending = false,
  mapEditToolbarProps,
}) => {
  const toolsOpen = surface === "tools";

  // A Mode re-purposes the dock rather than stacking on it, so this is a
  // replacement and not a branch inside the nav below: five slots, all
  // different, and none of the player-facing surfaces reachable while armed.
  if (mode) {
    return (
      <MobileMapEditPalette
        toolbar={mapEditToolbarProps}
        toolsOpen={toolsOpen}
        onToggleTools={() => onToggleSurface("tools")}
        onResetCamera={onResetCamera}
      />
    );
  }

  // Reset view lives in the sheet so a DM — whose dock slot five is `DM`, not
  // `View` — still has reset-camera. Closing the sheet on tap is the point:
  // you reset the view to SEE the map.
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
        <MobileSheet
          title="Tools"
          label="Map tools"
          surface="tools"
          onClose={() => onToggleSurface("tools")}
          rootRef={worldReturn?.toolsRootRef}
        >
          <div className="mobile-tool-sheet__grid">
            <button
              type="button"
              className={toolButtonClass(null)}
              aria-pressed={activeTool === null}
              onClick={() => selectTool(null)}
            >
              <span aria-hidden="true">✥</span>
              Move
            </button>
            <button
              type="button"
              className={toolButtonClass("pointer")}
              aria-pressed={activeTool === "pointer"}
              title={PING_TITLE}
              onClick={() => selectTool(activeTool === "pointer" ? null : "pointer")}
            >
              <span aria-hidden="true">⌖</span>
              Ping
            </button>
            <button
              type="button"
              className={toolButtonClass("measure")}
              aria-pressed={activeTool === "measure"}
              onClick={() => selectTool(activeTool === "measure" ? null : "measure")}
            >
              <span aria-hidden="true">↔</span>
              Measure
            </button>
            <button
              type="button"
              className={toolButtonClass("draw")}
              aria-pressed={activeTool === "draw"}
              onClick={() => selectTool(activeTool === "draw" ? null : "draw")}
            >
              <span aria-hidden="true">✎</span>
              Draw
            </button>
            <button
              type="button"
              className={toolButtonClass("transform")}
              aria-pressed={activeTool === "transform"}
              onClick={() => selectTool(activeTool === "transform" ? null : "transform")}
            >
              <span aria-hidden="true">⤢</span>
              Transform
            </button>
            <button
              type="button"
              className={toolButtonClass("select")}
              aria-pressed={activeTool === "select"}
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
              aria-pressed={snapToGrid}
              onClick={() => onSnapToGridChange(!snapToGrid)}
            >
              <span aria-hidden="true">#</span>
              Snap
            </button>
            <button
              type="button"
              className="mobile-tool-sheet__button"
              title={RESET_VIEW_TITLE}
              onClick={recenter}
            >
              <span aria-hidden="true">◇</span>
              Reset view
            </button>
            {/* The table itself (U9): your role, your Preferences (CRT, sound and
                motion) and, for a DM, the table's settings. It has no dock slot —
                the dock is five columns — so it lives in this sheet. */}
            <button
              type="button"
              className="mobile-tool-sheet__button"
              onClick={() => onToggleSurface("table")}
            >
              <span aria-hidden="true">▤</span>
              Table
            </button>
            {/* A surface, not a tool — but it earns a tile here because this
                sheet is where players look for "things I can do to the map".
                DMs never see it; their prop editor is the DM menu's Props
                tab. Conditional, so the toggle being off costs no slot. */}
            {!isDM && playerPropsEnabled && (
              <button
                type="button"
                className="mobile-tool-sheet__button"
                onClick={() => onToggleSurface("props")}
              >
                <span aria-hidden="true">▣</span>
                Props
              </button>
            )}
            {/* The world map (A6): a surface with a tile here for the same
                reason Props has one. DMs have the Atlas tab instead. */}
            {!isDM && (
              <button
                type="button"
                className="mobile-tool-sheet__button"
                data-focus-return="world"
                onClick={() => onToggleSurface("atlas")}
              >
                <span aria-hidden="true">🗺</span>
                World
              </button>
            )}
            <button
              type="button"
              className="mobile-tool-sheet__button"
              onClick={() => onToggleSurface("help")}
            >
              <span aria-hidden="true">?</span>
              Help
            </button>
          </div>
        </MobileSheet>
      )}

      <nav className="mobile-action-dock" aria-label="Mobile actions">
        {kickPending && (
          <span className="mobile-dock-saving" data-testid="mobile-kick-pending">
            ⏳ Kicking…
          </span>
        )}
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
          ref={worldReturn?.toolsDockButtonRef}
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
          onClick={(event) => activatePanelLauncher(event, () => onToggleSurface("log"))}
          aria-pressed={surface === "log"}
        >
          <span className="mobile-dock-button__icon" aria-hidden="true">
            ≡
          </span>
          Chat
        </button>
        {isDM ? (
          // Slot five, not slot six: the dock is a hardcoded 5-column grid and
          // a sixth child overlaps rather than wraps (settled, handoff §9).
          <button
            type="button"
            className={`mobile-dock-button${surface === "dm" ? " mobile-dock-button--active" : ""}`}
            onClick={(event) => activatePanelLauncher(event, () => onToggleSurface("dm"))}
            aria-pressed={surface === "dm"}
          >
            <span className="mobile-dock-button__icon" aria-hidden="true">
              ♛
            </span>
            DM
          </button>
        ) : (
          <button
            type="button"
            className="mobile-dock-button"
            title={RESET_VIEW_TITLE}
            onClick={onResetCamera}
          >
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
