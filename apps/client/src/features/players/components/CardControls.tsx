// ============================================================================
// CARD CONTROLS COMPONENT
// ============================================================================
// Portrait load and microphone toggle controls

import React from "react";

interface CardControlsProps {
  isMe: boolean;
  micEnabled: boolean;
  onPortraitLoad: () => void;
  onToggleMic: () => void;
}

export const CardControls: React.FC<CardControlsProps> = ({
  isMe,
  micEnabled,
  onPortraitLoad,
  onToggleMic,
}) => {
  if (!isMe) {
    return <div style={{ height: "30px" }} />;
  }

  return (
    <div style={{ display: "flex", gap: "4px" }}>
      <button
        className="btn btn-primary"
        style={{ fontSize: "0.7rem", padding: "4px 8px" }}
        onClick={onPortraitLoad}
      >
        Load
      </button>
      <button
        className={micEnabled ? "btn btn-danger" : "btn btn-success"}
        style={{ fontSize: "0.7rem", padding: "4px 8px" }}
        onClick={onToggleMic}
        title={micEnabled ? "Mute mic" : "Enable mic"}
      >
        {micEnabled ? "🔇" : "🎤"}
      </button>
    </div>
  );
};
