// ============================================================================
// HEADER COMPONENT
// ============================================================================
// Top fixed panel with controls and settings
// Extracted from App.tsx to follow single responsibility principle

import React from "react";
import { JRPGPanel, JRPGButton } from "../ui/JRPGPanel";

interface HeaderProps {
  uid: string;
  snapToGrid: boolean;
  pointerMode: boolean;
  measureMode: boolean;
  drawMode: boolean;
  transformMode?: boolean;
  selectMode?: boolean;
  crtFilter: boolean;
  diceRollerOpen: boolean;
  rollLogOpen: boolean;
  onSnapToGridChange: (snap: boolean) => void;
  onPointerModeChange: (mode: boolean) => void;
  onMeasureModeChange: (mode: boolean) => void;
  onDrawModeChange: (mode: boolean) => void;
  onTransformModeChange?: (mode: boolean) => void;
  onSelectModeChange?: (mode: boolean) => void;
  onCrtFilterChange: (enabled: boolean) => void;
  onDiceRollerToggle: (open: boolean) => void;
  onRollLogToggle: (open: boolean) => void;
  topPanelRef?: React.RefObject<HTMLDivElement>;
  onFocusSelf: () => void;
  onResetCamera: () => void;
}

/**
 * Header component with logo, controls, and tool toggles
 */
export const Header: React.FC<HeaderProps> = ({
  uid,
  snapToGrid,
  pointerMode,
  measureMode,
  drawMode,
  transformMode,
  selectMode,
  crtFilter,
  diceRollerOpen,
  rollLogOpen,
  onSnapToGridChange,
  onPointerModeChange,
  onMeasureModeChange,
  onDrawModeChange,
  onTransformModeChange,
  onSelectModeChange,
  onCrtFilterChange,
  onDiceRollerToggle,
  onRollLogToggle,
  topPanelRef,
  onFocusSelf,
  onResetCamera,
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
                onClick={onFocusSelf}
                variant="default"
                style={{ fontSize: "8px", padding: "6px 12px" }}
              >
                🎯 My Token
              </JRPGButton>
              <JRPGButton
                onClick={onResetCamera}
                variant="default"
                style={{ fontSize: "8px", padding: "6px 12px" }}
              >
                🧭 Recenter
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
                    onTransformModeChange?.(false);
                    onSelectModeChange?.(false);
                  }
                }}
                variant={drawMode ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "6px 12px" }}
              >
                ✏️ Draw
              </JRPGButton>

              {/* Transform Mode */}
              <JRPGButton
                onClick={() => {
                  onTransformModeChange?.(!transformMode);
                  if (!transformMode) {
                    onPointerModeChange(false);
                    onMeasureModeChange(false);
                    onDrawModeChange(false);
                    onSelectModeChange?.(false);
                  }
                }}
                variant={transformMode ? "primary" : "default"}
                style={{ fontSize: "8px", padding: "6px 12px" }}
                title="Scale and rotate objects"
              >
                🔄 Transform
              </JRPGButton>

              {/* Select Mode */}
              <JRPGButton
                onClick={() => {
                  onSelectModeChange?.(!selectMode);
                  if (!selectMode) {
                    onPointerModeChange(false);
                    onMeasureModeChange(false);
                    onDrawModeChange(false);
                    onTransformModeChange?.(false);
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
            </div>
          </JRPGPanel>
        </div>
      </JRPGPanel>
    </div>
  );
};
