// ============================================================================
// MOBILE FLOATING CONTROLS
// ============================================================================
// Floating action button and menu for mobile layout.

import React, { useState } from "react";

interface MobileFloatingControlsProps {
  onShowEntities: () => void;
  onToggleDiceRoller: () => void;
  onToggleRollLog: () => void;
  diceRollerOpen: boolean;
  rollLogOpen: boolean;
}

export const MobileFloatingControls: React.FC<MobileFloatingControlsProps> = ({
  onShowEntities,
  onToggleDiceRoller,
  onToggleRollLog,
  diceRollerOpen,
  rollLogOpen,
}) => {
  const [showControls, setShowControls] = useState(false);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        right: 20,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        pointerEvents: "none", // Allow clicks to pass through container
        zIndex: 1500, // Ensure above map but below overlays
      }}
    >
      {/* Toggle Controls Button */}
      <button
        onClick={() => setShowControls(!showControls)}
        style={{
          pointerEvents: "auto",
          width: 50,
          height: 50,
          borderRadius: "50%",
          background: "rgba(0, 0, 0, 0.7)",
          color: "white",
          border: "2px solid rgba(255, 255, 255, 0.2)",
          fontSize: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        {showControls ? "✕" : "☰"}
      </button>

      {/* Expanded Controls */}
      {showControls && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, pointerEvents: "auto" }}>
          <button
            onClick={() => {
              onShowEntities();
              setShowControls(false);
            }}
            style={{
              background: "rgba(0, 0, 0, 0.7)",
              color: "white",
              padding: "10px",
              borderRadius: 8,
              border: "1px solid rgba(255, 255, 255, 0.2)",
              cursor: "pointer",
              textAlign: "right",
            }}
          >
            👥 Party
          </button>
          <button
            onClick={() => {
              onToggleDiceRoller();
              setShowControls(false);
            }}
            style={{
              background: diceRollerOpen ? "#4a9eff" : "rgba(0, 0, 0, 0.7)",
              color: "white",
              padding: "10px",
              borderRadius: 8,
              border: "1px solid rgba(255, 255, 255, 0.2)",
              cursor: "pointer",
              textAlign: "right",
            }}
          >
            🎲 Dice
          </button>
          <button
            onClick={() => {
              onToggleRollLog();
              setShowControls(false);
            }}
            style={{
              background: rollLogOpen ? "#4a9eff" : "rgba(0, 0, 0, 0.7)",
              color: "white",
              padding: "10px",
              borderRadius: 8,
              border: "1px solid rgba(255, 255, 255, 0.2)",
              cursor: "pointer",
              textAlign: "right",
            }}
          >
            📜 Log
          </button>
        </div>
      )}
    </div>
  );
};
