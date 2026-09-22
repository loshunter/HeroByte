/**
 * InitiativeMessageHandler
 *
 * Handles all initiative and combat-related messages from clients.
 * Manages combat tracker state including initiative rolls, turn order,
 * and combat lifecycle.
 *
 * Extracted from apps/server/src/ws/messageRouter.ts on 2025-11-14. The
 * budget and round rules the turn buttons drive live in
 * domains/room/transform/movementBudgetReset.ts.
 *
 * @module ws/handlers/InitiativeMessageHandler
 */

import type { RoomState } from "../../domains/room/model.js";
import type { CharacterService } from "../../domains/character/service.js";
import type { RoomService } from "../../domains/room/service.js";
import type { DiceService } from "../../domains/dice/service.js";
import type { PlayerService } from "../../domains/player/service.js";
import { applyInitiative } from "./applyInitiative.js";
import {
  currentRound,
  leaveOrderBudget,
  resetAllMovementBudgets,
  startTurnBudget,
} from "../../domains/room/transform/movementBudgetReset.js";
import { buildManualInitiativeRecord } from "./initiativeRollRecord.js";

/**
 * Result of handling an initiative message
 */
export interface InitiativeMessageResult {
  /** Whether a broadcast is needed */
  broadcast: boolean;
  /** Whether state should be saved */
  save: boolean;
}

/**
 * Handler for initiative and combat-related messages
 */
export class InitiativeMessageHandler {
  private characterService: CharacterService;
  private roomService: RoomService;
  private diceService: DiceService;
  private playerService: PlayerService;

  constructor(
    characterService: CharacterService,
    roomService: RoomService,
    diceService: DiceService,
    playerService: PlayerService,
  ) {
    this.characterService = characterService;
    this.roomService = roomService;
    this.diceService = diceService;
    this.playerService = playerService;
  }

  /**
   * Handle set-initiative message
   *
   * Sets the initiative value and modifier for a character.
   * Players can only set initiative for their own characters.
   * DMs can set initiative for any character.
   *
   * @param state - Current room state
   * @param characterId - ID of the character
   * @param senderUid - UID of the sender
   * @param initiative - Initiative roll value
   * @param initiativeModifier - Initiative modifier
   * @param isDM - Whether sender is DM
   * @returns Result indicating if broadcast/save is needed
   */
  handleSetInitiative(
    state: RoomState,
    characterId: string,
    senderUid: string,
    initiative: number | undefined,
    initiativeModifier: number | undefined,
    isDM: boolean,
  ): InitiativeMessageResult {
    // Check if sender owns the character or is DM
    const character = this.characterService.findCharacter(state, characterId);
    if (!character) {
      console.warn(`Character ${characterId} not found`);
      return { broadcast: false, save: false };
    }

    const canModify = isDM || this.characterService.canControlCharacter(character, senderUid);
    if (!canModify) {
      console.warn(`Player ${senderUid} attempted to set initiative for character they don't own`);
      return { broadcast: false, save: false };
    }

    // The manual path is a DM-toggleable table setting, ON by default. The DM
    // is never blocked: they are who the toggle exists for, and they are the
    // one who authorises a physical re-roll in the first place.
    //
    // Gated on SETTING a value, not on clearing one. Clearing is not an
    // override — a player withdrawing from a fight is not claiming a number —
    // and folding the two together would make "turn off overrides" quietly
    // mean "players can never remove themselves from the order".
    if (!isDM && initiative !== undefined && !state.initiativeManualOverride) {
      console.warn(
        `Player ${senderUid} attempted manual initiative entry while the table has it disabled`,
      );
      return { broadcast: false, save: false };
    }

    if (initiative === undefined) {
      // Read before the clear: the leave rule finds the successor in this.
      const orderBefore = this.characterService.getCharactersInInitiativeOrder(state);
      if (this.characterService.clearInitiative(state, characterId)) {
        console.log(`[Server] Cleared initiative for ${character.name}`);
        leaveOrderBudget(state, character, orderBefore);
        return { broadcast: true, save: true };
      }
      return { broadcast: false, save: false };
    }

    const modifier = initiativeModifier ?? 0;

    console.log(
      `[Server] Setting initiative for ${character.name} (${characterId}): initiative=${initiative}, modifier=${modifier}`,
    );

    // Read BEFORE applyInitiative overwrites it: this is the value the entry
    // supersedes, and the log strikes it through.
    //
    // The whole TOTAL, not the implied die face it used to be. A struck-out
    // face only means anything next to a number that claims to be a die, and
    // this entry no longer claims one — what a reader wants to see is "it was
    // 9, now it is 17", which is the pair of totals.
    const supersededTotal = character.initiative;

    if (applyInitiative(this.characterService, state, characterId, initiative, modifier)) {
      this.logManualEntry(
        state,
        senderUid,
        character.name,
        initiative,
        modifier,
        supersededTotal,
        character.visibleToPlayers === false,
      );
      console.log(`[Server] Broadcasting updated initiative for ${character.name}`);
      return { broadcast: true, save: true };
    }

    return { broadcast: false, save: false };
  }

