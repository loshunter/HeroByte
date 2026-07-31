import React, { useState, useEffect } from "react";
import { JRPGButton } from "../../../components/ui/JRPGPanel";

interface DMElevationModalProps {
  isOpen: boolean;
  mode: "elevate" | "revoke" | "bootstrap";
  isLoading: boolean;
  error: string | null;
  currentIsDM: boolean;
  onElevate: (password: string) => void;
  onBootstrap: (password: string) => void;
  onRevoke: () => void;
  onClose: () => void;
}

/**
 * Modal for DM elevation and revocation with proper loading states.
 *
 * Replaces native window.prompt() and window.confirm() dialogs with
 * a proper UI that shows loading feedback while waiting for server confirmation.
 */
export function DMElevationModal({
  isOpen,
  mode,
  isLoading,
  error,
  currentIsDM,
  onElevate,
  onBootstrap,
  onRevoke,
  onClose,
}: DMElevationModalProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  // Close modal on successful state change
  useEffect(() => {
    if (!isLoading && !error) {
      // Successful elevation/bootstrap: currentIsDM becomes true
      if ((mode === "elevate" || mode === "bootstrap") && currentIsDM) {
        onClose();
        setPassword("");
        setConfirmPassword("");
        setLocalError(null);
      }
      // Successful revocation: mode is "revoke" and currentIsDM becomes false
      if (mode === "revoke" && !currentIsDM) {
        onClose();
      }
    }
  }, [isLoading, error, currentIsDM, mode, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "elevate") {
      onElevate(password);
    } else if (mode === "bootstrap") {
      // Mirror the server's 8–128 rule so the round trip can't fail on length.
      if (password.trim().length < 8) {
        setLocalError("DM password needs at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setLocalError("Passwords do not match.");
        return;
      }
      setLocalError(null);
      onBootstrap(password);
    } else {
      onRevoke();
    }
  };

  const handleCancel = () => {
    if (!isLoading) {
      setPassword("");
      setConfirmPassword("");
      setLocalError(null);
      onClose();
    }
  };

  const passwordInputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px",
    backgroundColor: "#1a1a1a",
    border: "1px solid #4a4a4a",
    borderRadius: "4px",
    color: "#fff",
    fontSize: "14px",
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Above the DM menu (1002) and the player settings window (2500).
        // At 1000 this modal painted BELOW the DM menu it is launched from:
        // on a wide desktop the menu floated undimmed over the scrim, and in
        // the 701–767px band the menu goes fullscreen-opaque at 1102, hiding
        // the dialog entirely — with no Escape handler and no reachable scrim,
        // an unclosable dialog.
        zIndex: 3000,
      }}
      onClick={handleCancel}
    >
      <div
        style={{
          backgroundColor: "#2a2a2a",
          border: "2px solid #4a4a4a",
          borderRadius: "8px",
          padding: "24px",
          minWidth: "400px",
          maxWidth: "500px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: "16px", color: "#fff" }}>
          {mode === "elevate"
            ? "Elevate to DM"
            : mode === "bootstrap"
              ? "Set the DM Password"
              : "Revoke DM Status"}
        </h2>

        <form onSubmit={handleSubmit}>
          {mode === "elevate" ? (
            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="dm-password"
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#ccc",
                }}
              >
                Enter DM Password:
              </label>
              <input
                id="dm-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoFocus
                style={passwordInputStyle}
              />
            </div>
          ) : mode === "bootstrap" ? (
            <div style={{ marginBottom: "16px" }}>
              <p style={{ marginTop: 0, color: "#ccc" }}>
                This table doesn&apos;t have a DM password yet. Set one now — you&apos;ll become the
                DM immediately, and anyone with this password can claim the DM seat later.
              </p>
              <label
                htmlFor="dm-new-password"
                style={{ display: "block", marginBottom: "8px", color: "#ccc" }}
              >
                New DM Password (8+ characters):
              </label>
              <input
                id="dm-new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoFocus
                style={{ ...passwordInputStyle, marginBottom: "12px" }}
              />
              <label
                htmlFor="dm-confirm-password"
                style={{ display: "block", marginBottom: "8px", color: "#ccc" }}
              >
                Confirm DM Password:
              </label>
              <input
                id="dm-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                style={passwordInputStyle}
              />
            </div>
          ) : (
            <div style={{ marginBottom: "16px", color: "#ccc" }}>
              <p>Are you sure you want to revoke your DM status?</p>
              <p style={{ fontSize: "12px", color: "#999" }}>
                You will lose access to DM tools and will need to re-enter the password to become DM
                again.
              </p>
            </div>
          )}

          {(localError ?? error) && (
            <div
              style={{
                marginBottom: "16px",
                padding: "8px",
                backgroundColor: "#ff000020",
                border: "1px solid #ff0000",
                borderRadius: "4px",
                color: "#ff6b6b",
                fontSize: "14px",
              }}
            >
              {localError ?? error}
            </div>
          )}

          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <JRPGButton type="button" onClick={handleCancel} disabled={isLoading} variant="default">
              Cancel
            </JRPGButton>
            <JRPGButton
              type="submit"
              disabled={isLoading || (mode !== "revoke" && !password.trim())}
              variant={mode === "revoke" ? "danger" : "success"}
            >
              {isLoading
                ? mode === "elevate"
                  ? "Elevating..."
                  : mode === "bootstrap"
                    ? "Setting..."
                    : "Revoking..."
                : mode === "elevate"
                  ? "Elevate to DM"
                  : mode === "bootstrap"
                    ? "Set Password & Become DM"
                    : "Revoke DM Status"}
            </JRPGButton>
          </div>
        </form>
      </div>
    </div>
  );
}
