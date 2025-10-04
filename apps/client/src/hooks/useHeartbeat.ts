// ============================================================================
// HEARTBEAT HOOK
// ============================================================================
// Sends periodic heartbeat messages to the server to prevent timeout

import { useEffect } from "react";
import type { ClientMessage } from "@shared";

interface UseHeartbeatOptions {
  sendMessage: (msg: ClientMessage) => void;
  interval?: number; // Heartbeat interval in ms (default: 30 seconds)
  enabled?: boolean; // Whether heartbeats should be active
}

/**
 * Hook to send periodic heartbeat messages to server
 */
export function useHeartbeat({
  sendMessage,
  interval = 30000,
  enabled = true,
}: UseHeartbeatOptions): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Send initial heartbeat immediately
    sendMessage({ t: "heartbeat" });

    // Then send periodic heartbeats
    const heartbeatInterval = setInterval(() => {
      sendMessage({ t: "heartbeat" });
    }, interval);

    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [enabled, interval, sendMessage]);
}
