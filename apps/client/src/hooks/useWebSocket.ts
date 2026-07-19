// ============================================================================
// USE WEBSOCKET HOOK
// ============================================================================
// React hook for WebSocket connection management

import { useEffect, useState, useRef, useCallback } from "react";
import { WebSocketService, ConnectionState, AuthState, AuthEvent } from "../services/websocket";
import type { RoomSnapshot, ClientMessage, ServerMessage } from "@herobyte/shared";

interface UseWebSocketOptions {
  url: string;
  uid: string;
  onRtcSignal?: (from: string, signal: unknown) => void;
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  snapshot: RoomSnapshot | null;
  connectionState: ConnectionState;
  isConnected: boolean;
  authState: AuthState;
  authError: string | null;
  send: (message: ClientMessage) => void;
  connect: () => void;
  disconnect: () => void;
  registerRtcHandler: (handler: (from: string, signal: unknown) => void) => void;
  authenticate: (secret: string, roomId?: string) => void;
  /** Room credentials retained for reconnects; null until authenticated. */
  getAuthCredentials: () => { secret: string; roomId?: string } | null;
  registerServerEventHandler: (handler: (message: ServerMessage) => void) => void;
  /** Fires when a reliable command was dropped for good (retries exhausted /
   * offline-queue overflow) — the user's change never reached the server. */
  registerCommandDropHandler: (handler: (messageType: string, reason: string) => void) => void;
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
    ConnectionState.DISCONNECTED,
  );
  const [authState, setAuthState] = useState<AuthState>(AuthState.UNAUTHENTICATED);
  const [authError, setAuthError] = useState<string | null>(null);

  // Use ref to store the current RTC signal handler
  const rtcHandlerRef = useRef<((from: string, signal: unknown) => void) | undefined>(onRtcSignal);
  const controlHandlerRef = useRef<((message: ServerMessage) => void) | undefined>();
  const commandDropHandlerRef = useRef<
    ((messageType: string, reason: string) => void) | undefined
  >();

  // Use ref to avoid recreating service on re-renders
  const serviceRef = useRef<WebSocketService | null>(null);

  // Initialize service once
  useEffect(() => {
    const handleAuthEvent = (event: AuthEvent) => {
      switch (event.type) {
        case "reset":
          setAuthState(AuthState.UNAUTHENTICATED);
          setAuthError(null);
          setSnapshot(null);
          break;
        case "pending":
          setAuthState(AuthState.PENDING);
          setAuthError(null);
          break;
        case "success":
          setAuthState(AuthState.AUTHENTICATED);
          setAuthError(null);
          break;
        case "failure":
          setAuthState(AuthState.FAILED);
          setAuthError(event.reason ?? "Authentication failed");
          setSnapshot(null);
          break;
      }
    };

    const service = new WebSocketService({
      url,
      uid,
      onMessage: (newSnapshot) => {
        // Debug-only: snapshots arrive at high frequency during combat
        // (token-update deltas), so never log them in production builds.
        if (import.meta.env.DEV) {
          console.log(
            "[useWebSocket] Snapshot updated, characters count:",
            newSnapshot.characters?.length || 0,
          );
        }
        setSnapshot(newSnapshot);
      },
      onRtcSignal: (from, signal) => {
        // Use the ref to get the latest handler
        rtcHandlerRef.current?.(from, signal);
      },
      onStateChange: setConnectionState,
      onAuthEvent: handleAuthEvent,
      onControlMessage: (message) => {
        controlHandlerRef.current?.(message);
      },
      onCommandDropped: (messageType, reason) => {
        commandDropHandlerRef.current?.(messageType, reason);
      },
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

  const send = useCallback((message: ClientMessage) => {
    serviceRef.current?.send(message);
  }, []);

  const connect = useCallback(() => {
    serviceRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    serviceRef.current?.disconnect();
  }, []);

  const registerRtcHandler = useCallback((handler: (from: string, signal: unknown) => void) => {
    rtcHandlerRef.current = handler;
  }, []);

  const registerServerEventHandler = useCallback((handler: (message: ServerMessage) => void) => {
    controlHandlerRef.current = handler;
  }, []);

  const registerCommandDropHandler = useCallback(
    (handler: (messageType: string, reason: string) => void) => {
      commandDropHandlerRef.current = handler;
    },
    [],
  );

  const authenticate = useCallback((secret: string, roomId?: string) => {
    serviceRef.current?.authenticate(secret, roomId);
  }, []);

  const getAuthCredentials = useCallback(
    () => serviceRef.current?.getAuthCredentials() ?? null,
    [],
  );

  const isConnected = connectionState === ConnectionState.CONNECTED;

  return {
    snapshot,
    connectionState,
    isConnected,
    authState,
    authError,
    send,
    connect,
    disconnect,
    registerRtcHandler,
    authenticate,
    getAuthCredentials,
    registerServerEventHandler,
    registerCommandDropHandler,
  };
}
