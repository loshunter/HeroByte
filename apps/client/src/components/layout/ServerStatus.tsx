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
        // Clears the notch. The variable is defined on .mobile-layout-root and
        // inherits down to here; the fallback is what desktop gets, where this
        // is not rendered under any system chrome.
        top: "var(--mobile-safe-top, 0px)",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 200,
        background: isConnected ? "var(--jrpg-hp-full)" : "var(--jrpg-hp-low)",
        color: "var(--jrpg-navy)",
        padding: "4px 16px",
        textAlign: "center",
        // Was 8px. This is the only place the table tells you it has lost the
        // server, so it holds the project's 11px readability floor.
        fontSize: "11px",
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
        // Purely informational, and since M4a it paints ABOVE the mobile
        // screens — without this it swallows the touches meant for whatever
        // is under it, which broke drag-to-dismiss on the screen header the
        // moment the banner was lifted over it.
        pointerEvents: "none",
      }}
    >
      <span style={{ fontSize: "12px" }}>{isConnected ? "🟢" : "🔴"}</span>
      <span>{isConnected ? "ONLINE" : "OFFLINE"}</span>
    </div>
  );
};