  /**
   * Put a hand-entered initiative in the roll log.
   *
   * Best-effort by design: a missing player record drops the LOG LINE, never
   * the initiative itself. The value is already stored by the time this runs,
   * and refusing to record it would be a strictly worse outcome than recording
   * nothing — the table would have a turn order with no explanation.
   */
  private logManualEntry(
    state: RoomState,
    senderUid: string,
    characterName: string,
    initiative: number,
    modifier: number,
    supersededTotal?: number,
    concealed = false,
  ): void {
    const author = this.playerService.findPlayer(state, senderUid);
    if (!author) {
      console.warn(`[Initiative] No player record for ${senderUid}; entry stored but not logged`);
      return;
    }

    const record = buildManualInitiativeRecord(initiative, modifier);
    this.diceService.recordManual(state, {
      playerUid: senderUid,
      playerName: author.name,
      formula: record.formula,
      total: record.total,
      breakdown: record.breakdown,
      supersededTotal,
      // No "(entered)" suffix any more: the roll now carries `handEntered`, so
      // the log says it in colour, in a badge, and in the struck-through value
      // beside the total. A parenthetical in a free-text label was the weakest
      // of the four and the only one a renderer could not act on.
      label: `${characterName} — initiative`,
      // A hidden creature's name must not reach the table by this path either.
      // Fixing only the ROLLED path would have moved the leak here rather than
      // closed it — hand entry is the ordinary physical-dice workflow.
      visibility: concealed ? "dm" : "public",
    });
  }

  /**
   * Handle start-combat message
   *
   * Activates combat mode and sets the first character in initiative order
   * as the current turn. Only DMs can start combat.
   *
   * @param state - Current room state
   * @param senderUid - UID of the sender
   * @param isDM - Whether sender is DM
   * @returns Result indicating if broadcast/save is needed
   */
  handleStartCombat(state: RoomState, senderUid: string, isDM: boolean): InitiativeMessageResult {
    if (!isDM) {
      console.warn(`Non-DM ${senderUid} attempted to start combat`);
      return { broadcast: false, save: false };
    }

    state.combatActive = true;
    resetAllMovementBudgets(state);
    // Set first character with initiative as current turn
    const charactersInOrder = this.characterService.getCharactersInInitiativeOrder(state);
    // An empty order blanks the pointer rather than leaving a stale one.
    state.currentTurnCharacterId = charactersInOrder[0]?.id;
    // Its turn IS starting: stamp it. Unstamped, a PREV then a NEXT wrapped
    // back onto the acting combatant and refilled a budget it had spent.
    startTurnBudget(state, charactersInOrder[0]);
    console.log(`Combat started by ${senderUid}`);

    return { broadcast: true, save: true };
  }

  /**
   * Handle end-combat message
   *
   * Deactivates combat mode (initiatives stay on file — see the body).
   * Only DMs can end combat.
   *
   * @param state - Current room state
   * @param senderUid - UID of the sender
   * @param isDM - Whether sender is DM
   * @returns Result indicating if broadcast/save is needed
   */
  handleEndCombat(state: RoomState, senderUid: string, isDM: boolean): InitiativeMessageResult {
    if (!isDM) {
      console.warn(`Non-DM ${senderUid} attempted to end combat`);
      return { broadcast: false, save: false };
    }

    state.combatActive = false;
    state.currentTurnCharacterId = undefined;
    resetAllMovementBudgets(state);
    // Deliberately does NOT clear initiative. Ending combat used to wipe every
    // rolled value, which the label, the panel copy, and the existence of a
    // separate "Clear All Initiative" button directly beneath it all imply it
    // does not — so pausing a fight cost the table a full re-roll. Discarding
    // the rolls is its own explicit action (`clear-all-initiative`).
    console.log(`Combat ended by ${senderUid}`);

    return { broadcast: true, save: true };
  }

