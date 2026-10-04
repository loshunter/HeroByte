import React, { useState, useEffect, useRef } from "react";
import {
  EscapeRootProvider,
  useEscapeRoot,
  useEscapeOwner,
} from "../../interaction/useEscapeOwner";
import { JRPGButton } from "../../../components/ui/JRPGPanel";

interface DMElevationModalProps {
  isOpen: boolean;
  mode: "elevate" | "revoke" | "bootstrap";
  isLoading: boolean;
  error: string | null;
  currentIsDM: boolean;
  /**
   * The roster has this seat in it. REQUIRED: a socket close nulls the snapshot while the app
   * stays mounted, and `currentIsDM` reads false for that blip — which must not close a Leave
   * dialog nobody has answered.
   */
  roleKnown: boolean;
  onElevate: (password: string) => void;
  onBootstrap: (password: string) => void;
  onRevoke: () => void;
  onClose: () => void;
}

/**
 * Modal for entering and leaving DM mode, with proper loading states.
 *
 * Replaces native window.prompt() and window.confirm() dialogs with
 * a proper UI that shows loading feedback while waiting for server confirmation.
 *
 * Its words are the plan's (U9): **Enter DM mode** is a password gate; **Leave DM
 * mode** ends DM powers and is an ordinary confirm — it is not styled as danger,
 * because nothing at the table is deleted.
 */
export function DMElevationModal({
  isOpen,
  mode,
  isLoading,
  error,
  currentIsDM,
  roleKnown,
  onElevate,
  onBootstrap,
  onRevoke,
  onClose,
}: DMElevationModalProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  // A request in flight disables the field, and a disabled field drops the cursor:
  // after a wrong password the next keystroke went nowhere (Ctrl+A selected the page
  // behind the dialog) until the person clicked back in. When an attempt fails, put
  // the cursor back with the text selected, so the next try simply replaces it.
  const passwordRef = useRef<HTMLInputElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isLoading && error) {
      if (passwordRef.current) {
        passwordRef.current.focus();
        passwordRef.current.select();
      } else {
        // Leave DM mode has no field: both buttons were disabled while the request ran, so
        // focus fell to the page. Cancel (the first button) takes it back.
        actionsRef.current?.querySelector("button")?.focus();
      }
    }
  }, [isLoading, error]);

  // Close on the OUTCOME the dialog was opened for, with an error on screen or not: a late
  // answer (a leave the server heard after its five seconds, a frame the client flushed after an
  // outage) would otherwise leave a stale "timed out" under a dialog whose job is done.
  useEffect(() => {
    if (isLoading) return;
    // Successful elevation/bootstrap: currentIsDM becomes true
    if ((mode === "elevate" || mode === "bootstrap") && currentIsDM) {
      onClose();
      setPassword("");
      setConfirmPassword("");
      setLocalError(null);
    }
    // Successful revocation: mode is "revoke" and the roster says currentIsDM is false —
    // not merely that there is no roster (a reconnect blip).
    if (mode === "revoke" && roleKnown && !currentIsDM) {
      onClose();
    }
  }, [isLoading, currentIsDM, roleKnown, mode, onClose]);

  const handleCancel = () => {
    if (!isLoading) {
      setPassword("");
      setConfirmPassword("");
      setLocalError(null);
      onClose();
    }
  };

  const modalRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const escapeRoot = useEscapeRoot(modalRef, 3000);
  useEscapeOwner(() => ({
    kind: "modal",
    name: "DMElevationModal",
    active: isOpen,
    root: escapeRoot,
    anchor: modalRef.current,
    handle: isLoading ? undefined : handleCancel,
  }));

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
    <EscapeRootProvider value={escapeRoot}>
      <div
        ref={modalRef}
        data-modal-overlay=""
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
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          style={{
            backgroundColor: "#2a2a2a",
            border: "2px solid #4a4a4a",
            borderRadius: "8px",
            padding: "24px",
            // 400px of content plus padding and border is 452px outside, which
            // hung 38px off both edges of a 375px phone. Same outer widths on a
            // wide screen (452–552), clamped to the viewport on a narrow one.
            boxSizing: "border-box",
            minWidth: "min(452px, calc(100vw - 32px))",
            maxWidth: "min(552px, calc(100vw - 32px))",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id={titleId} style={{ marginTop: 0, marginBottom: "16px", color: "#fff" }}>
            {mode === "elevate"
              ? "Enter DM mode"
              : mode === "bootstrap"
                ? "Set the DM password"
                : "Leave DM mode"}
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
                  DM password
                </label>
                <input
                  id="dm-password"
                  ref={passwordRef}
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
                  This table doesn&apos;t have a DM password yet. Set one now — you&apos;ll enter DM
                  mode immediately, and anyone with this password can enter it later.
                </p>
                <label
                  htmlFor="dm-new-password"
                  style={{ display: "block", marginBottom: "8px", color: "#ccc" }}
                >
                  New DM password (8+ characters)
                </label>
                <input
                  id="dm-new-password"
                  ref={passwordRef}
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
                  Confirm DM password
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
                <p>Leave DM mode?</p>
                <p style={{ fontSize: "12px", color: "#999" }}>
                  You keep your character and your seat. The DM tools close, and the DM password
                  brings them back.
                </p>
              </div>
            )}

            {!roleKnown && (
              <p style={{ margin: "0 0 12px", color: "#ccc", fontSize: "12px" }}>
                Reconnecting… the table has not said who anyone is yet. Try again once it has.
              </p>
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

            <div
              ref={actionsRef}
              style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}
            >
              <JRPGButton
                type="button"
                onClick={handleCancel}
                disabled={isLoading}
                variant="default"
                // Leave DM mode has no field to autofocus: Cancel, the safe choice, takes focus
                // so a keyboard user is not left behind the dialog (the Table menu just closed).
                autoFocus={mode === "revoke"}
              >
                Cancel
              </JRPGButton>
              <JRPGButton
                type="submit"
                disabled={isLoading || !roleKnown || (mode !== "revoke" && !password.trim())}
                variant={mode === "revoke" ? "primary" : "success"}
              >
                {isLoading
                  ? mode === "elevate"
                    ? "Entering…"
                    : mode === "bootstrap"
                      ? "Setting…"
                      : "Leaving…"
                  : mode === "elevate"
                    ? "Enter DM mode"
                    : mode === "bootstrap"
                      ? "Set password & enter DM mode"
                      : "Leave DM mode"}
              </JRPGButton>
            </div>
          </form>
        </div>
      </div>
    </EscapeRootProvider>
  );
}
