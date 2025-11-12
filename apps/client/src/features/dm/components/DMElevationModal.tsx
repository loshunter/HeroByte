import React, { useState, useEffect } from "react";
import { JRPGButton } from "../../../components/ui/JRPGPanel";

interface DMElevationModalProps {
  isOpen: boolean;
  mode: "elevate" | "revoke";
  isLoading: boolean;
  error: string | null;
  currentIsDM: boolean;
  onElevate: (password: string) => void;
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
  onRevoke,
  onClose,
}: DMElevationModalProps) {
  const [password, setPassword] = useState("");

  // Close modal on successful state change
  useEffect(() => {
    if (!isLoading && !error) {
      // Successful elevation: mode is "elevate" and currentIsDM becomes true
      if (mode === "elevate" && currentIsDM) {
        onClose();
        setPassword("");
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
    } else {
      onRevoke();
    }
  };

  const handleCancel = () => {
    if (!isLoading) {
      setPassword("");
      onClose();
    }
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
        zIndex: 1000,
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
          {mode === "elevate" ? "Elevate to DM" : "Revoke DM Status"}
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
                style={{
                  width: "100%",
                  padding: "8px",
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #4a4a4a",
                  borderRadius: "4px",
                  color: "#fff",
                  fontSize: "14px",
                }}
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

          {error && (
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
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <JRPGButton type="button" onClick={handleCancel} disabled={isLoading} variant="default">
              Cancel
            </JRPGButton>
            <JRPGButton
              type="submit"
              disabled={isLoading || (mode === "elevate" && !password.trim())}
              variant={mode === "elevate" ? "success" : "danger"}
            >
              {isLoading
                ? mode === "elevate"
                  ? "Elevating..."
                  : "Revoking..."
                : mode === "elevate"
                  ? "Elevate to DM"
                  : "Revoke DM Status"}
            </JRPGButton>
          </div>
        </form>
      </div>
    </div>
  );
}
