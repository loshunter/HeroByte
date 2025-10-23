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
        top: "28px", // Offset for status banner
        left: 0,
        right: 0,
        zIndex: 100,
        margin: 0,
      }}
    >
      <JRPGPanel variant="bevel" style={{ padding: "8px", borderRadius: 0 }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
          {/* Left side: Logo and UID */}
          <JRPGPanel variant="simple" style={{ padding: "8px", minWidth: "200px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* Logo */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <img
                  src="/logo.webp"
                  alt="HeroByte"
                  className="jrpg-pixelated"
                  style={{ height: "40px" }}
                />
              </div>
              {/* UID Display */}
              <div style={{ textAlign: "center" }}>
                <p className="jrpg-text-small" style={{ margin: 0, color: "var(--jrpg-white)" }}>
                  <strong style={{ color: "var(--jrpg-gold)" }}>UID:</strong>
                  <br />
                  {uid.substring(0, 8)}...
                </p>
              </div>
            </div>
          </JRPGPanel>

          {/* Right side: Controls and Tools */}
          <JRPGPanel variant="simple" style={{ padding: "8px", flex: 1 }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              {/* Snap to Grid */}
              <JRPGButton
                onClick={() => onSnapToGridChange(!snapToGrid)}
                variant={snapToGrid ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "6px 12px" }}
              >
                Snap
              </JRPGButton>

              {/* Viewport Controls */}
              <JRPGButton
                onClick={onResetCamera}
                variant="default"
                style={{ fontSize: "8px", padding: "6px 12px" }}
              >
                🧭 Recenter
              </JRPGButton>

              {/* Pointer Mode */}
              <JRPGButton
                onClick={() => onToolSelect(pointerMode ? null : "pointer")}
                variant={pointerMode ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "6px 12px" }}
              >
                👆 Pointer
              </JRPGButton>

              {/* Measure Mode */}
              <JRPGButton
                onClick={() => onToolSelect(measureMode ? null : "measure")}
                variant={measureMode ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "6px 12px" }}
              >
                📏 Measure
              </JRPGButton>

              {/* Drawing Toolbar Toggle */}
              <JRPGButton
                onClick={() => onToolSelect(drawMode ? null : "draw")}
                variant={drawMode ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "6px 12px" }}
              >
                ✏️ Draw Tools
              </JRPGButton>

              {/* Transform Mode */}
              <JRPGButton
                onClick={() => onToolSelect(transformMode ? null : "transform")}
                variant={transformMode ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "6px 12px" }}
                title="Scale and rotate objects"
              >
                🔄 Transform
              </JRPGButton>

              {/* Select Mode */}
              <JRPGButton
                onClick={() => onToolSelect(selectMode ? null : "select")}
                variant={selectMode ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "6px 12px" }}
              >
                🖱️ Select
              </JRPGButton>

              {/* CRT Filter */}
              <JRPGButton
                onClick={() => onCrtFilterChange(!crtFilter)}
                variant={crtFilter ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "6px 12px" }}
              >
                📺 CRT
              </JRPGButton>

              {/* Dice Roller */}
              <JRPGButton
                onClick={() => onDiceRollerToggle(!diceRollerOpen)}
                variant={diceRollerOpen ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "6px 12px" }}
              >
                ⚂ Dice
              </JRPGButton>

              {/* Roll Log */}
              <JRPGButton
                onClick={() => onRollLogToggle(!rollLogOpen)}
                variant={rollLogOpen ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "6px 12px" }}
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
