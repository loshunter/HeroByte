/**
 * DiceMessageHandler — recording what the table actually threw.
 *
 * The physical-dice path is the one place a client's NUMBER reaches shared
 * history, so the rules that keep it honest are the ones worth pinning: the
 * table setting gates players, ownership gates whose roll may be rewritten,
 * identity still comes from the connection, and every entry is marked.
 *
 * @module ws/handlers/__tests__/DiceMessageHandler.enterRoll.test
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { DiceMessageHandler } from "../DiceMessageHandler.js";
import { DiceService } from "../../../domains/dice/service.js";
import type { PlayerService } from "../../../domains/player/service.js";
import { createEmptyRoomState } from "../../../domains/room/model.js";
import type { RoomState } from "../../../domains/room/model.js";

describe("DiceMessageHandler — enter-roll", () => {
  let handler: DiceMessageHandler;
  let state: RoomState;

  const playerService = {
    findPlayer: vi.fn((_state: RoomState, uid: string) =>
      uid === "ghost" ? undefined : { uid, name: uid === "dm-uid" ? "The DM" : "Mara" },
    ),
  } as unknown as PlayerService;

  beforeEach(() => {
    vi.clearAllMocks();
    state = createEmptyRoomState();
    handler = new DiceMessageHandler(new DiceService(), playerService);
  });

  /** A settled server roll already in history, for the rewrite cases. */
  const seedRoll = (overrides: Record<string, unknown> = {}) => {
    const roll = {
      id: "roll-1",
      playerUid: "player-1",
      playerName: "Mara",
      formula: "2d6 + 3",
      total: 9,
      breakdown: [{ tokenId: "t0", die: "d6", rolls: [4, 2], subtotal: 6 }],
      timestamp: 1000,
      ...overrides,
    };
    state.diceRolls.push(roll as (typeof state.diceRolls)[number]);
    return roll;
  };

  describe("a fresh entry", () => {
    it("records the number and marks it, so the log cannot pass it off as rolled", () => {
      const result = handler.handleEnterRoll(state, "player-1", false, 17, undefined, "2d6 + 3");

      expect(result).toEqual({ broadcast: true, save: true });
      expect(state.diceRolls).toHaveLength(1);
      const roll = state.diceRolls[0];
      expect(roll.handEntered).toBe(true);
      expect(roll.total).toBe(17);
      expect(roll.formula).toBe("2d6 + 3");
      expect(roll.playerUid).toBe("player-1");
      expect(roll.playerName).toBe("Mara");
    });

    it("uses the total as its own notation when no dice were assembled", () => {
      // The fastest path at a physical table: "I rolled 17, put it on the
      // table". There is no formula to record, and inventing one would claim
      // dice nobody named.
      handler.handleEnterRoll(state, "player-1", false, 17);

      expect(state.diceRolls[0].formula).toBe("17");
      expect(state.diceRolls[0].handEntered).toBe(true);
    });

    it("has nothing struck through — there was no roll to supersede", () => {
      handler.handleEnterRoll(state, "player-1", false, 17);

      expect(state.diceRolls[0].supersededTotal).toBeUndefined();
    });

    it("keeps a private entry private", () => {
      handler.handleEnterRoll(state, "player-1", false, 17, undefined, undefined, "dm");

      expect(state.diceRolls[0].visibility).toBe("dm");
    });

    it("drops the LOG LINE rather than the message when the player has no record", () => {
      const result = handler.handleEnterRoll(state, "ghost", false, 17);

      expect(result).toEqual({ broadcast: false, save: false });
      expect(state.diceRolls).toHaveLength(0);
    });
  });

  describe("the table setting", () => {
    it("refuses a player once the DM turns hand-entry off", () => {
      state.initiativeManualOverride = false;

      const result = handler.handleEnterRoll(state, "player-1", false, 17);

      expect(result).toEqual({ broadcast: false, save: false });
      expect(state.diceRolls).toHaveLength(0);
    });

    it("never blocks the DM — they are who the switch exists for", () => {
      state.initiativeManualOverride = false;

      const result = handler.handleEnterRoll(state, "dm-uid", true, 17);

      expect(result).toEqual({ broadcast: true, save: true });
      expect(state.diceRolls).toHaveLength(1);
    });

    it("is ON for a table that has never touched it", () => {
      // The key is present only when OFF, so an absent key must read as ON —
      // written the other way every table starts unable to use the feature.
      expect(state.initiativeManualOverride).not.toBe(false);

      expect(handler.handleEnterRoll(state, "player-1", false, 17).broadcast).toBe(true);
    });
  });

  describe("rewriting a roll in place", () => {
    it("strikes the server's total and puts the typed one in its place", () => {
      seedRoll();

      const result = handler.handleEnterRoll(state, "player-1", false, 11, "roll-1");

      expect(result).toEqual({ broadcast: true, save: true });
      // ONE row, not two: the point of overwriting rather than appending.
      expect(state.diceRolls).toHaveLength(1);
      const roll = state.diceRolls[0];
      expect(roll.supersededTotal).toBe(9);
      expect(roll.total).toBe(11);
      expect(roll.handEntered).toBe(true);
      // The notation is what was thrown, and rewriting the result does not
      // change what dice were named.
      expect(roll.formula).toBe("2d6 + 3");
    });

    it("keeps the ORIGINAL superseded value across a second correction", () => {
      // First writer wins. Override twice and the log still shows what the
      // SERVER rolled struck through, not the intermediate guess — the original
      // is the thing a table would want to audit.
      seedRoll();

      handler.handleEnterRoll(state, "player-1", false, 11, "roll-1");
      handler.handleEnterRoll(state, "player-1", false, 14, "roll-1");

      expect(state.diceRolls[0].supersededTotal).toBe(9);
      expect(state.diceRolls[0].total).toBe(14);
    });

    it("refuses a player rewriting someone ELSE's roll", () => {
      // The one thing the marker cannot excuse: a forgery with another
      // player's name on it.
      seedRoll({ playerUid: "player-2", playerName: "Bren" });

      const result = handler.handleEnterRoll(state, "player-1", false, 20, "roll-1");

      expect(result).toEqual({ broadcast: false, save: false });
      expect(state.diceRolls[0].total).toBe(9);
      expect(state.diceRolls[0].handEntered).toBeUndefined();
    });

    it("lets the DM correct anybody's, because they adjudicate the table", () => {
      seedRoll({ playerUid: "player-2", playerName: "Bren" });

      const result = handler.handleEnterRoll(state, "dm-uid", true, 20, "roll-1");

      expect(result).toEqual({ broadcast: true, save: true });
      expect(state.diceRolls[0].total).toBe(20);
      expect(state.diceRolls[0].supersededTotal).toBe(9);
      // Still Bren's roll. The DM corrected a number, they did not take it over.
      expect(state.diceRolls[0].playerUid).toBe("player-2");
      expect(state.diceRolls[0].playerName).toBe("Bren");
    });

    it("ignores a roll id that is not in history", () => {
      const result = handler.handleEnterRoll(state, "player-1", false, 11, "no-such-roll");

      expect(result).toEqual({ broadcast: false, save: false });
      expect(state.diceRolls).toHaveLength(0);
    });

    it("does not append a fresh entry when a rewrite is refused", () => {
      // The failure that would look like success: refused as a rewrite, then
      // quietly recorded as a new roll under the wrong total.
      seedRoll({ playerUid: "player-2" });

      handler.handleEnterRoll(state, "player-1", false, 20, "roll-1");

      expect(state.diceRolls).toHaveLength(1);
    });
  });
});
