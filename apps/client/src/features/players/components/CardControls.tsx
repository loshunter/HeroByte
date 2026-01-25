// ============================================================================
// CARD CONTROLS COMPONENT
// ============================================================================
// Portrait load and microphone toggle controls

import React from "react";

interface CardControlsProps {
  canControlMic: boolean;
  canOpenSettings: boolean;
  micEnabled: boolean;
  onToggleMic: () => void;
  onOpenSettings: () => void;
}

export const CardControls: React.FC<CardControlsProps> = ({
  canControlMic,
  canOpenSettings,
  micEnabled,
  onToggleMic,
  onOpenSettings,
}) => {
  if (!canControlMic && !canOpenSettings) {
    return <div style={{ height: "30px" }} />;
  }

  return (
    <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
      {canControlMic && (
        <button
          className={micEnabled ? "btn btn-danger" : "btn btn-success"}
          style={{ fontSize: "0.7rem", padding: "4px 8px" }}
          onClick={onToggleMic}
          title={micEnabled ? "Mute mic" : "Enable mic"}
        >
          {micEnabled ? "🔇" : "🎤"}
        </button>
      )}
      {canOpenSettings && (
        <button
          className="btn btn-secondary"
          style={{ fontSize: "0.7rem", padding: "4px 8px" }}
          onClick={onOpenSettings}
          title="Open player settings"
        >
          ⚙️
        </button>
      )}
    </div>
  );
};
