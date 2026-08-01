// ============================================================================
// ROOM LOBBY
// ============================================================================
// The table shelf shown on the auth gate: which table you're joining, the
// tables this browser remembers, a NEW TABLE mint, and join-by-code. Room
// switches are full navigations (fresh socket, fresh auth).

import React, { useMemo, useState } from "react";
import {
  ROOM_ID_PATTERN,
  currentRoomId,
  forgetRoom,
  generateRoomId,
  listRememberedRooms,
  navigateToRoom,
  rememberRoom,
  stashRoomSecret,
} from "./roomDirectory";
import type { CreateRoomInput } from "./useCreateRoom";

export interface RoomLobbyProps {
  /** Overridable for tests; defaults to a full page navigation. */
  onNavigate?: (roomId: string | undefined) => void;
  /**
   * Mint a private table. When provided, "New Table" opens a password form and
   * the created room auto-authenticates the creator on the next page load.
   */
  onCreateRoom?: (input: CreateRoomInput) => Promise<void>;
}

const sectionStyle: React.CSSProperties = {
  marginTop: "20px",
  paddingTop: "16px",
  borderTop: "1px solid rgba(255, 215, 94, 0.25)",
  textAlign: "left",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};

// Touch-target floor: every control is ≥44px in its smaller dimension.
const chipButtonStyle: React.CSSProperties = {
  background: "rgba(20, 30, 58, 0.9)",
  color: "#e7ecff",
  border: "1px solid rgba(255, 215, 94, 0.4)",
  borderRadius: "6px",
  boxSizing: "border-box",
  padding: "6px 12px",
  minHeight: "44px",
  fontSize: "0.85rem",
  cursor: "pointer",
};

// Compact / icon-only buttons (✕ forget, ↻) stay ≥44×44 so they're tappable.
const smallButtonStyle: React.CSSProperties = {
  ...chipButtonStyle,
  padding: "6px 8px",
  minWidth: "44px",
};

// Inputs share the 44px floor.
const lobbyInputStyle: React.CSSProperties = {
  boxSizing: "border-box",
  minHeight: "44px",
  padding: "10px 12px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#9fb0dd",
  margin: "0 0 8px",
};

