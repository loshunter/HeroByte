// ============================================================================
// ENCOUNTER ROSTER
// ============================================================================
// Who is in the fight, in the order the SERVER runs it, and who has not rolled
// yet (U8). Pure, so the Encounter tab renders what the server will do rather
// than an order of its own.
//
// "In the order" is the shared rule (isInInitiativeOrder: may participate AND
// has an initiative). The sort is the server's (CharacterService.
// getCharactersInInitiativeOrder): initiative high to low, a PC (a player's or
// the DM's own) before an NPC on a tie, then creation order — so "Turn N of M" and the turn
// mark here agree with next-turn and previous-turn.
//
// Everyone else is "waiting": a player's character or an NPC with no roll, and
// the DM's own characters on the bench (a DM's character joins the order once
// it has rolled — the owner's F3 rule; until then it waits here too).

import { isInInitiativeOrder } from "@herobyte/shared";
import { initiativeOrder } from "../../utils/initiativeOrder";
import type { Player, SnapshotCharacter } from "@herobyte/shared";

export type ParticipantKind = "npc" | "player" | "dm";

export interface EncounterParticipant {
  character: SnapshotCharacter;
  kind: ParticipantKind;
  /** The seat's name, for a character a seat owns (players and the DM). */
  seatName?: string;
  /** An NPC the players cannot see (`visibleToPlayers === false`). */
  hidden: boolean;
  /** Holds the turn: combat is on and the pointer names it. */
  isCurrentTurn: boolean;
}

export interface EncounterRoster {
  /** In the order, top first. */
  order: EncounterParticipant[];
  /** No initiative yet (or the DM's bench). */
  waiting: EncounterParticipant[];
  /** Index into `order` of the turn holder, or -1 while nobody holds it. */
  turnIndex: number;
}

export function buildEncounterRoster(
  characters: readonly SnapshotCharacter[],
  players: Player[],
  combatActive: boolean,
  currentTurnCharacterId: string | undefined,
): EncounterRoster {
  const seatOf = new Map(players.map((player) => [player.uid, player]));

  const participant = (character: SnapshotCharacter): EncounterParticipant => {
    const seat = character.ownedByPlayerUID ? seatOf.get(character.ownedByPlayerUID) : undefined;
    const kind: ParticipantKind =
      character.type === "npc" ? "npc" : seat?.isDM === true ? "dm" : "player";
    return {
      character,
      kind,
      seatName: kind === "npc" ? undefined : seat?.name,
      hidden: character.type === "npc" && character.visibleToPlayers === false,
      isCurrentTurn: combatActive && character.id === currentTurnCharacterId,
    };
  };

  // The client's one spelling of the server's order (utils/initiativeOrder),
  // which the Party bar's count reads too.
  const order = initiativeOrder(characters, players).map(participant);

  const waiting = characters
    .filter((character) => !isInInitiativeOrder(character, players))
    .map(participant);

  return {
    order,
    waiting,
    turnIndex: order.findIndex((entry) => entry.isCurrentTurn),
  };
}
