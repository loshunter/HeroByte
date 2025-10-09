// ============================================================================
// CARD CONTROLS COMPONENT
// ============================================================================
// Portrait load and microphone toggle controls

import React from "react";

interface CardControlsProps {
  isMe: boolean;
  micEnabled: boolean;
  onToggleMic: () => void;
  onOpenSettings: () => void;
}

export const CardControls: React.FC<CardControlsProps> = ({
  isMe,
  micEnabled,
  onToggleMic,
  onOpenSettings,
}) => {
  if (!isMe) {
    return <div style={{ height: "30px" }} />;
  }

  return (
    <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
      <button
        className={micEnabled ? "btn btn-danger" : "btn btn-success"}
        style={{ fontSize: "0.7rem", padding: "4px 8px" }}
        onClick={onToggleMic}
        title={micEnabled ? "Mute mic" : "Enable mic"}
      >
        {micEnabled ? "🔇" : "🎤"}
      </button>
      <button
        className="btn btn-secondary"
        style={{ fontSize: "0.7rem", padding: "4px 8px" }}
        onClick={onOpenSettings}
        title="Open player settings"
      >
        ⚙️
      </button>
    </div>
  );
};
