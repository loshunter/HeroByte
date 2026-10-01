// ============================================================================
// TABLE INVITE
// ============================================================================
// Sharing a table belongs INSIDE it. This used to live on the login screen,
// where it could only ever copy the bare site URL (no ?room= yet, so the room
// param was deleted) — i.e. the homepage, an invite to nothing — or a link you
// must already have had to be looking at it. Meanwhile a DM who had just
// created a table had to leave it to find the link at all.
//
// The link and the copy are useInviteLink's, shared with the next steps a host
// sees right after creating a table. The table's name is the snapshot's when it
// is passed (every member's browser learns it), else what this browser's table
// shelf remembered — a DM who joined by link has no shelf entry.

import { JRPGPanel, JRPGButton } from "../../../components/ui/JRPGPanel";
import { listRememberedRooms } from "../../rooms/roomDirectory";
import { useInviteLink } from "../useInviteLink";

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

export function TableInviteControl({ tableName }: { tableName?: string }) {
  const { roomId, link, copied, manual, copy } = useInviteLink();
  const name = tableName ?? listRememberedRooms().find((room) => room.roomId === roomId)?.name;

  return (
    <JRPGPanel variant="simple">
      <span style={labelStyle}>Table</span>
      <code style={valueStyle}>
        {roomId ? (name ? `${name} (${roomId})` : roomId) : "Main Hall — public test table"}
      </code>

      <span style={labelStyle}>Invite link</span>
      <code style={valueStyle}>{link}</code>

      <JRPGButton onClick={() => void copy()} variant="primary">
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
          ? "Players open the link and enter the table password. The link never carries the password, so send it separately."
          : "Anyone can reach this table: its password is the one published in the setup docs."}
      </p>
    </JRPGPanel>
  );
}
