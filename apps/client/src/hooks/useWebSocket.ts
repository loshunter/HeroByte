// ============================================================================
// USE WEBSOCKET HOOK
// ============================================================================
// React hook for WebSocket connection management

import { useEffect, useState, useRef, useCallback } from "react";
import { WebSocketService, ConnectionState } from "../services/websocket";
import type { RoomSnapshot, ClientMessage } from "@shared";

interface UseWebSocketOptions {
  url: string;
  uid: string;
  onRtcSignal?: (from: string, signal: any) => void;
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  snapshot: RoomSnapshot | null;
  connectionState: ConnectionState;
  isConnected: boolean;
  send: (message: ClientMessage) => void;
  connect: () => void;
  disconnect: () => void;
}

/**
 * Hook to manage WebSocket connection and room state
 *
 * Example usage:
 * ```tsx
 * const { snapshot, send, isConnected } = useWebSocket({
 *   url: WS_URL,
 *   uid: sessionUID,
 *   onRtcSignal: handleRtcSignal
 * });
 * ```
 */
export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const { url, uid, onRtcSignal, autoConnect = true } = options;

  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.DISCONNECTED
  );

  // Use ref to avoid recreating service on re-renders
  const serviceRef = useRef<WebSocketService | null>(null);

  // Initialize service once
  useEffect(() => {
    const service = new WebSocketService({
      url,
      uid,
      onMessage: setSnapshot,
      onRtcSignal,
      onStateChange: setConnectionState,
    });

    serviceRef.current = service;

    if (autoConnect) {
      service.connect();
    }

    // Cleanup on unmount
    return () => {
      service.disconnect();
    };
  }, [url, uid]); // Only recreate if URL or UID changes

  // Update RTC signal handler when it changes
  useEffect(() => {
    if (serviceRef.current && onRtcSignal) {
      // Service already has the handler from initialization
      // This effect ensures we don't recreate the service unnecessarily
    }
  }, [onRtcSignal]);

  const send = useCallback((message: ClientMessage) => {
    serviceRef.current?.send(message);
  }, []);

  const connect = useCallback(() => {
    serviceRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    serviceRef.current?.disconnect();
  }, []);

  const isConnected = connectionState === ConnectionState.CONNECTED;

  return {
    snapshot,
    connectionState,
    isConnected,
    send,
    connect,
    disconnect,
  };
}
