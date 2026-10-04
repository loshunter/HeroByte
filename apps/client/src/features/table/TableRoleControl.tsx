// ============================================================================
// TABLE ROLE
// ============================================================================
// Your role at this table — player or Dungeon Master — and the way to change it.
// It lives with the TABLE, not with a character: it used to be a section at the
// bottom of a character's settings window, which a new host had to know to
// open. The control is only a launcher: Enter DM mode and Leave DM mode both
// open the existing password / confirm dialog (DMElevationModal), so the
// password, the wrong-password error and the server's answer are unchanged.
//
// `isDM` is passed in and `roleKnown` says whether to trust it. Every socket
// close nulls the snapshot while the app stays mounted, and for that blip the
// snapshot-derived role reads "not a DM": a judgement taken then is wrong, so
// the control waits for the roster rather than offering a DM the wrong button.

import React from "react";
import { JRPGButton } from "../../components/ui/JRPGPanel";
import "./table.css";

export interface TableRoleControlProps {
  isDM: boolean;
  /** The viewer's seat is in the roster: the app's own test that the snapshot has arrived. */
  roleKnown: boolean;
  onToggleDM: (next: boolean) => void;
}

export const TableRoleControl: React.FC<TableRoleControlProps> = ({
  isDM,
  roleKnown,
  onToggleDM,
}) => {
  if (!roleKnown) {
    return (
      <div className="table-role">
        <p className="table-role__state">Reconnecting…</p>
        <JRPGButton disabled>Enter DM mode</JRPGButton>
        <p className="table-note table-note--soft">
          Your role shows again as soon as the table is back.
        </p>
      </div>
    );
  }

  return (
    <div className="table-role">
      <p className="table-role__state">
        {isDM ? "You are the Dungeon Master." : "You are a player."}
      </p>
      {isDM ? (
        <>
          <JRPGButton onClick={() => onToggleDM(false)}>Leave DM mode</JRPGButton>
          <p className="table-note">
            You keep your character and your seat. The DM tools close; the DM password brings them
            back.
          </p>
        </>
      ) : (
        <>
          <JRPGButton variant="primary" onClick={() => onToggleDM(true)}>
            Enter DM mode
          </JRPGButton>
          <p className="table-note">
            Runs the game: the map, NPCs, combat and this table&rsquo;s settings. You will be asked
            for the DM password, or to set one if this table has none; your character stays yours.
          </p>
        </>
      )}
    </div>
  );
};
