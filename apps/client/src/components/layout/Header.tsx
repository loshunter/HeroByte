// ============================================================================
// HEADER COMPONENT
// ============================================================================
// Top fixed panel with controls and settings
// Extracted from App.tsx to follow single responsibility principle

import React from "react";
import { JRPGPanel, JRPGButton } from "../ui/JRPGPanel";

interface HeaderProps {
  uid: string;
  gridSize: number;
  gridLocked: boolean;
  snapToGrid: boolean;
  pointerMode: boolean;
  measureMode: boolean;
  drawMode: boolean;
  selectMode?: boolean;
  crtFilter: boolean;
  diceRollerOpen: boolean;
  rollLogOpen: boolean;
  onGridLockToggle: () => void;
  onGridSizeChange: (size: number) => void;
  onSnapToGridChange: (snap: boolean) => void;
  onPointerModeChange: (mode: boolean) => void;
  onMeasureModeChange: (mode: boolean) => void;
  onDrawModeChange: (mode: boolean) => void;
  onSelectModeChange?: (mode: boolean) => void;
  onCrtFilterChange: (enabled: boolean) => void;
  onDiceRollerToggle: (open: boolean) => void;
  onRollLogToggle: (open: boolean) => void;
  onLoadMap: () => void;
  topPanelRef?: React.RefObject<HTMLDivElement>;
}

/**
 * Header component with logo, controls, and tool toggles
 */
export const Header: React.FC<HeaderProps> = ({
  uid,
  gridSize,
  gridLocked,
  snapToGrid,
  pointerMode,
  measureMode,
  drawMode,
  selectMode,
  crtFilter,
  diceRollerOpen,
  rollLogOpen,
  onGridLockToggle,
  onGridSizeChange,
  onSnapToGridChange,
  onPointerModeChange,
  onMeasureModeChange,
  onDrawModeChange,
  onSelectModeChange,
  onCrtFilterChange,
  onDiceRollerToggle,
  onRollLogToggle,
  onLoadMap,
  topPanelRef,
}) => {
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
              {/* Grid Size */}
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <label
                  htmlFor="gridSize"
                  className="jrpg-text-small"
                  style={{ color: "var(--jrpg-gold)" }}
                >
                  Grid:
                </label>
                <button
                  onClick={onGridLockToggle}
                  style={{
                    padding: "2px 8px",
                    background: "transparent",
                    border: "1px solid var(--jrpg-border-gold)",
                    cursor: "pointer",
                    fontSize: "1rem",
                    color: gridLocked ? "var(--jrpg-hp-low)" : "var(--jrpg-hp-full)",
                  }}
                  title={gridLocked ? "Unlock grid size" : "Lock grid size"}
                >
                  {gridLocked ? "🔒" : "🔓"}
                </button>
                <input
                  id="gridSize"
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={gridSize}
                  onChange={(e) => onGridSizeChange(Number(e.target.value))}
                  style={{
                    width: "120px",
                    opacity: gridLocked ? 0.4 : 1,
                    cursor: gridLocked ? "not-allowed" : "pointer",
                  }}
                  disabled={gridLocked}
                />
                <span
                  className="jrpg-text-small"
                  style={{
                    color: gridLocked ? "var(--jrpg-white)" : "var(--jrpg-cyan)",
                    opacity: gridLocked ? 0.5 : 1,
                  }}
                >
                  {gridSize}px
                </span>
              </div>

              {/* Snap to Grid */}
              <JRPGButton
                onClick={() => onSnapToGridChange(!snapToGrid)}
                variant={snapToGrid ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "6px 12px" }}
              >
                Snap
              </JRPGButton>

              {/* Pointer Mode */}
              <JRPGButton
                onClick={() => {
                  onPointerModeChange(!pointerMode);
                  if (!pointerMode) {
                    onMeasureModeChange(false);
                    onDrawModeChange(false);
                    onSelectModeChange?.(false);
                  }
                }}
                variant={pointerMode ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "6px 12px" }}
              >
                👆 Pointer
              </JRPGButton>

              {/* Measure Mode */}
              <JRPGButton
                onClick={() => {
                  onMeasureModeChange(!measureMode);
                  if (!measureMode) {
                    onPointerModeChange(false);
                    onDrawModeChange(false);
                    onSelectModeChange?.(false);
                  }
                }}
                variant={measureMode ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "6px 12px" }}
              >
                📏 Measure
              </JRPGButton>

              {/* Draw Mode */}
              <JRPGButton
                onClick={() => {
                  onDrawModeChange(!drawMode);
                  if (!drawMode) {
                    onPointerModeChange(false);
                    onMeasureModeChange(false);
                    onSelectModeChange?.(false);
                  }
                }}
                variant={drawMode ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "6px 12px" }}
              >
                ✏️ Draw
              </JRPGButton>

              {/* Select Mode */}
              <JRPGButton
                onClick={() => {
                  onSelectModeChange?.(!selectMode);
                  if (!selectMode) {
                    onPointerModeChange(false);
                    onMeasureModeChange(false);
                    onDrawModeChange(false);
                  }
                }}
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

              {/* Load Map */}
              <JRPGButton
                onClick={onLoadMap}
                variant="success"
                style={{ fontSize: "8px", padding: "6px 12px" }}
              >
                Load Map
              </JRPGButton>
            </div>
          </JRPGPanel>
        </div>
      </JRPGPanel>
    </div>
  );
};
