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
} from "./roomDirectory";

export interface RoomLobbyProps {
  /** Overridable for tests; defaults to a full page navigation. */
  onNavigate?: (roomId: string | undefined) => void;
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

export function RoomLobby({ onNavigate = navigateToRoom }: RoomLobbyProps): JSX.Element {
  const activeRoomId = useMemo(() => currentRoomId(), []);
  const [remembered, setRemembered] = useState(() => listRememberedRooms());
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const otherRooms = remembered.filter((room) => room.roomId !== activeRoomId);

  const handleNewTable = () => {
    onNavigate(generateRoomId());
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
