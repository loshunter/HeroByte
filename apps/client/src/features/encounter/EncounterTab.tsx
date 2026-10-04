// ============================================================================
// ENCOUNTER TAB
// ============================================================================
// DM tools → Encounter (U8, plan §2.1): prepare a fight, roll initiative, run
// the turns and end it, from one place. A COMPOSITION of controls that already
// existed — Players' combat buttons and Monster HP, NPCs' Roll Missing
// Initiative — moved here, not copied: the old tabs no longer carry them, and
// every button sends the message it always did. Its rows open the SHARED
// initiative dialog, a door beside the card's INIT (which stays).
//
// Setup: an add-NPCs shortcut (forwards to NPCs & Monsters, where adding
//   lives), the participant list in the server's order, Monster HP.
// Initiative: roll the NPCs' missing initiative, clear all, and the table's
//   hand-entry policy (it lives in Table → Permissions; this links there).
// Run encounter: start/end, previous/next, whose turn (EncounterRun).

import { useMemo } from "react";
import { MONSTER_HP_DISPLAY_MODES } from "@herobyte/shared";
import { JRPGButton } from "../../components/ui/JRPGPanel";
import { useBulkInitiativeRoll } from "../../hooks/useBulkInitiativeRoll";
import { useInitiativeDialog } from "../initiative/useInitiativeDialog";
import { buildEncounterRoster, type EncounterParticipant } from "./encounterRoster";
import { EncounterParticipantRow } from "./EncounterParticipantRow";
import { EncounterRun } from "./EncounterRun";
import type { EncounterControls } from "./encounterControls";
import "./encounter.css";

export interface EncounterTabProps {
  controls: EncounterControls;
  /** The viewer's DM flag, passed in (never read off the snapshot). */
  isDM: boolean;
  /** Forward to the tab that owns a thing Encounter only links to. */
  onOpenTab: (tab: "npcs" | "table") => void;
  toast?: { success: (message: string) => void; error: (message: string) => void };
}

const HP_MODE_LABEL = { exact: "Exact", bloodied: "Bloodied", hidden: "Hidden" } as const;

/** What the choice means at the table (U9): what players SEE, not how the server enforces it. */
const HP_MODE_OUTCOME = {
  exact: "Players see the exact HP of every NPC they can see.",
  bloodied:
    "Players see 🩸 Bloodied at half HP or below, and Healthy above it, on every NPC they can see — never the numbers. Player characters always show exact HP.",
  hidden:
    "Players see ??? in place of HP on every NPC they can see — never the numbers. Player characters always show exact HP.",
} as const;

