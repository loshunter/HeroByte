// ============================================================================
// PUBLIC TABLE NOTICE
// ============================================================================
// The default table (Main Hall) opens with the server's Main Hall password: the
// one published in the setup docs unless the host set its own, so out of the box
// anyone who has read the README is already in it. The client cannot see which,
// so the copy names neither as fact. The server wipes it once it has sat empty
// (an hour by default; Container.clearIdleDefaultRoom), which
// keeps its asset quota from filling — but none of that is visible from the
// table, so it looked like a fine place to keep a campaign.
//
// Its password is FIXED (the server refuses a change there) so nobody can padlock
// the one table every server publishes, and the flag is set at boot for that table
// alone. The copy's job is to name the way to keep what is built here: copy the
// table to a private one of your own (KEEP_PATH), not just to warn.
//
// Two presentations of the same fact:
//   "gate"  — on the join screen, BEFORE authentication, so there is no snapshot
//             to consult.
//   "chip"  — at the table, driven by the snapshot flag: a row of the header on a
//             desktop, a member of the top stack on a phone.

import React from "react";

interface PublicTableNoticeProps {
  variant: "gate" | "chip";
}

const KEEP_PATH = "DM Menu → Table → Security → Save as a Private Table";

export const PublicTableNotice: React.FC<PublicTableNoticeProps> = ({ variant }) => {
  if (variant === "chip") {
    return (
      <div
        data-testid="public-table-chip"
        // Presentation is in herobyte.css: one readable (11px) chip for both layouts. It is
        // a row of the header's own flow on a desktop and a member of the top stack on a
        // phone, so its width no longer decides which buttons can be clicked.
        className="public-table-chip"
        title={`Anyone with the Main Hall password can join this table, and it is wiped once it has sat empty (an hour by default). To keep what you build here, copy it to a private table of your own: ${KEEP_PATH}.`}
      >
        ⚠ PUBLIC TEST TABLE — CLEARS WHEN EMPTY · SAVE IT TO KEEP IT
      </div>
    );
  }

  return (
    <div
      data-testid="public-table-notice"
      style={{
        margin: "0 0 20px",
        padding: "12px 14px",
        borderRadius: "8px",
        border: "1px solid rgba(240, 226, 195, 0.35)",
        background: "rgba(240, 226, 195, 0.08)",
        textAlign: "left",
      }}
    >
      <p
        style={{
          margin: "0 0 6px",
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "8px",
          color: "var(--jrpg-gold, #f0e2c3)",
          lineHeight: 1.6,
        }}
      >
        ⚠ PUBLIC TEST TABLE
      </p>
      <p
        style={{
          margin: 0,
          color: "#cbd5f5",
          fontFamily: "var(--font-body)",
          fontSize: "0.85rem",
          lineHeight: 1.5,
        }}
      >
        The Main Hall is everyone&apos;s scratch space. Its password is the server&apos;s setting —
        the one in the setup docs unless the host changed it — and cannot be changed here, and the
        server wipes the table once it has sat empty (an hour by default). Build here freely; to
        keep any of it, save the table as a private table of your own ({KEEP_PATH}), or start one
        below.
      </p>
    </div>
  );
};
