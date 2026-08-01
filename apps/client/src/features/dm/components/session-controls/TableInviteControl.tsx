// ============================================================================
// TABLE INVITE
// ============================================================================
// Sharing a table belongs INSIDE it. This used to live on the login screen,
// where it could only ever copy the bare site URL (no ?room= yet, so the room
// param was deleted) — i.e. the homepage, an invite to nothing — or a link you
// must already have had to be looking at it. Meanwhile a DM who had just
// created a table had to leave it to find the link at all.
//
// Reads the room id from the URL and the name from the browser's table shelf,
// so it needs no props threaded through the DM-menu chain.

import { useState } from "react";
import { JRPGPanel, JRPGButton } from "../../../../components/ui/JRPGPanel";
import { currentRoomId, listRememberedRooms, roomUrl } from "../../../rooms/roomDirectory";

const valueStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  marginBottom: "8px",
  background: "rgba(9, 14, 30, 0.9)",
  border: "1px solid rgba(255, 215, 94, 0.4)",
  borderRadius: "6px",
  color: "#e7ecff",
  fontSize: "0.8rem",
  wordBreak: "break-all",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  color: "#9fb0dd",
  marginBottom: "2px",
};

export function TableInviteControl() {
  const roomId = currentRoomId();
  const name = listRememberedRooms().find((room) => room.roomId === roomId)?.name;
  const link = roomUrl(roomId);
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState<string | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setManual(null);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // navigator.clipboard is undefined on non-secure origins — which is
      // exactly the "share my LAN IP with my players" case, http://192.168.x.x.
      // Show the link so it can be copied by hand rather than failing silently.
      setCopied(false);
      setManual(link);
    }
  };

  return (
    <JRPGPanel title="Invite Players" variant="simple">
      <span style={labelStyle}>Table</span>
      <code style={valueStyle}>
        {roomId ? (name ? `${name} (${roomId})` : roomId) : "Main Hall — public test table"}
      </code>

      <span style={labelStyle}>Invite link</span>
      <code style={valueStyle}>{link}</code>

      <JRPGButton onClick={() => void handleCopy()} variant="primary">
        {copied ? "✓ Copied" : "Copy invite link"}
      </JRPGButton>

      {manual && (
        <input
          readOnly
          value={manual}
          onFocus={(event) => event.currentTarget.select()}
          aria-label="Invite link — copy this manually"
          style={{ ...valueStyle, marginTop: "8px" }}
        />
      )}

      <p
        style={{
          margin: "10px 0 0",
          fontFamily: "var(--font-body)",
          fontSize: "0.8rem",
          lineHeight: 1.5,
          color: "#cbd5f5",
        }}
      >
        {roomId
          ? "The link doesn't carry the password — send that separately."
          : "Anyone can reach this table: its password is the one published in the setup docs."}
      </p>
    </JRPGPanel>
  );
}