export function EncounterTab({ controls, isDM, onOpenTab, toast }: EncounterTabProps) {
  const { characters, players, combatActive, currentTurnCharacterId, initiative } = controls;
  const roster = useMemo(
    () => buildEncounterRoster(characters, players, combatActive, currentTurnCharacterId),
    [characters, players, combatActive, currentTurnCharacterId],
  );
  const dialog = useInitiativeDialog({
    characters,
    players,
    uid: controls.uid,
    isDM,
    initiative,
    // The DM always may; the table policy is for players.
    manualEntryAllowed: true,
    combatActive,
  });

  const npcs = useMemo(() => characters.filter((c) => c.type === "npc"), [characters]);
  const missingNpcs = npcs.filter((npc) => npc.initiative === undefined).length;
  const { rollAllInitiative } = useBulkInitiativeRoll(npcs, initiative.rollAllInitiative);
  const rollMissing = () => {
    const count = rollAllInitiative();
    if (count > 0) toast?.success(`Rolled initiative for ${count} NPC${count === 1 ? "" : "s"}`);
  };

  const row = (participant: EncounterParticipant) => {
    const { character } = participant;
    const tokenId = character.tokenId;
    return (
      <EncounterParticipantRow
        key={character.id}
        participant={participant}
        onSetInitiative={() => dialog.open(character)}
        onRoll={() => initiative.rollInitiative(character.id)}
        onRemoveFromOrder={() => initiative.clearInitiative(character.id)}
        onFocus={
          tokenId && controls.mapTokenIds.has(tokenId)
            ? () => controls.onFocusToken(tokenId)
            : undefined
        }
      />
    );
  };

  return (
    <div className="encounter">
      <section className="encounter-section" aria-labelledby="encounter-setup">
        <h4 id="encounter-setup" className="jrpg-text-command encounter-section__title">
          Setup
        </h4>
        <div className="encounter-section__body">
          <JRPGButton variant="success" onClick={() => onOpenTab("npcs")}>
            + Add NPCs…
          </JRPGButton>
          <p className="encounter-note">
            Adding, placing, hiding and editing NPCs lives in NPCs &amp; Monsters.
          </p>
          <h5 className="encounter-subtitle">In the order ({roster.order.length})</h5>
          {roster.order.length === 0 ? (
            <p className="encounter-note">Nobody has an initiative yet.</p>
          ) : (
            <ol className="encounter-list" aria-label="In the order">
              {roster.order.map(row)}
            </ol>
          )}
          {roster.waiting.length > 0 && (
            <>
              <h5 className="encounter-subtitle">Not rolled yet ({roster.waiting.length})</h5>
              <ul className="encounter-list" aria-label="Not rolled yet">
                {roster.waiting.map(row)}
              </ul>
            </>
          )}
          <h5 className="encounter-subtitle">Monster HP players see</h5>
          <div role="group" aria-label="Monster HP players see" className="encounter-row-buttons">
            {MONSTER_HP_DISPLAY_MODES.map((mode) => (
              <JRPGButton
                key={mode}
                onClick={() => controls.onMonsterHpDisplayChange(mode)}
                variant={controls.monsterHpDisplay === mode ? "primary" : "default"}
                aria-pressed={controls.monsterHpDisplay === mode}
              >
                {HP_MODE_LABEL[mode]}
              </JRPGButton>
            ))}
          </div>
          <p className="encounter-note" aria-live="polite">
            {HP_MODE_OUTCOME[controls.monsterHpDisplay]}
          </p>
        </div>
      </section>

      <section className="encounter-section" aria-labelledby="encounter-initiative">
        <h4 id="encounter-initiative" className="jrpg-text-command encounter-section__title">
          Initiative
        </h4>
        <div className="encounter-section__body">
          <JRPGButton variant="primary" onClick={rollMissing} disabled={missingNpcs === 0}>
            🎲 Roll missing NPC initiative
          </JRPGButton>
          <p className="encounter-note">
            {npcs.length === 0
              ? "There are no NPCs yet."
              : missingNpcs === 0
                ? "Every NPC has an initiative."
                : `Rolls now for the ${missingNpcs} NPC${missingNpcs === 1 ? "" : "s"} without one; nobody else is re-rolled.`}{" "}
            Players roll their own characters from INIT on their card, or ⚔️ INIT on their Party row
            on a phone.
          </p>
          <p className="encounter-note">
            Players {controls.playersMayEnterByHand ? "may" : "may not"} enter a roll by hand.{" "}
            <button type="button" className="encounter-link" onClick={() => onOpenTab("table")}>
              Change in Table
            </button>
          </p>
          <JRPGButton onClick={controls.onClearAllInitiative}>🗑️ Clear all initiative</JRPGButton>
          <p className="encounter-note">
            Everyone leaves the order; a running fight stays on, with nobody&apos;s turn.
          </p>
        </div>
      </section>

      <section className="encounter-section" aria-labelledby="encounter-run">
        <h4 id="encounter-run" className="jrpg-text-command encounter-section__title">
          Run encounter
        </h4>
        <EncounterRun
          roster={roster}
          combatActive={combatActive}
          onStartCombat={controls.onStartCombat}
          onEndCombat={controls.onEndCombat}
          onNextTurn={controls.onNextTurn}
          onPreviousTurn={controls.onPreviousTurn}
        />
      </section>
      {dialog.element}
    </div>
  );
}
