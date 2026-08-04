/**
 * DiceMessageHandler
 *
 * The one place a roll's author is decided — and it is decided from
 * `senderUid`, which the WebSocket layer derived from the connection, not from
 * anything in the payload. `{ t: "dice-roll" }` carries a FORMULA and nothing
 * else: no total, no uid, no name. There is nothing here to get wrong by
 * accident, which is the point of the wire change (arc defect D2).
 *
 * Extracted from: apps/server/src/ws/messageRouter.ts
 * - dice-roll (lines 735-738)
 * - clear-roll-history (lines 740-744)
 *
 * Extraction date: 2025-11-14
 *
 * @module ws/handlers/DiceMessageHandler
 */

import { coerceDiceRollMode, coerceDiceVisibility, parseDiceFormula } from "@herobyte/shared";
import type { DiceRollMode, DiceVisibility } from "@herobyte/shared";
import type { RoomState } from "../../domains/room/model.js";
import type { DiceService } from "../../domains/dice/service.js";
import type { PlayerService } from "../../domains/player/service.js";

/**
 * Result of handling a dice message
 */
export interface DiceMessageResult {
  /** Whether a broadcast is needed */
  broadcast: boolean;
  /** Whether state should be saved */
  save: boolean;
}

/**
 * Handler for dice-related messages
 */
export class DiceMessageHandler {
  constructor(
    private diceService: DiceService,
    private playerService: PlayerService,
  ) {}

  /**
   * Roll `formula` on behalf of `senderUid` and record the result.
   *
   * The display name is read from the sender's own player record rather than
   * taken from the wire, so a client cannot roll under someone else's name any
   * more than it can roll under their uid.
   *
   * The formula is re-parsed here even though the validator already parsed it.
   * That is not redundancy worth deleting: the validator's job is to refuse a
   * bad message, this one's is to produce terms, and a handler that trusted a
   * gate it cannot see would be one refactor away from evaluating unvalidated
   * input.
   *
   * @param state - Current room state
   * @param senderUid - Author, taken from the connection
   * @param formula - Dice notation from the client; the only thing it supplies
   * @param mode - Advantage/disadvantage; anything unrecognized becomes "normal"
   * @param visibility - Who may see it; anything unrecognized fails closed to "self"
   * @returns Result indicating if broadcast/save is needed
   */
  handleDiceRoll(
    state: RoomState,
    senderUid: string,
    formula: string,
    mode?: DiceRollMode,
    visibility?: DiceVisibility,
  ): DiceMessageResult {
    const author = this.playerService.findPlayer(state, senderUid);
    if (!author) {
      // Authenticated but with no player record — nothing legitimate produces
      // this, so drop it rather than inventing an identity for the roll.
      console.warn(`[Dice] Dropping roll from ${senderUid}: no player record`);
      return { broadcast: false, save: false };
    }

    const parsed = parseDiceFormula(formula);
    if (!parsed.ok) {
      console.warn(`[Dice] Dropping roll from ${senderUid}: ${parsed.error}`);
      return { broadcast: false, save: false };
    }

    this.diceService.rollFor(state, {
      playerUid: senderUid,
      playerName: author.name,
      terms: parsed.terms,
      mode: coerceDiceRollMode(mode),
      visibility: coerceDiceVisibility(visibility),
    });
    return { broadcast: true, save: false };
  }

  /**
   * Handle clear-roll-history message
   *
   * Clears all dice rolls from the history.
   *
   * @param state - Current room state
   * @returns Result indicating if broadcast/save is needed
   */
  handleClearRollHistory(state: RoomState): DiceMessageResult {
    this.diceService.clearHistory(state);
    return { broadcast: true, save: false };
  }
}
