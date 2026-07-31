// ============================================================================
// SAVE AS A PRIVATE TABLE
// ============================================================================
// What the public test table offers instead of a password form. Its password is
// fixed — that is what keeps it open for everyone and un-padlockable — and it is
// wiped once it has sat empty, so the way to keep anything built here is to
// take a copy somewhere durable.
//
// The copy is a normal private table: its own password, its own DM password,
// never auto-cleared, and it carries the whole table across (map included). The
// test table is left exactly as it was.

import { useState } from "react";
import { JRPGPanel, JRPGButton } from "../../../../components/ui/JRPGPanel";

export interface SaveAsPrivateTableControlProps {
  /** Mints the copy and navigates to it. Rejects with a human-readable reason. */
  onSave: (input: { name: string; roomPassword: string; dmPassword?: string }) => Promise<void>;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: "44px",
  padding: "8px 10px",
  marginBottom: "8px",
  background: "rgba(9, 14, 30, 0.9)",
  border: "1px solid rgba(255, 215, 94, 0.4)",
  borderRadius: "6px",
  color: "#e7ecff",
  fontSize: "0.85rem",
};

export function SaveAsPrivateTableControl({ onSave }: SaveAsPrivateTableControlProps) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [dmPassword, setDmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Give the table a name so you can find it again.");
      return;
    }
    if (password.trim().length < 6) {
      setError("Table password needs at least 6 characters.");
      return;
    }
    if (dmPassword.trim() && dmPassword.trim().length < 8) {
      setError("DM password needs at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({
        name: trimmedName,
        roomPassword: password.trim(),
        dmPassword: dmPassword.trim() || undefined,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't save the table.");
    } finally {
      // `finally`, not just catch: the success path navigates away, but if that
      // is blocked the button must not stay stuck on "Saving…".
      setBusy(false);
    }
  };

  return (
    <JRPGPanel title="Save as a Private Table" variant="bevel">
      <p
        style={{
          margin: "0 0 12px",
          fontFamily: "var(--font-body)",
          fontSize: "0.85rem",
          lineHeight: 1.5,
          color: "#cbd5f5",
        }}
      >
        This is the public test table: its password is fixed so it stays open for everyone, and it
        is wiped once it has sat empty for an hour. Copy it to a private table of your own — the
        map, tokens and everything else come with it, and this table carries on untouched.
      </p>

      <label
        htmlFor="fork-name"
        style={{ display: "block", fontSize: "0.75rem", color: "#9fb0dd" }}
      >
        Table name
      </label>
      <input
        id="fork-name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setError(null);
        }}
        placeholder="Sunday Game"
        maxLength={60}
        style={inputStyle}
      />

      <label htmlFor="fork-pw" style={{ display: "block", fontSize: "0.75rem", color: "#9fb0dd" }}>
        Table password (6+ characters)
      </label>
      <input
        id="fork-pw"
        type="password"
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          setError(null);
        }}
        style={inputStyle}
      />

      <label htmlFor="fork-dm" style={{ display: "block", fontSize: "0.75rem", color: "#9fb0dd" }}>
        DM password (optional, 8+ characters)
      </label>
      <input
        id="fork-dm"
        type="password"
        value={dmPassword}
        onChange={(event) => {
          setDmPassword(event.target.value);
          setError(null);
        }}
        style={inputStyle}
      />

      {error && <p style={{ color: "#ff9d9d", fontSize: "0.8rem", margin: "0 0 8px" }}>{error}</p>}

      <JRPGButton
        onClick={() => void handleSubmit()}
        disabled={busy || !name.trim() || !password.trim()}
        variant="success"
      >
        {busy ? "Saving…" : "Save & Go There"}
      </JRPGButton>
    </JRPGPanel>
  );
}
