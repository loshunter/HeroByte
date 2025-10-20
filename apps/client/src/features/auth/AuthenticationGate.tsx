/**
 * AuthenticationGate Component
 *
 * Handles room password authentication and session management for the VTT client.
 * Provides a full-screen authentication form before granting access to the application,
 * with automatic reconnection and session persistence support.
 *
 * Extracted from: apps/client/src/ui/App.tsx (lines 53-267, 283-406)
 * Extraction date: 2025-10-20
 *
 * @module features/auth/AuthenticationGate
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AuthState, ConnectionState } from "../../services/websocket";
import { AuthGate } from "./AuthGate";

// ============================================================================
// CONSTANTS
// ============================================================================

const ROOM_SECRET_STORAGE_KEY = "herobyte-room-secret";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Retrieve the stored room secret from sessionStorage if available
 * @returns The stored secret or empty string if not found/accessible
 */
function getInitialRoomSecret(): string {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(ROOM_SECRET_STORAGE_KEY) ?? "";
  } catch (error) {
    console.warn("[Auth] Unable to access sessionStorage:", error);
    return "";
  }
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Props for AuthenticationGate component
 */
export interface AuthenticationGateProps {
  /**
   * WebSocket URL for connection
   */
  url: string;

  /**
   * Unique identifier for this user
   */
  uid: string;

  /**
   * Callback to authenticate with the server
   * @param secret - The room password to authenticate with
   */
  onAuthenticate: (secret: string) => void;

  /**
   * Callback to initiate connection to the server
   */
  onConnect: () => void;

  /**
   * Whether the WebSocket is currently connected
   */
  isConnected: boolean;

  /**
   * Current WebSocket connection state
   */
  connectionState: ConnectionState;

  /**
   * Current authentication state
   */
  authState: AuthState;

  /**
   * Error message from authentication failure, if any
   */
  authError: string | null;

  /**
   * Content to render after successful authentication
   */
  children: React.ReactNode;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * AuthenticationGate Component
 *
 * Guards application content behind room password authentication.
 * Handles the full authentication lifecycle including:
 * - Initial authentication with password
 * - Session persistence via sessionStorage
 * - Automatic re-authentication on reconnection
 * - Re-authentication banner during reconnection
 *
 * @example
 * ```tsx
 * <AuthenticationGate
 *   url={WS_URL}
 *   uid={sessionUID}
 *   onAuthenticate={authenticate}
 *   onConnect={connect}
 *   isConnected={isConnected}
 *   connectionState={connectionState}
 *   authState={authState}
 *   authError={authError}
 * >
 *   <App />
 * </AuthenticationGate>
 * ```
 *
 * @see {@link useWebSocket} for WebSocket connection management
 */
export function AuthenticationGate({
  onAuthenticate,
  onConnect,
  isConnected,
  connectionState,
  authState,
  authError,
  children,
}: AuthenticationGateProps): JSX.Element {
  // -------------------------------------------------------------------------
  // STATE
  // -------------------------------------------------------------------------

  const initialSecret = useMemo(() => getInitialRoomSecret(), []);
  const [authSecret, setAuthSecret] = useState("");
  const [passwordInput, setPasswordInput] = useState(initialSecret || "");
  const [hasAuthenticated, setHasAuthenticated] = useState(false);

  // -------------------------------------------------------------------------
  // EFFECTS
  // -------------------------------------------------------------------------

  /**
   * Set authSecret from initialSecret on mount if available
   */
  useEffect(() => {
    if (initialSecret) {
      setAuthSecret(initialSecret);
    }
  }, [initialSecret]);

  /**
   * Auto-authenticate when connection is established and we have a stored secret
   */
  useEffect(() => {
    if (!authSecret) return;
    if (authState !== AuthState.UNAUTHENTICATED) return;
    if (!isConnected) return;

    onAuthenticate(authSecret);
  }, [authSecret, authState, onAuthenticate, isConnected]);

  /**
   * Persist room secret to sessionStorage on successful authentication
   */
  useEffect(() => {
    if (authState === AuthState.AUTHENTICATED && authSecret) {
      try {
        sessionStorage.setItem(ROOM_SECRET_STORAGE_KEY, authSecret);
      } catch (error) {
        console.warn("[Auth] Unable to persist room secret:", error);
      }
    }
  }, [authState, authSecret]);

  /**
   * Clear stored secret and reset state on authentication failure
   */
  useEffect(() => {
    if (authState === AuthState.FAILED && authSecret) {
      try {
        sessionStorage.removeItem(ROOM_SECRET_STORAGE_KEY);
      } catch (error) {
        console.warn("[Auth] Unable to clear stored secret:", error);
      }
      setAuthSecret("");
      setPasswordInput("");
    }
  }, [authState, authSecret]);

  /**
   * Track whether user has ever successfully authenticated
   * Used to determine whether to show re-auth banner vs auth gate
   */
  useEffect(() => {
    if (authState === AuthState.AUTHENTICATED) {
      setHasAuthenticated(true);
    } else if (authState === AuthState.FAILED) {
      setHasAuthenticated(false);
    }
  }, [authState]);

  // -------------------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------------------

  /**
   * Handle password form submission
   */
  const handlePasswordSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = passwordInput.trim();
      if (!trimmed) {
        return;
      }

      setAuthSecret(trimmed);

      if (!isConnected) {
        onConnect();
        return;
      }

      onAuthenticate(trimmed);
    },
    [onAuthenticate, onConnect, isConnected, passwordInput],
  );

  /**
   * Handle password input changes
   */
  const handlePasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordInput(event.target.value);
  }, []);

  // -------------------------------------------------------------------------
  // COMPUTED VALUES
  // -------------------------------------------------------------------------

  const connectionLabel = useMemo(() => {
    switch (connectionState) {
      case ConnectionState.CONNECTED:
        return "Connected";
      case ConnectionState.CONNECTING:
        return "Connecting";
      case ConnectionState.RECONNECTING:
        return "Reconnecting";
      case ConnectionState.FAILED:
        return "Failed";
      case ConnectionState.DISCONNECTED:
      default:
        return "Disconnected";
    }
  }, [connectionState]);

  const canSubmit =
    passwordInput.trim().length > 0 &&
    authState !== AuthState.PENDING &&
    connectionState !== ConnectionState.CONNECTING &&
    connectionState !== ConnectionState.RECONNECTING;

  const showAuthGate = !hasAuthenticated || authState === AuthState.FAILED;

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------

  if (showAuthGate) {
    return (
      <AuthGate
        password={passwordInput}
        authState={authState}
        authError={authError}
        connectionLabel={connectionLabel}
        canSubmit={canSubmit}
        isConnected={isConnected}
        connectionState={connectionState}
        onPasswordChange={handlePasswordChange}
        onSubmit={handlePasswordSubmit}
        onRetry={onConnect}
      />
    );
  }

  return (
    <>
      {/* Re-authentication banner - shown when user was authenticated but connection dropped */}
      {hasAuthenticated && authState !== AuthState.AUTHENTICATED && (
        <div
          className="jrpg-text-small"
          style={{
            position: "fixed",
            top: "12px",
            right: "16px",
            padding: "6px 10px",
            background: "rgba(12, 19, 38, 0.9)",
            border: "1px solid var(--jrpg-gold)",
            borderRadius: "6px",
            color: "var(--jrpg-white)",
            zIndex: 2000,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {authState === AuthState.PENDING ? "Re-authenticating…" : "Reconnecting…"}
        </div>
      )}

      {/* Authenticated content */}
      {children}
    </>
  );
}
