// ============================================================================
// DICE DOMAIN - SERVICE
// ============================================================================
// Handles dice rolling and roll history.
//
// The signature that matters is rollFor's: it takes the author's uid and name
// as SEPARATE arguments from the request, and its one caller passes them from
// the connection. There is deliberately no path that accepts a whole
// client-built DiceRoll from the wire — that shape is what made dice
// forgeable (arc defect D2), and refusing to offer it is what stops the same
// mistake being made again by accident. Compare ChatService.addMessage, which
// is built the same way and for the same reason.
//
// addRoll survives as the append-and-trim primitive. It is not a wire entry
// point: nothing outside this file and its tests calls it with a roll a client
// supplied.

import { randomUUID } from "node:crypto";
import type { DiceRoll, DiceRollMode, DiceTerm, DiceVisibility } from "@herobyte/shared";
import type { RoomState } from "../room/model.js";
import { cryptoDiceRng, rollTerms, type DiceRng } from "./roller.js";

/** Everything the server needs to settle one roll. No client fields survive. */
export interface DiceRollRequest {
  /** Taken from the sending connection. Never from the payload. */
  playerUid: string;
  /** Snapshotted now, so a later rename does not rewrite history. */
  playerName: string;
  /** Already parsed and bounded by parseDiceFormula. */
  terms: DiceTerm[];
  mode: DiceRollMode;
  visibility: DiceVisibility;
}

/**
 * Dice service - manages dice rolls and history
 */
export class DiceService {
  private readonly MAX_ROLLS = 100;

  /**
   * Roll a request and append the settled roll to history.
   *
   * `rng` and `now` exist for tests only — a golden seed pins the exact
   * sequence, which is how "the server rolled this" is provable rather than
   * asserted. Production takes the crypto defaults.
   */
  rollFor(
    state: RoomState,
    request: DiceRollRequest,
    rng: DiceRng = cryptoDiceRng,
    now: number = Date.now(),
  ): DiceRoll {
    const rolled = rollTerms(request.terms, request.mode, rng);

    const roll: DiceRoll = {
      id: randomUUID(),
      playerUid: request.playerUid,
      playerName: request.playerName,
      formula: rolled.formula,
      total: rolled.total,
      breakdown: rolled.breakdown,
      timestamp: now,
    };
    // Only ever set when they carry information: an absent `mode`/`visibility`
    // reads as normal/public, which is what every pre-S5 roll already means.
    if (rolled.mode !== "normal") roll.mode = rolled.mode;
    if (request.visibility !== "public") roll.visibility = request.visibility;

    this.addRoll(state, roll);
    return roll;
  }

  /**
   * Append a settled roll to history, trimming the oldest beyond MAX_ROLLS.
   */
  addRoll(state: RoomState, roll: DiceRoll): void {
    state.diceRolls.push(roll);

    // Keep only last MAX_ROLLS
    if (state.diceRolls.length > this.MAX_ROLLS) {
      state.diceRolls = state.diceRolls.slice(-this.MAX_ROLLS);
    }
  }

  /**
   * Clear all dice roll history
   */
  clearHistory(state: RoomState): void {
    state.diceRolls = [];
  }

  /**
   * Full unfiltered history — callers owe the per-recipient filter.
   */
  getHistory(state: RoomState): DiceRoll[] {
    return state.diceRolls;
  }
}
