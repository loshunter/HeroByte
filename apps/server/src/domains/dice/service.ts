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
  /**
   * Optional "what this was for" line. Set by callers that roll on behalf of
   * something the table needs named — initiative is the first. Never from the
   * wire: `{ t: "dice-roll" }` has no field for it, so a client cannot caption
   * its own roll.
   */
  label?: string;
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
    if (request.label !== undefined) roll.label = request.label;

    this.addRoll(state, roll);
    return roll;
  }

  /**
   * Record a roll the server did NOT throw: a physical die, reported by hand.
   *
   * Read the file header first, because this is the one method that bends it.
   * `rollFor` refuses a client-built DiceRoll on purpose — that shape is what
   * made dice forgeable (arc defect D2). Here a client number really does
   * reach the log, and the reason it is not the same hole is worth being
   * precise about:
   *
   *   - identity is still the connection's. `playerUid` and `playerName` come
   *     from the caller's own record, exactly as in `rollFor`
   *   - `id` and `timestamp` are still minted here, so history cannot be
   *     back-dated or given a colliding id
   *   - the entry is LABELLED. A manual initiative says so in the log; it is
   *     not passed off as something the server rolled
   *   - and it buys nothing a player did not already have: hand-entered
   *     initiative predates this method, and the DM can switch it off
   *
   * What it must never become is a general "record my roll" entry point. It
   * takes a presentation, not a formula, and the only caller is initiative.
   */
  recordManual(
    state: RoomState,
    request: {
      playerUid: string;
      playerName: string;
      formula: string;
      total: number;
      breakdown: DiceRoll["breakdown"];
      label: string;
    },
    now: number = Date.now(),
  ): DiceRoll {
    const roll: DiceRoll = {
      id: randomUUID(),
      playerUid: request.playerUid,
      playerName: request.playerName,
      formula: request.formula,
      total: request.total,
      breakdown: request.breakdown,
      timestamp: now,
      label: request.label,
    };

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
