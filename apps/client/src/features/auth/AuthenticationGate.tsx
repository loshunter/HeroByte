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
// STYLES
// ============================================================================

const authGateContainerStyle: React.CSSProperties = {
  alignItems: "center",
  background: "radial-gradient(circle at top, #101020 0%, #050509 100%)",
  display: "flex",
  height: "100vh",
  justifyContent: "center",
  padding: "24px",
};

const authGateCardStyle: React.CSSProperties = {
  backgroundColor: "rgba(17, 24, 39, 0.9)",
  border: "1px solid rgba(148, 163, 184, 0.2)",
  borderRadius: "12px",
  boxShadow: "0 12px 40px rgba(15, 23, 42, 0.5)",
  color: "#f8fafc",
  maxWidth: "400px",
  padding: "32px",
  width: "100%",
};

const authGateErrorStyle: React.CSSProperties = {
  color: "#f87171",
  fontSize: "0.95rem",
  margin: "0",
};

const authGateHintStyle: React.CSSProperties = {
  color: "#cbd5f5",
  fontSize: "0.85rem",
  marginTop: "16px",
};

const authInputStyle: React.CSSProperties = {
  backgroundColor: "rgba(15, 23, 42, 0.9)",
  border: "1px solid rgba(148, 163, 184, 0.5)",
  borderRadius: "8px",
  color: "#e2e8f0",
  fontFamily: "inherit",
  fontSize: "1rem",
  padding: "12px",
  width: "100%",
};

const authPrimaryButtonStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #38bdf8, #6366f1)",
  border: "none",
  borderRadius: "8px",
  color: "#0f172a",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "1rem",
  fontWeight: 600,
  padding: "12px",
  transition: "filter 0.2s ease",
};

const authSecondaryButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(148, 163, 184, 0.4)",
  borderRadius: "8px",
  color: "#cbd5f5",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "0.9rem",
  marginTop: "12px",
  padding: "10px 12px",
  transition: "border-color 0.2s ease, color 0.2s ease",
  width: "100%",
};

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

/**
 * Props for the internal AuthGate form component
 */
interface AuthGateProps {
  password: string;
  authState: AuthState;
  authError: string | null;
  connectionLabel: string;
  canSubmit: boolean;
  isConnected: boolean;
  connectionState: ConnectionState;
  onPasswordChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onRetry: () => void;
}

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Internal authentication form component
 *
 * Renders the full-screen authentication gate with password input,
 * connection status, and retry functionality.
 */
function AuthGate({
  password,
  authState,
  authError,
  connectionLabel,
  canSubmit,
  isConnected,
  connectionState,
  onPasswordChange,
  onSubmit,
  onRetry,
}: AuthGateProps): JSX.Element {
  const isConnecting =
    connectionState === ConnectionState.CONNECTING ||
    connectionState === ConnectionState.RECONNECTING;
  const isHandshakeActive = isConnecting || authState === AuthState.PENDING;
  const submitLabel =
    authState === AuthState.PENDING
      ? "Authenticating..."
      : isConnecting
        ? "Connecting..."
        : "Enter Room";
  const primaryDisabled = !canSubmit || isHandshakeActive;

  return (
    <div style={authGateContainerStyle}>
      <div style={authGateCardStyle}>
        <h1 style={{ margin: "0 0 16px" }}>Join Your Room</h1>
        <p style={{ margin: "0 0 24px", color: "#cbd5f5", fontSize: "0.95rem" }}>
          Enter the room password provided by your host to sync with your party.
        </p>
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <input
            type="password"
            value={password}
            onChange={onPasswordChange}
            placeholder="Room password"
            style={authInputStyle}
            autoFocus
            spellCheck={false}
            disabled={isHandshakeActive}
          />
          {authError ? <p style={authGateErrorStyle}>{authError}</p> : null}
          <button
            type="submit"
            style={{
              ...authPrimaryButtonStyle,
              opacity: primaryDisabled ? 0.6 : 1,
              cursor: primaryDisabled ? "not-allowed" : "pointer",
            }}
            disabled={primaryDisabled}
            aria-busy={isHandshakeActive}
          >
            {submitLabel}
          </button>
        </form>
        <p style={authGateHintStyle}>
          Connection status:{" "}
          <strong
            style={{
              animation: isConnecting ? "pulse 1.5s ease-in-out infinite" : "none",
            }}
            aria-live="polite"
            aria-busy={isConnecting}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              {isConnecting ? (
                <span
                  aria-hidden="true"
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "var(--jrpg-gold)",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
              ) : null}
              <span>{connectionLabel}</span>
            </span>
          </strong>
        </p>
        {!isConnected ? (
          <button
            type="button"
            style={{
              ...authSecondaryButtonStyle,
              opacity: isConnecting ? 0.6 : 1,
              cursor: isConnecting ? "not-allowed" : "pointer",
            }}
            onClick={onRetry}
            disabled={isConnecting}
          >
            Retry Connection
          </button>
        ) : null}
      </div>
    </div>
  );
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
    connectionState === ConnectionState.CONNECTED;

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
