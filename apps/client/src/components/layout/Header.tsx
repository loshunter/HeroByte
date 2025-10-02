// ============================================================================
// HEADER COMPONENT
// ============================================================================
// Top fixed panel with controls and settings
// Extracted from App.tsx to follow single responsibility principle

import React from "react";
import type { ClientMessage } from "@shared";

interface HeaderProps {
  uid: string;
  gridSize: number;
  gridLocked: boolean;
  snapToGrid: boolean;
  pointerMode: boolean;
  measureMode: boolean;
  drawMode: boolean;
  crtFilter: boolean;
  diceRollerOpen: boolean;
  rollLogOpen: boolean;
  onGridLockToggle: () => void;
  onGridSizeChange: (size: number) => void;
  onSnapToGridChange: (snap: boolean) => void;
  onPointerModeChange: (mode: boolean) => void;
  onMeasureModeChange: (mode: boolean) => void;
  onDrawModeChange: (mode: boolean) => void;
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
  crtFilter,
  diceRollerOpen,
  rollLogOpen,
  onGridLockToggle,
  onGridSizeChange,
  onSnapToGridChange,
  onPointerModeChange,
  onMeasureModeChange,
  onDrawModeChange,
  onCrtFilterChange,
  onDiceRollerToggle,
  onRollLogToggle,
  onLoadMap,
  topPanelRef,
}) => {
  return (
    <div
      ref={topPanelRef}
      className="panel"
      style={{
        position: "fixed",
        top: "28px", // Offset for status banner
        left: 0,
        right: 0,
        zIndex: 100,
        margin: 0,
        borderRadius: 0,
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
        <img
          src="/logo.webp"
          alt="HeroByte"
          style={{ height: "48px", imageRendering: "pixelated" }}
        />
      </div>

      {/* UID Display */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", gap: "8px" }}>
        <p style={{ margin: 0, fontSize: "0.7rem" }}>
          <strong>UID:</strong> {uid.substring(0, 8)}...
        </p>
      </div>

      {/* Controls and Tools */}
      <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
        {/* Grid Size */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <label htmlFor="gridSize">Grid Size:</label>
          <button
            onClick={onGridLockToggle}
            style={{
              padding: "2px 8px",
              background: "transparent",
              border: "1px solid #555",
              cursor: "pointer",
              fontSize: "1rem",
              color: gridLocked ? "#f66" : "#6c6",
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
              width: "200px",
              opacity: gridLocked ? 0.4 : 1,
              cursor: gridLocked ? "not-allowed" : "pointer",
            }}
            disabled={gridLocked}
          />
          <span style={{ color: gridLocked ? "#888" : "#dbe1ff" }}>{gridSize}px</span>
        </div>

        {/* Snap to Grid */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            id="snapToGrid"
            type="checkbox"
            checked={snapToGrid}
            onChange={(e) => onSnapToGridChange(e.target.checked)}
          />
          <label htmlFor="snapToGrid">Snap to Grid</label>
        </div>

        {/* Pointer Mode */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            id="pointerMode"
            type="checkbox"
            checked={pointerMode}
            onChange={(e) => onPointerModeChange(e.target.checked)}
          />
          <label htmlFor="pointerMode">Pointer Mode 👆</label>
        </div>

        {/* Measure Mode */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            id="measureMode"
            type="checkbox"
            checked={measureMode}
            onChange={(e) => onMeasureModeChange(e.target.checked)}
          />
          <label htmlFor="measureMode">Measure Distance 📏</label>
        </div>

        {/* Draw Mode */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            id="drawMode"
            type="checkbox"
            checked={drawMode}
            onChange={(e) => onDrawModeChange(e.target.checked)}
          />
          <label htmlFor="drawMode">Draw ✏️</label>
        </div>

        {/* CRT Filter */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            id="crtFilter"
            type="checkbox"
            checked={crtFilter}
            onChange={(e) => onCrtFilterChange(e.target.checked)}
          />
          <label htmlFor="crtFilter">CRT Filter 📺</label>
        </div>

        {/* Dice Roller */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            id="diceRoller"
            type="checkbox"
            checked={diceRollerOpen}
            onChange={(e) => onDiceRollerToggle(e.target.checked)}
          />
          <label htmlFor="diceRoller">Dice Roller ⚂</label>
        </div>

        {/* Roll Log */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            id="rollLog"
            type="checkbox"
            checked={rollLogOpen}
            onChange={(e) => onRollLogToggle(e.target.checked)}
          />
          <label htmlFor="rollLog">Roll Log 📜</label>
        </div>

        {/* Load Map */}
        <div>
          <button onClick={onLoadMap} className="btn btn-primary">
            Load Map
          </button>
        </div>
      </div>
    </div>
  );
};
