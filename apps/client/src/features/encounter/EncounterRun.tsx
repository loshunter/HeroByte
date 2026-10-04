// ============================================================================
// ENCOUNTER — RUN
// ============================================================================
// Start and end the fight, move the turn, and say whose it is (U8). Every
// button sends a message the server already had; nothing here changes who may
// do what (anyone may advance a turn; only the DM starts or ends a fight).
//
// Two server rules are NAMED here rather than assumed away (the characterization
// in apps/server/.../encounterRules.characterization.test.ts pins both):
// any initiative saved while no fight is running starts combat on THAT
// character's turn (after End combat too: the old initiatives stay) — so a
// fight can begin with the turn below the top of the order — and start-combat
// mid-fight moves the turn to the top, restarts the round and refills
// everyone's movement. The client cannot tell an auto-started fight from one
// advanced by an ordinary NEXT (the round is not on the wire), so the note
// below says what is true in both cases and blames nothing.

import { JRPGButton } from "../../components/ui/JRPGPanel";
import { TurnNavigationControls } from "../initiative/components/TurnNavigationControls";
import type { EncounterRoster } from "./encounterRoster";

interface EncounterRunProps {
  roster: EncounterRoster;
  combatActive: boolean;
  onStartCombat: () => void;
  onEndCombat: () => void;
  onNextTurn: () => void;
  onPreviousTurn: () => void;
}

export function EncounterRun({
  roster,
  combatActive,
  onStartCombat,
  onEndCombat,
  onNextTurn,
  onPreviousTurn,
}: EncounterRunProps) {
  const { order, turnIndex } = roster;
  const holder = turnIndex >= 0 ? order[turnIndex] : undefined;
  const top = order[0];

  if (!combatActive) {
    return (
      <div className="encounter-section__body">
        <p className="encounter-note">No fight is running.</p>
        <JRPGButton variant="primary" onClick={onStartCombat}>
          ⚔️ Start combat
        </JRPGButton>
        <p className="encounter-note">
          {top
            ? `The turn goes to the top of the order: ${top.character.name}.`
            : "Nobody has an initiative yet: the turn waits for the first one."}{" "}
          Or roll: any initiative saved while no fight is running starts one, on that
          character&apos;s turn — after End combat too, since the old initiatives stay.
        </p>
      </div>
    );
  }

  return (
    <div className="encounter-section__body">
      <p className="encounter-status" role="status">
        ⚔️ Combat active ·{" "}
        {holder
          ? `Turn ${turnIndex + 1} of ${order.length}: ${holder.character.name}`
          : order.length > 0
            ? `Turn — of ${order.length}: nobody holds the turn`
            : "nobody is in the order yet"}
      </p>
      <TurnNavigationControls
        combatActive={true}
        onNextTurn={onNextTurn}
        onPreviousTurn={onPreviousTurn}
      />
      {holder && top && holder !== top && (
        <p className="encounter-note">
          {`It is ${holder.character.name}'s turn; ${top.character.name} is at the top of the order. A fight started by saving an initiative begins on that character's turn, not at the top.`}
        </p>
      )}
      {top && (
        <>
          <JRPGButton onClick={onStartCombat}>⏮ Start at top of order</JRPGButton>
          <p className="encounter-note">
            {`Moves the turn to ${top.character.name}, starts the round over and refills everyone's movement.`}
          </p>
        </>
      )}
      <JRPGButton onClick={onEndCombat}>🏁 End combat</JRPGButton>
      <p className="encounter-note">Ending keeps every initiative on file.</p>
    </div>
  );
}
