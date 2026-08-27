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
   * Record what was thrown on physical dice — a fresh entry, or a rewrite of a
   * roll the server already made.
   *
   * Three gates, and they answer different questions:
   *
   *   - the TABLE setting decides whether players may do this at all. The DM is
   *     never blocked by it: they are who the switch exists for. Same rule, and
   *     the same `!state.initiativeManualOverride` test, as hand-entered
   *     initiative — one switch governs both, which is why its DM-menu copy no
   *     longer names initiative
   *   - OWNERSHIP decides whose roll may be rewritten. A player may correct
   *     their own number; the DM may correct anybody's, because they adjudicate
   *     the table. Rewriting someone else's roll is otherwise a forgery with
   *     their name on it, which is the one thing the marker cannot excuse
   *   - and the shape gate has already bounded `total`
   *
   * A rewrite keeps the FIRST superseded value. Override twice and the log
   * still shows what the SERVER rolled struck through, not the intermediate
   * guess — the original is the thing a table would want to audit.
   */
  handleEnterRoll(
    state: RoomState,
    senderUid: string,
    isDM: boolean,
    total: number,
    rollId?: string,
    formula?: string,
    visibility?: DiceVisibility,
  ): DiceMessageResult {
    if (!isDM && !state.initiativeManualOverride) {
      console.warn(`[Dice] ${senderUid} tried to enter a roll while the table has it disabled`);
      return { broadcast: false, save: false };
    }

    if (rollId !== undefined) {
      return this.rewriteRoll(state, senderUid, isDM, rollId, total);
    }

    const author = this.playerService.findPlayer(state, senderUid);
    if (!author) {
      console.warn(`[Dice] No player record for ${senderUid}; entered roll not recorded`);
      return { broadcast: false, save: false };
    }

    this.diceService.recordManual(state, {
      playerUid: senderUid,
      playerName: author.name,
      // A bare entry carries no notation, and the total IS the notation then.
      formula: formula ?? String(total),
      total,
      breakdown: [{ tokenId: "t0", subtotal: total }],
      visibility: coerceDiceVisibility(visibility),
    });
    return { broadcast: true, save: true };
  }

  /** Rewrite one roll in place. See handleEnterRoll for the rules. */
  private rewriteRoll(
    state: RoomState,
    senderUid: string,
    isDM: boolean,
    rollId: string,
    total: number,
  ): DiceMessageResult {
    const roll = state.diceRolls.find((candidate) => candidate.id === rollId);
    if (!roll) {
      console.warn(`[Dice] ${senderUid} tried to enter a roll that is not in history`);
      return { broadcast: false, save: false };
    }

    if (!isDM && roll.playerUid !== senderUid) {
      console.warn(`[Dice] ${senderUid} tried to rewrite a roll belonging to ${roll.playerUid}`);
      return { broadcast: false, save: false };
    }

    // First writer wins: the value worth keeping is what the SERVER rolled, not
    // whatever the last correction happened to replace.
    if (roll.supersededTotal === undefined) {
      roll.supersededTotal = roll.total;
    }
    roll.total = total;
    roll.handEntered = true;
    return { broadcast: true, save: true };
  }

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
   * Wipe the log. DM-only, for the same reason clearing the chat log is: roll
   * history is shared history, and one player should not be able to erase what
   * the table rolled.
   *
   * S5 raised the stakes on an existing gap. The collection now holds `dm` and
   * `self` rolls the recipient filter deliberately withholds from a player —
   * so an ungated wipe let them destroy records they were never allowed to
   * see, and the CLEAR button in the roll log is rendered for everyone.
   *
   * @param state - Current room state
   * @param senderUid - Who asked, taken from the connection
   * @param isDM - Whether they may
   * @returns Result indicating if broadcast/save is needed
   */
  handleClearRollHistory(state: RoomState, senderUid: string, isDM: boolean): DiceMessageResult {
    if (!isDM) {
      console.warn(`[Dice] Non-DM ${senderUid} attempted to clear the roll history`);
      return { broadcast: false, save: false };
    }
    this.diceService.clearHistory(state);
    return { broadcast: true, save: false };
  }
}
