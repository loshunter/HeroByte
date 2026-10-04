import { activatePanelLauncher } from "../../features/interaction/useExplicitDismissal";
// ============================================================================
// HEADER COMPONENT
// ============================================================================
// Top fixed panel with controls and settings
// Extracted from App.tsx to follow single responsibility principle

import React from "react";
import "./Header.css";
import { PING_TITLE, RESET_VIEW_TITLE } from "./viewWords";
import { JRPGPanel, JRPGButton } from "../ui/JRPGPanel";
import { HelpMenuButton } from "../../features/help/HelpMenuButton";
import { TableMenu } from "../../features/table/TableMenu";
import type { TableMenuProps } from "../../features/table/tableMenuProps";
import { PublicTableNotice } from "../../features/rooms/PublicTableNotice";

export type ToolMode =
  | "pointer"
  | "measure"
  | "draw"
  | "transform"
  | "select"
  | "align"
  // One-shot atlas-link placement aim (armed from the Atlas tab, no Header
  // button — the alignment precedent).
  | "atlas-link"
  | "map-edit"
  | null;

interface HeaderProps {
  /**
   * The table's own corner (U9): its name, your role, the connection, and the
   * menu behind them (role, Preferences, the DM's way to Table settings). One
   * REQUIRED object, the same one the phone's Table screen reads.
   */
  table: TableMenuProps;
  snapToGrid: boolean;
  activeTool: ToolMode;
  diceRollerOpen: boolean;
  rollLogOpen: boolean;
  /** Player lens (P4): the DM's view rendered as players receive it. */
  playerLens?: boolean;
  onPlayerLensChange?: (enabled: boolean) => void;
  onSnapToGridChange: (snap: boolean) => void;
  onToolSelect: (mode: ToolMode) => void;
  onDiceRollerToggle: (open: boolean) => void;
  onRollLogToggle: (open: boolean) => void;
  topPanelRef?: React.RefObject<HTMLDivElement>;
  onResetCamera: () => void;
}

/**
 * Header component with logo, controls, and tool toggles
 */
