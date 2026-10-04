// ============================================================================
// TABLE PASSWORD CONTROL COMPONENT
// ============================================================================
// Provides UI for managing who can join by allowing DMs to set/update the
// table password (the wire messages keep the old `room` name; copy says table).
// Handles validation, user feedback, and state management for password updates.

import { useState, useEffect } from "react";
import { JRPGPanel, JRPGButton } from "../../../components/ui/JRPGPanel";
import { useResetRoomPassword } from "../../dm/hooks/useResetRoomPassword";

// Reset to default hands the table the Main Hall's password (the server's setting, so the
// published default only when it is unset): anyone who has this table's code and that password
// could then join. One tap beside "Change table password" is not enough for that, and a
// restore-minded host reads it as tidying up.
export const RESET_CONFIRM =
  "Reset this table's password to the Main Hall's?\n\n" +
  "Anyone who has this table's code and the Main Hall password can then join.";

/**
 * Props for the TablePasswordControl component.
 */
interface TablePasswordControlProps {
  /**
   * Callback invoked when the DM submits a new room password.
   * @param secret - The validated password string (trimmed, min 6 chars, confirmed).
   */
  onSetRoomPassword?: (secret?: string) => void;

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
 * TablePasswordControl component for changing the table password.
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
export function TablePasswordControl({
  onSetRoomPassword,
  roomPasswordStatus = null,
  roomPasswordPending = false,
  onDismissRoomPasswordStatus,
}: TablePasswordControlProps) {
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordConfirmInput, setPasswordConfirmInput] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const { resetToDefault } = useResetRoomPassword(onSetRoomPassword);

  const handleReset = () => {
    if (!onSetRoomPassword) return;
    if (!window.confirm(RESET_CONFIRM)) return;
    resetToDefault();
  };

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
    <JRPGPanel variant="simple">
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <p className="jrpg-text-small" style={{ margin: 0, color: "var(--jrpg-white)" }}>
          The table password is what players enter to join. Change it and players already here stay
          connected; anyone joining afterwards needs the new one.
        </p>
        <input
          type="password"
          value={passwordInput}
          placeholder="New table password"
          aria-label="New table password"
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
          placeholder="Confirm table password"
          aria-label="Confirm table password"
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
          {roomPasswordPending ? "Changing…" : "Change table password"}
        </JRPGButton>
        <JRPGButton
          onClick={handleReset}
          variant="default"
          disabled={roomPasswordPending || !onSetRoomPassword}
          style={{ fontSize: "10px" }}
        >
          Reset to default
        </JRPGButton>
        <p
          className="jrpg-text-small"
          style={{ margin: 0, color: "var(--jrpg-white)", opacity: 0.8 }}
        >
          Reset to default gives this table the Main Hall&rsquo;s password: anyone with its code and
          that password can join.
        </p>
      </div>
    </JRPGPanel>
  );
}
