// ============================================================================
// PUBLIC TABLE NOTICE
// ============================================================================
// The default table (Main Hall) is a shared scratch space: its password is the
// server's documented default, so anyone who has read the README is already in
// it. The server wipes it once it has sat empty (see Container.clearIdleDefaultRoom),
// which keeps its asset quota from filling — but that is invisible from the
// table itself, so people were free to mistake a public, self-clearing space
// for somewhere to keep a campaign.
//
// Two presentations of the same fact:
//   "gate"  — on the join screen, before anyone commits to entering.
//   "chip"  — a compact marker at the table, for anyone who bookmarked the URL
//             and never saw the gate.

import React from "react";

interface PublicTableNoticeProps {
  variant: "gate" | "chip";
}

export const PUBLIC_TABLE_HEADLINE = "Public test table";

export const PublicTableNotice: React.FC<PublicTableNoticeProps> = ({ variant }) => {
  if (variant === "chip") {
    return (
      <div
        data-testid="public-table-chip"
        title="Main Hall is a shared public space. It clears itself once empty — create a private table for a real game."
        style={{
          position: "fixed",
          top: "26px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 199,
          background: "var(--jrpg-navy, #16162b)",
          color: "var(--jrpg-gold, #f0e2c3)",
          padding: "3px 10px",
          fontSize: "7px",
          fontFamily: "'Press Start 2P', monospace",
          border: "2px solid var(--jrpg-border-outer, #f0e2c3)",
          borderTop: "none",
          borderRadius: "0 0 8px 8px",
          whiteSpace: "nowrap",
          pointerEvents: "auto",
        }}
      >
        ⚠ PUBLIC TEST TABLE — CLEARS WHEN EMPTY
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
        ⚠ {PUBLIC_TABLE_HEADLINE.toUpperCase()}
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
        The Main Hall is a shared space for trying things out — its password is public, so anyone
        can wander in, and everything left here is deleted once the table sits empty. Running a real
        game? Create a private table below.
      </p>
    </div>
  );
};
