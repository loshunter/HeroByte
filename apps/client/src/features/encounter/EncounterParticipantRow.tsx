// ============================================================================
// ENCOUNTER PARTICIPANT ROW
// ============================================================================
// One character in Encounter's participant list (U8): who it is, its HP and
// initiative, and the DM's shortcuts into the ONE initiative state — the same
// dialog the card's INIT opens, the same roll and clear messages. No editor of
// its own: HP and conditions stay on the character's card and NPC editor.

import { JRPGButton } from "../../components/ui/JRPGPanel";
import type { EncounterParticipant } from "./encounterRoster";

interface EncounterParticipantRowProps {
  participant: EncounterParticipant;
  /** Opens the shared initiative dialog for this character. */
  onSetInitiative: () => void;
  /** Roll d20 now with the character's stored modifier (no initiative yet). */
  onRoll: () => void;
  /** Clear its initiative: it leaves the order (its turn passes on). */
  onRemoveFromOrder: () => void;
  /** Centre the map on its token; undefined while no token is on this map. */
  onFocus: (() => void) | undefined;
}

const KIND_LABEL = { npc: "NPC", player: "Player", dm: "DM" } as const;

export function EncounterParticipantRow({
  participant,
  onSetInitiative,
  onRoll,
  onRemoveFromOrder,
  onFocus,
}: EncounterParticipantRowProps) {
  const { character, kind, seatName, hidden, isCurrentTurn } = participant;
  const rolled = character.initiative !== undefined;
  const name = character.name;

  return (
    <li
      className={`encounter-row${isCurrentTurn ? " encounter-row--turn" : ""}`}
      data-character-id={character.id}
      aria-current={isCurrentTurn ? "step" : undefined}
    >
      <div className="encounter-row__who">
        {isCurrentTurn && (
          <span className="encounter-row__turn" aria-label="Current turn">
            ▶
          </span>
        )}
        <span className="encounter-row__name">{name}</span>
        <span className="encounter-row__tag">
          {KIND_LABEL[kind]}
          {seatName && seatName !== name ? ` · ${seatName}` : ""}
        </span>
        {hidden && <span className="encounter-row__tag encounter-row__tag--hidden">hidden</span>}
        <span className="encounter-row__hp">
          HP {character.hp ?? "?"}/{character.maxHp ?? "?"}
        </span>
      </div>
      <div className="encounter-row__actions">
        {rolled ? (
          <JRPGButton
            onClick={onSetInitiative}
            aria-label={`Initiative ${character.initiative}: set for ${name}`}
            // Set… and Init N are one opener: the row moves lists on its first
            // initiative, and the dialog's focus comes back here (useInertPage).
            data-focus-key={`initiative:${character.id}`}
          >
            Init {character.initiative}
          </JRPGButton>
        ) : (
          <>
            <JRPGButton onClick={onRoll} aria-label={`Roll d20 now for ${name}`}>
              🎲 Roll
            </JRPGButton>
            <JRPGButton
              onClick={onSetInitiative}
              aria-label={`Set initiative for ${name}`}
              data-focus-key={`initiative:${character.id}`}
            >
              Set…
            </JRPGButton>
          </>
        )}
        {onFocus && (
          <JRPGButton onClick={onFocus} aria-label={`Focus ${name}`}>
            🎯
          </JRPGButton>
        )}
        {rolled && (
          <JRPGButton onClick={onRemoveFromOrder} aria-label={`Remove ${name} from the order`}>
            ✕
          </JRPGButton>
        )}
      </div>
    </li>
  );
}
