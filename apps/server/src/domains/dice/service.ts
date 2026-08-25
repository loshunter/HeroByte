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
   * It WAS documented here that this "must never become a general 'record my
   * roll' entry point". The owner overturned that on 2026-08-24, deliberately
   * and with the reason stated: their table plays with physical dice, and a VTT
   * that cannot record what the table actually threw is not usable for them.
   *
   * The guarantee that lock was protecting is preserved by other means, and it
   * is worth being precise about which part was load-bearing. It was never
   * "the client must not send a number" for its own sake — it was "a number the
   * client sent must not be mistakable for one the server rolled". So:
   *
   *   - `playerUid` and `playerName` are still bound from the connection here,
   *     exactly as in `rollFor`. A caller cannot forge WHO rolled, only WHAT
   *   - every entry through this path sets `handEntered`, which the log renders
   *     in a different colour with a BY HAND badge and the superseded value
   *     struck through beside it. Dropping that marker is the actual regression
   *     to guard against, and it is pinned by tests on both sides of the wire
   *   - the table setting still gates it, defaulting ON but the DM's to revoke
   *
   * What remains true: this takes a PRESENTATION, not a formula. It does not
   * parse, does not roll, and must never acquire an RNG — `cryptoDiceRng` has
   * exactly one caller and this is not it.
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
      /**
       * Absent means public, the same rule `rollFor` follows. Supplied when the
       * SUBJECT of the entry is concealed: a hidden NPC's name must not travel
       * in the roll log, which `visibleRollsFor` filters on the roll's own
       * visibility without ever consulting state.characters.
       */
      visibility?: DiceVisibility;
      /**
       * The server-rolled total this replaces, when it replaces one. Absent on
       * a first-time entry — the common case at a physical-dice table, where
       * there was never a server roll to supersede.
       */
      supersededTotal?: number;
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
      // Unconditional, and every caller gets it whether they asked or not.
      // This is the marker that makes a client-asserted number honest, so it
      // is set HERE rather than passed in — a caller that could omit it is a
      // caller that could launder a typed number into looking rolled.
      handEntered: true,
    };
    if (request.supersededTotal !== undefined) {
      roll.supersededTotal = request.supersededTotal;
    }
    // Set only when it carries information, exactly as rollFor does: an absent
    // visibility already reads as public everywhere downstream.
    if (request.visibility !== undefined && request.visibility !== "public") {
      roll.visibility = request.visibility;
    }

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
