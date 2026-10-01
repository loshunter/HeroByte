// ============================================================================
// HOST NEXT STEPS
// ============================================================================
// Right after a host creates a table they arrive as an ordinary player, with no
// hint that the next two things are entering DM mode and inviting people. This
// says so, in the tab that made the table and until it is dismissed, and offers
// both as buttons that do what the rest of the app already does: Enter DM mode
// opens the password dialog (NEVER elevating on its own — the DM password is
// still the gate, and a table created without one offers to set it there), and
// Invite copies the link (which never carries a password). Non-modal and
// dismissible: it covers a strip of the map, not a control, and nothing behind
// it is blocked.
//
// Invite WAITS for the host to claim the DM seat. On a table made without a DM
// password the first person to enter DM mode sets the password and becomes the DM,
// so an invitation sent before the host has claimed the seat could hand it to the
// first guest. Once they have been the DM it stays available, through leaving DM
// mode and through a restart that clears the elevation.
//
// The marker that says "this tab just made this table" is newTableMarker.ts.

import React, { useCallback, useEffect, useState } from "react";
import { JRPGButton } from "../../components/ui/JRPGPanel";
import { currentRoomId } from "../rooms/roomDirectory";
import { clearNewTable, markSeatClaimed, readNewTable, seatClaimed } from "./newTableMarker";
import type { TableMenuProps } from "./tableMenuProps";
import { useInviteLink } from "./useInviteLink";
import "./table.css";

interface HostNextStepsProps {
  menu: TableMenuProps;
  /** Desktop: where to park it, below the header. The phone's top stack leaves it in flow. */
  placement?: { top: number };
}

export const HostNextSteps: React.FC<HostNextStepsProps> = ({ menu, placement }) => {
  const roomId = currentRoomId();
  const [dismissed, setDismissed] = useState(() => !readNewTable(roomId));
  const [claimed, setClaimed] = useState(() => seatClaimed(roomId));
  const invite = useInviteLink();
  // The roster must have said so: a blip reads "not a DM", and only a known DM has claimed it.
  const holdsTheSeat = menu.roleKnown && menu.isDM;
  useEffect(() => {
    if (dismissed || !holdsTheSeat || claimed) return;
    markSeatClaimed(roomId);
    setClaimed(true);
  }, [dismissed, holdsTheSeat, claimed, roomId]);
  const mayInvite = menu.isDM || claimed;
  const dismiss = useCallback(() => {
    clearNewTable(roomId);
    setDismissed(true);
  }, [roomId]);

  // The roster must have arrived: a blip reads "not a DM", and a host who is
  // already DM should not be offered the step they have done.
  if (dismissed || !menu.roleKnown) return null;

  const card = (
    <section className="host-steps" aria-label="Next steps for the host">
      <div className="host-steps__head">
        <h3 className="host-steps__title">Your table is ready — next steps</h3>
        <JRPGButton onClick={dismiss} aria-label="Dismiss next steps" title="Dismiss">
          ✕
        </JRPGButton>
      </div>
      <ol className="host-steps__list">
        <li className="host-steps__step">
          {menu.isDM ? (
            <span className="host-steps__done">✓ You are the DM.</span>
          ) : (
            <>
              <JRPGButton variant="primary" onClick={() => menu.onToggleDM(true)}>
                Enter DM mode
              </JRPGButton>
              <span className="table-note">
                Run the game. You will be asked for the DM password, or to set one, if this table
                has none.
              </span>
            </>
          )}
        </li>
        <li className="host-steps__step">
          <JRPGButton
            onClick={() => void invite.copy()}
            disabled={!mayInvite}
            title={mayInvite ? undefined : "Enter DM mode first"}
          >
            {invite.copied ? "✓ Copied" : "Invite players"}
          </JRPGButton>
          <span className="table-note">
            {!mayInvite
              ? "Enter DM mode first: on a table with no DM password, whoever enters DM mode first becomes its DM."
              : invite.copied
                ? "Link copied. Send the table password separately — the link never carries it."
                : "Copies the link to this table. Players also need the table password."}
          </span>
          {invite.manual && (
            <input
              className="host-steps__manual"
              readOnly
              value={invite.manual}
              onFocus={(event) => event.currentTarget.select()}
              aria-label="Invite link — copy this manually"
              style={{ width: "100%", boxSizing: "border-box" }}
            />
          )}
        </li>
      </ol>
    </section>
  );

  if (!placement) return card;
  return (
    <div
      className="host-steps-dock"
      style={{
        position: "fixed",
        top: placement.top,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 150,
        width: "min(92vw, 440px)",
        pointerEvents: "none",
      }}
    >
      {card}
    </div>
  );
};
