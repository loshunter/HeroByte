// ============================================================================
// SERVER STATUS COMPONENT
// ============================================================================
// Displays WebSocket connection status banner

import React from "react";

interface ServerStatusProps {
  isConnected: boolean;
}

export const ServerStatus: React.FC<ServerStatusProps> = ({ isConnected }) => {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 200,
        background: isConnected ? "var(--jrpg-hp-full)" : "var(--jrpg-hp-low)",
        color: "var(--jrpg-navy)",
        padding: "4px 16px",
        textAlign: "center",
        fontSize: "8px",
        fontWeight: "bold",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        border: "2px solid var(--jrpg-border-outer)",
        borderTop: "none",
        borderRadius: "0 0 8px 8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.5), inset 0 0 0 1px var(--jrpg-border-shadow)",
        fontFamily: "'Press Start 2P', monospace",
        minWidth: "120px",
      }}
    >
      <span style={{ fontSize: "10px" }}>{isConnected ? "🟢" : "🔴"}</span>
      <span>{isConnected ? "ONLINE" : "OFFLINE"}</span>
    </div>
  );
};