export const Header: React.FC<HeaderProps> = ({
  table,
  snapToGrid,
  activeTool,
  diceRollerOpen,
  rollLogOpen,
  playerLens = false,
  onPlayerLensChange,
  onSnapToGridChange,
  onToolSelect,
  onDiceRollerToggle,
  onRollLogToggle,
  topPanelRef,
  onResetCamera,
}) => {
  const { isDM } = table;
  const pointerMode = activeTool === "pointer";
  const measureMode = activeTool === "measure";
  const drawMode = activeTool === "draw";
  const transformMode = activeTool === "transform";
  const selectMode = activeTool === "select";
  const mapEditMode = activeTool === "map-edit";

  return (
    <div
      ref={topPanelRef}
      // What hangs below the header reads it: a window with no place of its own opens under
      // the lowest control inside this root (DraggableWindow, headerPlacement), and the Table
      // menu hangs from this frame's bottom edge. Keep the marker on the fixed root.
      data-header-root=""
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        margin: 0,
      }}
    >
      <JRPGPanel variant="bevel" style={{ padding: "6px 10px", borderRadius: 0 }}>
        {/* The public table's warning is a ROW of the header now, in its flow: it
            was a fixed chip over the header's own band, and its width decided
            which buttons could still be clicked. */}
        {table.isPublicTable ? <PublicTableNotice variant="chip" /> : null}
        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* Left side: Logo and the Table button packed tightly */}
          <JRPGPanel
            variant="simple"
            style={{
              padding: "6px 10px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              minWidth: "180px",
            }}
          >
            {/* The WIDE mark here, not the square one. Both now contain the
                same wordmark, but the square letterboxes it — at 32px tall that
                would leave the lettering about 16px high. The 3:1 version fills
                the same height with legible type in ~96px of width. */}
            <img
              src="/logo-wide.webp"
              alt="HeroByte"
              className="jrpg-pixelated"
              style={{ height: "32px", mixBlendMode: "screen" }}
            />
            <TableMenu menu={table} />
          </JRPGPanel>

          {/* Right side: Controls and Tools */}
          <JRPGPanel
            variant="simple"
            style={{ padding: "6px 10px", flex: 1, display: "flex", alignItems: "center" }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <div role="group" aria-label="Play tools" className="header-control-group">
                <span className="header-control-group__label">Play tools</span>
                <JRPGButton
                  onClick={() => onToolSelect(null)}
                  variant={activeTool === null ? "primary" : "default"}
                  aria-pressed={activeTool === null}
                  style={{ fontSize: "8px", padding: "4px 10px" }}
                  title="Move tokens and pan the map"
                >
                  ✥ Move
                </JRPGButton>
                {/* Pointer Mode */}
                <JRPGButton
                  onClick={() => onToolSelect(pointerMode ? null : "pointer")}
                  variant={pointerMode ? "primary" : "default"}
                  aria-pressed={pointerMode}
                  style={{ fontSize: "8px", padding: "4px 10px" }}
                  title={PING_TITLE}
                >
                  👆 Ping
                </JRPGButton>

                {/* Measure Mode */}
                <JRPGButton
                  onClick={() => onToolSelect(measureMode ? null : "measure")}
                  variant={measureMode ? "primary" : "default"}
                  aria-pressed={measureMode}
                  style={{ fontSize: "8px", padding: "4px 10px" }}
                  title="Measure distances on the grid"
                >
                  📏 Measure
                </JRPGButton>

                {/* Drawing Toolbar Toggle */}
                <JRPGButton
                  onClick={() => onToolSelect(drawMode ? null : "draw")}
                  variant={drawMode ? "primary" : "default"}
                  aria-pressed={drawMode}
                  style={{ fontSize: "8px", padding: "4px 10px" }}
                  title="Open drawing tools menu"
                >
                  ✏️ Draw
                </JRPGButton>

                {/* Transform Mode */}
                <JRPGButton
                  onClick={() => onToolSelect(transformMode ? null : "transform")}
                  variant={transformMode ? "primary" : "default"}
                  aria-pressed={transformMode}
                  style={{ fontSize: "8px", padding: "4px 10px" }}
                  title="Scale and rotate objects"
                >
                  🔄 Transform
                </JRPGButton>

                {/* Select Mode */}
                <JRPGButton
                  onClick={() => onToolSelect(selectMode ? null : "select")}
                  variant={selectMode ? "primary" : "default"}
                  aria-pressed={selectMode}
                  style={{ fontSize: "8px", padding: "4px 10px" }}
                  title="Select multiple objects"
                >
                  🖱️ Select
                </JRPGButton>

                {/* Snap to Grid */}
                <JRPGButton
                  onClick={() => onSnapToGridChange(!snapToGrid)}
                  variant={snapToGrid ? "primary" : "default"}
                  aria-pressed={snapToGrid}
                  style={{ fontSize: "8px", padding: "4px 10px" }}
                  title="Toggle snap-to-grid for tokens and measurements"
                >
                  Snap
                </JRPGButton>

                {/* Viewport Controls */}
                <JRPGButton
                  onClick={onResetCamera}
                  variant="default"
                  style={{ fontSize: "8px", padding: "4px 10px" }}
                  title={RESET_VIEW_TITLE}
                  aria-label="Reset view"
                >
                  🧭 Reset
                </JRPGButton>

                {isDM && (
                  <JRPGButton
                    onClick={() => onToolSelect(mapEditMode ? null : "map-edit")}
                    variant={mapEditMode ? "primary" : "default"}
                    aria-pressed={mapEditMode}
                    style={{ fontSize: "8px", padding: "4px 10px" }}
                    title="Author the live map on the table"
                  >
                    🏗️ Build map
                  </JRPGButton>
                )}
              </div>
              <div role="group" aria-label="Panels & settings" className="header-control-group">
                <span className="header-control-group__label">Panels &amp; settings</span>
                {/* Player lens (P4): render the DM's own table exactly as
                  players receive it — fog on, secret doors hidden, DM
                  overlays off. A VIEW toggle only; DM powers stay live. */}
                {isDM && onPlayerLensChange && (
                  <JRPGButton
                    onClick={() => onPlayerLensChange(!playerLens)}
                    variant={playerLens ? "primary" : "default"}
                    aria-pressed={playerLens}
                    style={{ fontSize: "8px", padding: "4px 10px" }}
                    title="See the table exactly as players do (fog, secret doors, no DM overlays)"
                  >
                    👁 Player View
                  </JRPGButton>
                )}
                {/* Dice Roller */}
                <JRPGButton
                  onClick={() => onDiceRollerToggle(!diceRollerOpen)}
                  variant={diceRollerOpen ? "primary" : "default"}
                  aria-pressed={diceRollerOpen}
                  style={{ fontSize: "8px", padding: "4px 10px" }}
                  title="Open 3D dice roller"
                >
                  ⚂ Dice
                </JRPGButton>

                {/* Roll Log */}
                <JRPGButton
                  onClick={(event) =>
                    activatePanelLauncher(event, () => onRollLogToggle(!rollLogOpen))
                  }
                  variant={rollLogOpen ? "primary" : "default"}
                  aria-pressed={rollLogOpen}
                  style={{ fontSize: "8px", padding: "4px 10px" }}
                  title="Open table chat and dice roll history"
                >
                  📜 Chat &amp; Rolls
                </JRPGButton>

                {/* The manual. Last in the row so it reads as "and if you're
                  stuck, here" rather than competing with the tools. */}
                <HelpMenuButton />
              </div>
            </div>
          </JRPGPanel>
        </div>
      </JRPGPanel>
    </div>
  );
};