  /**
   * Handle next-turn message
   *
   * Advances to the next character in initiative order, wrapping to the first
   * at the end. All players can advance turns.
   */
  handleNextTurn(state: RoomState, senderUid: string, _isDM: boolean): InitiativeMessageResult {
    const charactersInOrder = this.characterService.getCharactersInInitiativeOrder(state);
    if (charactersInOrder.length === 0) {
      return { broadcast: false, save: false };
    }

    const currentIndex = charactersInOrder.findIndex((c) => c.id === state.currentTurnCharacterId);
    const nextIndex = (currentIndex + 1) % charactersInOrder.length;
    // A pointer outside the order (its holder cleared or deleted) lands on the top: a wrap too.
    if (currentIndex === -1 || currentIndex === charactersInOrder.length - 1) {
      state.combatRound = currentRound(state) + 1;
    }
    state.currentTurnCharacterId = charactersInOrder[nextIndex].id;
    startTurnBudget(state, charactersInOrder[nextIndex]);
    console.log(`Turn advanced to ${charactersInOrder[nextIndex].name} by ${senderUid}`);

    return { broadcast: true, save: true };
  }

  /**
   * Handle previous-turn message
   *
   * Goes back to the previous character in initiative order, wrapping to the
   * last at the beginning. All players can go back turns.
   */
  handlePreviousTurn(state: RoomState, senderUid: string, _isDM: boolean): InitiativeMessageResult {
    const charactersInOrder = this.characterService.getCharactersInInitiativeOrder(state);
    if (charactersInOrder.length === 0) {
      return { broadcast: false, save: false };
    }

    const currentIndex = charactersInOrder.findIndex((c) => c.id === state.currentTurnCharacterId);
    const prevIndex = currentIndex <= 0 ? charactersInOrder.length - 1 : currentIndex - 1;
    // A rewind resets nothing (movementBudgetReset.ts); a backward wrap un-counts the round, to
    // one lap below the NEWEST stamp still IN the order and no further: below that, `>=` would
    // freeze every budget for as many PREVs as a player cared to click, and a leaver's old stamp
    // (kept by leaveOrderBudget) must not pin the floor. A blank pointer counts as the top: NEXT
    // counts the lap from it, so PREV un-counts it — the pair nets zero.
    if (currentIndex <= 0) {
      const stamps = charactersInOrder
        .map((c) => c.movementRound)
        .filter((r): r is number => r !== undefined);
      const floor = (stamps.length ? Math.max(...stamps) : currentRound(state)) - 1;
      state.combatRound = Math.max(currentRound(state) - 1, floor);
    }
    state.currentTurnCharacterId = charactersInOrder[prevIndex].id;
    console.log(`Turn moved back to ${charactersInOrder[prevIndex].name} by ${senderUid}`);

    return { broadcast: true, save: true };
  }

  /**
   * Handle clear-all-initiative message
   *
   * Clears initiative values for all characters.
   * Only DMs can clear all initiative.
   *
   * @param state - Current room state
   * @param senderUid - UID of the sender
   * @param isDM - Whether sender is DM
   * @returns Result indicating if broadcast/save is needed
   */
  handleClearAllInitiative(
    state: RoomState,
    senderUid: string,
    isDM: boolean,
  ): InitiativeMessageResult {
    if (!isDM) {
      console.warn(`Non-DM ${senderUid} attempted to clear all initiative`);
      return { broadcast: false, save: false };
    }

    this.characterService.clearAllInitiative(state);
    // The order is empty now, so no turn can ever land on anyone: a turn
    // pointer into the cleared order would send next-turn to whoever sorts
    // first, and a budget nobody can reset would keep charging invisibly
    // (combat stays active by this message's contract).
    state.currentTurnCharacterId = undefined;
    resetAllMovementBudgets(state);

    return { broadcast: true, save: true };
  }
}
