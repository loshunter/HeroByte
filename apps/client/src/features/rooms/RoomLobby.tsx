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
  roomUrl,
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

const chipButtonStyle: React.CSSProperties = {
  background: "rgba(20, 30, 58, 0.9)",
  color: "#e7ecff",
  border: "1px solid rgba(255, 215, 94, 0.4)",
  borderRadius: "6px",
  padding: "6px 10px",
  fontSize: "0.85rem",
  cursor: "pointer",
};

const smallButtonStyle: React.CSSProperties = {
  ...chipButtonStyle,
  padding: "6px 8px",
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
  const [remembered, setRemembered] = useState(() => listRememberedRooms());
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newRoomPassword, setNewRoomPassword] = useState("");
  const [newDmPassword, setNewDmPassword] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);

  const otherRooms = remembered.filter((room) => room.roomId !== activeRoomId);

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
      setCreateError("Room password needs at least 6 characters.");
      return;
    }
    if (dmPassword && dmPassword.length < 8) {
      setCreateError("DM password needs at least 8 characters.");
      return;
    }
    const roomId = generateRoomId();
    setCreateBusy(true);
    setCreateError(null);
    try {
      await onCreateRoom({ roomId, roomPassword, dmPassword: dmPassword || undefined });
      // Pre-seed the password so the new room authenticates the creator without
      // a second prompt, then navigate into it.
      stashRoomSecret(roomPassword);
      onNavigate(roomId);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Couldn't create the table.");
      setCreateBusy(false);
    }
  };

  const handleJoinByCode = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = joinCode.trim();
    if (!ROOM_ID_PATTERN.test(code)) {
      setJoinError("Table codes are letters, numbers, - and _ only.");
      return;
    }
    setJoinError(null);
    onNavigate(code);
  };

  const handleForget = (roomId: string) => {
    forgetRoom(roomId);
    setRemembered(listRememberedRooms());
  };

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl(activeRoomId));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div style={sectionStyle} data-testid="room-lobby">
      <p style={labelStyle}>Table</p>
      <div style={rowStyle}>
        <span style={{ fontSize: "0.9rem", color: "#e7ecff" }}>
          {activeRoomId ?? "Main Hall (default table)"}
        </span>
        <button type="button" style={smallButtonStyle} onClick={() => void handleCopyInvite()}>
          {copied ? "✓ Copied" : "Copy invite link"}
        </button>
        {activeRoomId && (
          <button type="button" style={smallButtonStyle} onClick={() => onNavigate(undefined)}>
            Back to Main Hall
          </button>
        )}
      </div>

      {otherRooms.length > 0 && (
        <>
          <p style={{ ...labelStyle, marginTop: "16px" }}>Your tables</p>
          <div style={rowStyle}>
            {otherRooms.map((room) => (
              <span key={room.roomId} style={{ display: "inline-flex", gap: "4px" }}>
                <button
                  type="button"
                  style={chipButtonStyle}
                  onClick={() => onNavigate(room.roomId)}
                >
                  {room.roomId}
                </button>
                <button
                  type="button"
                  aria-label={`Forget ${room.roomId}`}
                  style={smallButtonStyle}
                  onClick={() => handleForget(room.roomId)}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </>
      )}

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
              type="password"
              aria-label="New room password"
              value={newRoomPassword}
              onChange={(event) => setNewRoomPassword(event.target.value)}
              placeholder="Room password (6+ chars)"
              spellCheck={false}
              style={{
                background: "rgba(9, 14, 30, 0.9)",
                border: "1px solid rgba(255, 215, 94, 0.4)",
                borderRadius: "6px",
                color: "#e7ecff",
                padding: "6px 8px",
                fontSize: "0.85rem",
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
                padding: "6px 8px",
                fontSize: "0.85rem",
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
              padding: "6px 8px",
              fontSize: "0.85rem",
              width: "140px",
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
