/**
 * AuthGate Form Component
 *
 * Internal authentication form UI component.
 * Renders the full-screen authentication gate with password input,
 * connection status, and retry functionality.
 *
 * @module features/auth/AuthGate
 */

import React from "react";
import { AuthState, ConnectionState } from "../../services/websocket";
import {
  authGateContainerStyle,
  authGateCardStyle,
  authGateErrorStyle,
  authGateHintStyle,
  authInputStyle,
  authPrimaryButtonStyle,
  authSecondaryButtonStyle,
} from "./AuthenticationGate.styles";

/**
 * Props for the AuthGate form component
 */
export interface AuthGateProps {
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
  /** Optional table shelf (room lobby) rendered at the bottom of the card. */
  roomSlot?: React.ReactNode;
}

/**
 * AuthGate Form Component
 *
 * Renders the full-screen authentication gate with password input,
 * connection status, and retry functionality.
 */
export function AuthGate({
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
  roomSlot,
}: AuthGateProps): JSX.Element {
  const isConnecting =
    connectionState === ConnectionState.CONNECTING ||
    connectionState === ConnectionState.RECONNECTING;
  const isReplaced = connectionState === ConnectionState.REPLACED;
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
            // NOT disabled while the handshake is in flight. Typing a password
            // is harmless — only submitting needs gating (see the button below).
            // Locking the field meant that any time the server was restarting
            // or the network hiccuped, the user could not even type, which
            // reads as a dead app rather than a slow one.
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
        {isReplaced ? (
          <p style={authGateHintStyle}>
            This table is open in another tab or window. Only one connection per device stays live —
            reclaim it here, and the other one will pause.
          </p>
        ) : null}
        {!isConnected ? (
          <button
            type="button"
            style={authSecondaryButtonStyle}
            onClick={onRetry}
            // Deliberately always enabled. Reconnection retries forever
            // (maxReconnectAttempts: 0), so `isConnecting` can stay true
            // indefinitely — disabling on it left the user with a dead Retry
            // button and no way out but a page reload. Retrying during a
            // backoff wait is exactly what someone wants to do.
          >
            {isReplaced ? "Reclaim This Tab" : "Retry Connection"}
          </button>
        ) : null}
        {roomSlot}
      </div>
    </div>
  );
}
