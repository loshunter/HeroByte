// ============================================================================
// PUBLIC TABLE NOTICE
// ============================================================================
// The default table (Main Hall) opens with the password published in the setup
// docs, so out of the box anyone who has read the README is already in it. The
// server wipes it once it has sat empty (Container.clearIdleDefaultRoom), which
// keeps its asset quota from filling — but none of that is visible from the
// table, so it looked like a fine place to keep a campaign.
//
// "Public" is NOT a property of the room id: it is true only while the password
// is still the published one. Setting any other password claims the table — the
// server stops clearing it and stops flagging it — so the copy's job is to name
// that escape hatch, not just to warn.
//
// Two presentations of the same fact:
//   "gate"  — on the join screen, BEFORE authentication, so there is no snapshot
//             to consult. Its copy states the rule conditionally ("while it
//             still uses that password"), which is true whether or not the
//             table has already been claimed.
//   "chip"  — at the table, driven by the live snapshot flag, so it disappears
//             the moment someone claims the table.

import React from "react";

interface PublicTableNoticeProps {
  variant: "gate" | "chip";
}

const KEEP_PATH = "DM Menu → Session → Save as a private table";

export const PublicTableNotice: React.FC<PublicTableNoticeProps> = ({ variant }) => {
  if (variant === "chip") {
    return (
      <div
        data-testid="public-table-chip"
        // Presentation is in herobyte.css, because the phone needs a readable
        // version of this and the desktop cannot have one: enlarging the chip
        // for both widened it across the header's buttons.
        className="public-table-chip"
        title={`Anyone with the published password can join this table, and it is wiped once it has sat empty for an hour. To keep what you build here, copy it to a private table of your own: ${KEEP_PATH}.`}
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
        The Main Hall is everyone&apos;s scratch space. Its password is published in the setup docs
        and cannot be changed — so it always stays open — and the server wipes it once it has sat
        empty for an hour. Build here freely; to keep any of it, save the table as a private table
        of your own ({KEEP_PATH}), or start one below.
      </p>
    </div>
  );
};
