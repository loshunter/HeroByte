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
    <main style={authGateContainerStyle}>
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