export function RoomLobby({
  onNavigate = navigateToRoom,
  onCreateRoom,
}: RoomLobbyProps): JSX.Element {
  const activeRoomId = useMemo(() => currentRoomId(), []);
  const [, setRemembered] = useState(() => listRememberedRooms());
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [newRoomPassword, setNewRoomPassword] = useState("");
  const [newDmPassword, setNewDmPassword] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  const handleNewTable = () => {
    // Without a create handler (e.g. in tests) fall back to a plain new-room
    // navigation; otherwise open the private-table password form.
    if (!onCreateRoom) {
      onNavigate(generateRoomId());
      return;
    }
    setCreateError(null);
    setCreating((open) => !open);
  };

  const handleCreateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onCreateRoom || createBusy) return;
    const roomPassword = newRoomPassword.trim();
    const dmPassword = newDmPassword.trim();
    if (roomPassword.length < 6) {
      setCreateError("Table password needs at least 6 characters.");
      return;
    }
    if (dmPassword && dmPassword.length < 8) {
      setCreateError("DM password needs at least 8 characters.");
      return;
    }
    const roomId = generateRoomId();
    const name = newTableName.trim();
    setCreateBusy(true);
    setCreateError(null);
    try {
      await onCreateRoom({ roomId, roomPassword, dmPassword: dmPassword || undefined, name });
      // Pre-seed the password so the new room authenticates the creator without
      // a second prompt, then navigate into it. Scoped to the room we just
      // minted, not to whatever table the URL currently names.
      stashRoomSecret(roomPassword, roomId);
      // Remember the name now: the picker has to label this table on the very
      // next load, before any snapshot has arrived to tell us what it's called.
      rememberRoom(roomId, name);
      onNavigate(roomId);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Couldn't create the table.");
    } finally {
      // `finally`, not just the catch: on the success path we navigate away, but
      // if navigation is stubbed or blocked the button must not stay stuck on
      // "Creating..." with no way back except a reload.
      setCreateBusy(false);
    }
  };

  const handleJoinByCode = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = joinCode.trim();
    if (!ROOM_ID_PATTERN.test(code)) {
      // State the rule ROOM_ID_PATTERN actually enforces. The old message
      // omitted the leading-character and length rules, so pasting a code
      // starting with "-" told you it contained characters it did not contain.
      setJoinError(
        "Table codes start with a letter or number, then letters, numbers, - or _ (max 64).",
      );
      return;
    }
    setJoinError(null);
    onNavigate(code);
  };

  const handleForget = (roomId: string) => {
    // The server exposes no room listing by design, so this list is the ONLY
    // in-app record that a private table exists. Forgetting it leaves the code
    // recoverable from browser history and nowhere else — and the ✕ sits a few
    // pixels from the join chip.
    if (!window.confirm(`Forget "${roomId}"? You'll need the table code to get back in.`)) {
      return;
    }
    forgetRoom(roomId);
    setRemembered(listRememberedRooms());
  };

  return (
    <div style={sectionStyle} data-testid="room-lobby">
      {/* Which table you're joining is the picker's job now, directly above the
          password field. What's left here are the actions AROUND that choice.
          Inviting is NOT one of them: before you have joined anything there is
          no ?room= yet, so the link could only be the bare site URL — an invite
          to nothing. It lives in DM Menu → Session now (TableInviteControl). */}
      <div style={rowStyle}>
        {activeRoomId && (
          <button
            type="button"
            aria-label={`Forget ${activeRoomId}`}
            style={smallButtonStyle}
            onClick={() => handleForget(activeRoomId)}
          >
            Forget this table
          </button>
        )}
      </div>

      <p style={{ ...labelStyle, marginTop: "16px" }}>Start or join</p>
      <div style={rowStyle}>
        <button type="button" style={chipButtonStyle} onClick={handleNewTable}>
          ▦ New Table
        </button>
        {creating && onCreateRoom && (
          <form
            onSubmit={handleCreateSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}
          >
            <input
              aria-label="New table name"
              value={newTableName}
              onChange={(event) => setNewTableName(event.target.value)}
              placeholder="Table name (e.g. Sunday Game)"
              maxLength={60}
              style={{
                background: "rgba(9, 14, 30, 0.9)",
                border: "1px solid rgba(255, 215, 94, 0.4)",
                borderRadius: "6px",
                color: "#e7ecff",
                fontSize: "0.85rem",
                ...lobbyInputStyle,
              }}
            />
            <input
              type="password"
              aria-label="New table password"
              value={newRoomPassword}
              onChange={(event) => setNewRoomPassword(event.target.value)}
              placeholder="Table password (6+ chars)"
              spellCheck={false}
              style={{
                background: "rgba(9, 14, 30, 0.9)",
                border: "1px solid rgba(255, 215, 94, 0.4)",
                borderRadius: "6px",
                color: "#e7ecff",
                fontSize: "0.85rem",
                ...lobbyInputStyle,
              }}
            />
            <input
              type="password"
              aria-label="New DM password"
              value={newDmPassword}
              onChange={(event) => setNewDmPassword(event.target.value)}
              placeholder="DM password (optional, 8+ chars)"
              spellCheck={false}
              style={{
                background: "rgba(9, 14, 30, 0.9)",
                border: "1px solid rgba(255, 215, 94, 0.4)",
                borderRadius: "6px",
                color: "#e7ecff",
                fontSize: "0.85rem",
                ...lobbyInputStyle,
              }}
            />
            <button
              type="submit"
              style={{ ...chipButtonStyle, opacity: createBusy ? 0.6 : 1 }}
              disabled={createBusy || !newRoomPassword.trim()}
            >
              {createBusy ? "Creating…" : "Create private table"}
            </button>
            {createError && (
              <p style={{ color: "#ff9d9d", fontSize: "0.8rem", margin: "2px 0 0" }}>
                {createError}
              </p>
            )}
          </form>
        )}
        <form onSubmit={handleJoinByCode} style={{ display: "inline-flex", gap: "6px" }}>
          <input
            aria-label="Table code"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
            placeholder="table code"
            spellCheck={false}
            style={{
              background: "rgba(9, 14, 30, 0.9)",
              border: "1px solid rgba(255, 215, 94, 0.4)",
              borderRadius: "6px",
              color: "#e7ecff",
              fontSize: "0.85rem",
              width: "140px",
              ...lobbyInputStyle,
            }}
          />
          <button type="submit" style={smallButtonStyle} disabled={!joinCode.trim()}>
            Join
          </button>
        </form>
      </div>
      {joinError && (
        <p style={{ color: "#ff9d9d", fontSize: "0.8rem", margin: "8px 0 0" }}>{joinError}</p>
      )}
    </div>
  );
}
