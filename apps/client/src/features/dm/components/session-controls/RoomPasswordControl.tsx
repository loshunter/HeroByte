// ============================================================================
// ROOM PASSWORD CONTROL COMPONENT
// ============================================================================
// Provides UI for managing room security by allowing DMs to set/update the
// room password. Handles validation, user feedback, and state management for
// password updates.

import { useState, useEffect } from "react";
import { JRPGPanel, JRPGButton } from "../../../../components/ui/JRPGPanel";

/**
 * Props for the RoomPasswordControl component.
 */
interface RoomPasswordControlProps {
  /**
   * Callback invoked when the DM submits a new room password.
   * @param secret - The validated password string (trimmed, min 6 chars, confirmed).
   */
  onSetRoomPassword?: (secret: string) => void;

  /**
   * Status feedback from the server after attempting to set the password.
   * Shows success or error messages to the user.
   */
  roomPasswordStatus?: { type: "success" | "error"; message: string } | null;

  /**
   * Indicates whether a password update request is currently in progress.
   * When true, the submit button is disabled and shows "Updating..." text.
   */
  roomPasswordPending?: boolean;

  /**
   * Callback invoked when the user interacts with inputs (typing, etc.)
   * to dismiss any active status messages.
   */
  onDismissRoomPasswordStatus?: () => void;
}

/**
 * RoomPasswordControl component for managing room password security.
 *
 * Features:
 * - Dual password input fields (new password + confirmation)
 * - Client-side validation (min 6 characters, passwords must match)
 * - Real-time error feedback
 * - Server status display (success/error messages)
 * - Auto-clears inputs on successful password update
 * - Disabled state during pending operations
 *
 * @param props - Component props
 */
export function RoomPasswordControl({
  onSetRoomPassword,
  roomPasswordStatus = null,
  roomPasswordPending = false,
  onDismissRoomPasswordStatus,
}: RoomPasswordControlProps) {
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordConfirmInput, setPasswordConfirmInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Clear password inputs when server confirms successful update
  useEffect(() => {
    if (roomPasswordStatus?.type === "success") {
      setPasswordInput("");
      setPasswordConfirmInput("");
    }
  }, [roomPasswordStatus]);

  /**
   * Handles password submission with validation.
   * Validates minimum length and password matching before invoking callback.
   */
  const handlePasswordSubmit = () => {
    if (!onSetRoomPassword) return;

    const trimmed = passwordInput.trim();
    const confirm = passwordConfirmInput.trim();

    if (trimmed.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }

    if (trimmed !== confirm) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setPasswordError(null);
    onDismissRoomPasswordStatus?.();
    onSetRoomPassword(trimmed);
  };

  return (
    <JRPGPanel variant="simple" title="Room Security">
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <p className="jrpg-text-small" style={{ margin: 0, color: "var(--jrpg-white)" }}>
          Update the shared room password. Current players remain connected; new entrants must use
          the new secret.
        </p>
        <input
          type="password"
          value={passwordInput}
          placeholder="New password"
          onChange={(event) => {
            setPasswordInput(event.target.value);
            setPasswordError(null);
            onDismissRoomPasswordStatus?.();
          }}
          style={{
            width: "100%",
            padding: "6px",
            background: "#111",
            color: "var(--jrpg-white)",
            border: "1px solid var(--jrpg-border-gold)",
          }}
        />
        <input
          type="password"
          value={passwordConfirmInput}
          placeholder="Confirm password"
          onChange={(event) => {
            setPasswordConfirmInput(event.target.value);
            setPasswordError(null);
            onDismissRoomPasswordStatus?.();
          }}
          style={{
            width: "100%",
            padding: "6px",
            background: "#111",
            color: "var(--jrpg-white)",
            border: "1px solid var(--jrpg-border-gold)",
          }}
        />
        {passwordError ? (
          <p style={{ color: "#f87171", margin: 0, fontSize: "0.85rem" }}>{passwordError}</p>
        ) : null}
        {roomPasswordStatus ? (
          <p
            style={{
              color: roomPasswordStatus.type === "success" ? "#4ade80" : "#f87171",
              margin: 0,
              fontSize: "0.85rem",
            }}
          >
            {roomPasswordStatus.message}
          </p>
        ) : null}
        <JRPGButton
          onClick={handlePasswordSubmit}
          variant="primary"
          disabled={roomPasswordPending || !onSetRoomPassword}
          style={{ fontSize: "10px" }}
        >
          {roomPasswordPending ? "Updating…" : "Update Password"}
        </JRPGButton>
      </div>
    </JRPGPanel>
  );
}
