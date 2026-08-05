// ============================================================================
// USE WEBSOCKET HOOK
// ============================================================================
// React hook for WebSocket connection management

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { WebSocketService, ConnectionState, AuthState, AuthEvent } from "../services/websocket";
import type { RoomSnapshot, ClientMessage, MeasureEvent, ServerMessage } from "@herobyte/shared";

interface UseWebSocketOptions {
  url: string;
  uid: string;
  onRtcSignal?: (from: string, signal: unknown) => void;
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  snapshot: RoomSnapshot | null;
  /**
   * Everyone ELSE's live measurement (S6). Your own echo is dropped here — the
   * local overlay already draws it, and drawing it twice makes the line look
   * doubled while dragging. Ephemeral: measurements never enter a snapshot, so
   * this channel is the only way they arrive.
   */
  remoteMeasurements: MeasureEvent[];
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
  const [measurements, setMeasurements] = useState<Record<string, MeasureEvent>>({});

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
          setSnapshot(null);
          setMeasurements({});
          // authError is deliberately PRESERVED here. The server sends
          // `auth-failed` and then closes the socket ~100 ms later; that close
          // raises `reset`, which used to null the reason out from under the
          // render — so a wrong password flashed an error for a tenth of a
          // second and then showed nothing at all. The reason now survives
          // until the next attempt clears it ("pending" / "success" below),
          // which is the only point at which it stops being true.
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
          setMeasurements({});
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
      onMeasure: (measure) => {
        setMeasurements((current) => {
          // The server echoes to everyone including the sender; our own line is
          // already on screen from local state.
          if (measure.uid === uid) return current;
          // No endpoints IS the stop-measuring signal.
          if (!measure.start || !measure.end) {
            if (!(measure.uid in current)) return current;
            const next = { ...current };
            delete next[measure.uid];
            return next;
          }
          return { ...current, [measure.uid]: measure };
        });
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

  // A measurement is relayed, not stored, so nothing on the server tells us
  // when to forget one. `snapshot.users` IS the connected set (pushed on auth,
  // filtered on every disconnect), so pruning against it retires a line left
  // behind by a closed tab, a crash, or a heartbeat timeout alike — without a
  // second server path that could itself go missing.
  const connectedUids = snapshot?.users;
  useEffect(() => {
    if (!connectedUids) return;
    setMeasurements((current) => {
      const uids = Object.keys(current);
      if (uids.length === 0) return current;
      const live = new Set(connectedUids);
      const next: Record<string, MeasureEvent> = {};
      let dropped = false;
      for (const key of uids) {
        if (live.has(key)) next[key] = current[key];
        else dropped = true;
      }
      // Same reference when nothing changed, so this cannot loop a render.
      return dropped ? next : current;
    });
  }, [connectedUids]);

  const remoteMeasurements = useMemo(() => Object.values(measurements), [measurements]);

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
    remoteMeasurements,
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
