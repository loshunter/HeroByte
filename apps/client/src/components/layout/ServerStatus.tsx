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
        left: 0,
        right: 0,
        zIndex: 200,
        background: isConnected ? "var(--hero-success)" : "var(--hero-danger)",
        color: "white",
        padding: "4px 12px",
        textAlign: "center",
        fontSize: "0.75rem",
        fontWeight: "bold",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
      }}
    >
      <span style={{ fontSize: "1rem" }}>{isConnected ? "🟢" : "🔴"}</span>
      <span>{isConnected ? "Connected" : "Disconnected"}</span>
    </div>
  );
};
