// ============================================================================
// HEARTBEAT HOOK
// ============================================================================
// Sends periodic heartbeat messages to the server to prevent timeout

import { useEffect } from "react";
import type { ClientMessage } from "@shared";

interface UseHeartbeatOptions {
  sendMessage: (msg: ClientMessage) => void;
  interval?: number; // Heartbeat interval in ms (default: 30 seconds)
}

/**
 * Hook to send periodic heartbeat messages to server
 */
export function useHeartbeat({ sendMessage, interval = 30000 }: UseHeartbeatOptions): void {
  useEffect(() => {
    // Send initial heartbeat immediately
    sendMessage({ t: "heartbeat" });

    // Then send periodic heartbeats
    const heartbeatInterval = setInterval(() => {
      sendMessage({ t: "heartbeat" });
    }, interval);

    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [sendMessage, interval]);
}
