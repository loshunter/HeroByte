// ============================================================================
// HEADER COMPONENT
// ============================================================================
// Top fixed panel with controls and settings
// Extracted from App.tsx to follow single responsibility principle

import React from "react";
import { JRPGPanel, JRPGButton } from "../ui/JRPGPanel";

export type ToolMode = "pointer" | "measure" | "draw" | "transform" | "select" | "align" | null;

interface HeaderProps {
  uid: string;
  snapToGrid: boolean;
  activeTool: ToolMode;
  crtFilter: boolean;
  diceRollerOpen: boolean;
  rollLogOpen: boolean;
  onSnapToGridChange: (snap: boolean) => void;
  onToolSelect: (mode: ToolMode) => void;
  onCrtFilterChange: (enabled: boolean) => void;
  onDiceRollerToggle: (open: boolean) => void;
  onRollLogToggle: (open: boolean) => void;
  topPanelRef?: React.RefObject<HTMLDivElement>;
  onResetCamera: () => void;
}

/**
 * Header component with logo, controls, and tool toggles
 */
export const Header: React.FC<HeaderProps> = ({
  uid,
  snapToGrid,
  activeTool,
  crtFilter,
  diceRollerOpen,
  rollLogOpen,
  onSnapToGridChange,
  onToolSelect,
  onCrtFilterChange,
  onDiceRollerToggle,
  onRollLogToggle,
  topPanelRef,
  onResetCamera,
}) => {
  const pointerMode = activeTool === "pointer";
  const measureMode = activeTool === "measure";
  const drawMode = activeTool === "draw";
  const transformMode = activeTool === "transform";
  const selectMode = activeTool === "select";

  return (
    <div
      ref={topPanelRef}
      style={{
        position: "fixed",
        top: "24px", // Offset for status banner
        left: 0,
        right: 0,
        zIndex: 100,
        margin: 0,
      }}
    >
      <JRPGPanel variant="bevel" style={{ padding: "6px 10px", borderRadius: 0 }}>
        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* Left side: Logo and UID packed tightly */}
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
            <img
              src="/logo.webp"
              alt="HeroByte"
              className="jrpg-pixelated"
              style={{ height: "32px" }}
            />
            <div style={{ textAlign: "left" }}>
              <p className="jrpg-text-small" style={{ margin: 0, color: "var(--jrpg-white)" }}>
                <strong style={{ color: "var(--jrpg-gold)" }}>UID</strong> {uid.substring(0, 8)}...
              </p>
            </div>
          </JRPGPanel>

          {/* Right side: Controls and Tools */}
          <JRPGPanel
            variant="simple"
            style={{ padding: "6px 10px", flex: 1, display: "flex", alignItems: "center" }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              {/* Snap to Grid */}
              <JRPGButton
                onClick={() => onSnapToGridChange(!snapToGrid)}
                variant={snapToGrid ? "primary" : "default"}
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
                title="Reset camera to center of map"
              >
                🧭 Recenter
              </JRPGButton>

              {/* Pointer Mode */}
              <JRPGButton
                onClick={() => onToolSelect(pointerMode ? null : "pointer")}
                variant={pointerMode ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "4px 10px" }}
                title="Point at locations on the map (visible to others)"
              >
                👆 Pointer
              </JRPGButton>

              {/* Measure Mode */}
              <JRPGButton
                onClick={() => onToolSelect(measureMode ? null : "measure")}
                variant={measureMode ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "4px 10px" }}
                title="Measure distances on the grid"
              >
                📏 Measure
              </JRPGButton>

              {/* Drawing Toolbar Toggle */}
              <JRPGButton
                onClick={() => onToolSelect(drawMode ? null : "draw")}
                variant={drawMode ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "4px 10px" }}
                title="Open drawing tools menu"
              >
                ✏️ Draw Tools
              </JRPGButton>

              {/* Transform Mode */}
              <JRPGButton
                onClick={() => onToolSelect(transformMode ? null : "transform")}
                variant={transformMode ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "4px 10px" }}
                title="Scale and rotate objects"
              >
                🔄 Transform
              </JRPGButton>

              {/* Select Mode */}
              <JRPGButton
                onClick={() => onToolSelect(selectMode ? null : "select")}
                variant={selectMode ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "4px 10px" }}
                title="Select multiple objects"
              >
                🖱️ Select
              </JRPGButton>

              {/* CRT Filter */}
              <JRPGButton
                onClick={() => onCrtFilterChange(!crtFilter)}
                variant={crtFilter ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "4px 10px" }}
                title="Toggle retro CRT visual effect"
              >
                📺 CRT
              </JRPGButton>

              {/* Dice Roller */}
              <JRPGButton
                onClick={() => onDiceRollerToggle(!diceRollerOpen)}
                variant={diceRollerOpen ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "4px 10px" }}
                title="Open 3D dice roller"
              >
                ⚂ Dice
              </JRPGButton>

              {/* Roll Log */}
              <JRPGButton
                onClick={() => onRollLogToggle(!rollLogOpen)}
                variant={rollLogOpen ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "4px 10px" }}
                title="View dice roll history"
              >
                📜 Log
              </JRPGButton>
            </div>
          </JRPGPanel>
        </div>
      </JRPGPanel>
    </div>
  );
};
