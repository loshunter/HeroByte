/**
 * Characterization tests for InitiativeMessageHandler
 *
 * These tests capture the original behavior of initiative/combat message handling
 * from messageRouter.ts before extraction.
 *
 * Source: apps/server/src/ws/messageRouter.ts
 * - set-initiative (lines 318-349)
 * - start-combat (lines 351-366)
 * - end-combat (lines 368-379)
 * - next-turn (lines 382-399)
 * - previous-turn (lines 401-418)
 * - clear-all-initiative (lines 420-426)
 *
 * @module ws/handlers/__tests__/InitiativeMessageHandler.test
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { InitiativeMessageHandler } from "../InitiativeMessageHandler.js";
import type { Character } from "@herobyte/shared";
import { createEmptyRoomState } from "../../../domains/room/model.js";
import type { RoomState } from "../../../domains/room/model.js";
import { CharacterService } from "../../../domains/character/service.js";
import type { RoomService } from "../../../domains/room/service.js";
import { DiceService } from "../../../domains/dice/service.js";
import type { PlayerService } from "../../../domains/player/service.js";

describe("InitiativeMessageHandler", () => {
  let handler: InitiativeMessageHandler;
  let mockCharacterService: CharacterService;
  let mockRoomService: RoomService;
  // Real, not a stub: commit 4 makes the manual path WRITE to the log, and a
  // stub would let "it was recorded" pass while nothing was.
  let diceService: DiceService;
  let mockPlayerService: PlayerService;
  let state: RoomState;

  beforeEach(() => {
    // Create mock state with characters
    state = createEmptyRoomState();
    state.characters = [
      {
        id: "char1",
        name: "Fighter",
        type: "pc",
        ownedByPlayerUID: "player1",
        hp: 20,
        maxHp: 20,
        initiative: undefined,
        initiativeModifier: 0,
      },
      {
        id: "char2",
        name: "Wizard",
        type: "pc",
        ownedByPlayerUID: "player2",
        hp: 15,
        maxHp: 15,
        initiative: undefined,
        initiativeModifier: 0,
      },
      {
        id: "char3",
        name: "Goblin",
        type: "npc",
        ownedByPlayerUID: null,
        hp: 10,
        maxHp: 10,
        initiative: undefined,
        initiativeModifier: 0,
      },
    ];

    // Create mock services
    mockCharacterService = {
      findCharacter: vi.fn((state: RoomState, id: string) =>
        state.characters.find((c) => c.id === id),
      ),
      canControlCharacter: vi.fn((character: Character, senderUid: string) => {
        return character.ownedByPlayerUID === senderUid;
      }),
      setInitiative: vi.fn(
        (state: RoomState, characterId: string, initiative: number, modifier: number) => {
          const character = state.characters.find((c) => c.id === characterId);
          if (character) {
            character.initiative = initiative;
            character.initiativeModifier = modifier;
            return true;
          }
          return false;
        },
      ),
      clearInitiative: vi.fn((state: RoomState, characterId: string) => {
        const character = state.characters.find((c) => c.id === characterId);
        if (character) {
          character.initiative = undefined;
          character.initiativeModifier = 0;
          return true;
        }
        return false;
      }),
      // The REAL comparator (initiative desc, pc before npc, then array index):
      // a hand-rolled one here double-counted the modifier and had no
      // tie-break, so the turn-passing assertions were validated against an
      // order that was not production's.
      getCharactersInInitiativeOrder: vi.fn((state: RoomState) =>
        new CharacterService().getCharactersInInitiativeOrder(state),
      ),
      clearAllInitiative: vi.fn((state: RoomState) => {
        state.characters.forEach((c) => {
          c.initiative = undefined;
          c.initiativeModifier = 0;
        });
      }),
    } as unknown as CharacterService;

    mockRoomService = {
      getState: vi.fn(() => state),
      saveState: vi.fn(),
    } as unknown as RoomService;

    diceService = new DiceService();
    mockPlayerService = {
      findPlayer: vi.fn((_state: RoomState, uid: string) =>
        uid === "ghost" ? undefined : { uid, name: `Player ${uid}` },
      ),
    } as unknown as PlayerService;

    handler = new InitiativeMessageHandler(
      mockCharacterService,
      mockRoomService,
      diceService,
      mockPlayerService,
    );
  });

  describe("handleSetInitiative", () => {
    it("should set initiative for character owned by sender", () => {
      const result = handler.handleSetInitiative(
        state,
        "char1",
        "player1",
        15,
        2,
        false, // not DM
      );

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(true);
      expect(mockCharacterService.setInitiative).toHaveBeenCalledWith(state, "char1", 15, 2);
    });

    it("should allow DM to set initiative for any character", () => {
      const result = handler.handleSetInitiative(
        state,
        "char2",
        "dmPlayer",
        18,
        3,
        true, // is DM
      );

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(true);
      expect(mockCharacterService.setInitiative).toHaveBeenCalledWith(state, "char2", 18, 3);
    });

    it("should reject initiative setting for character not owned by non-DM", () => {
      const result = handler.handleSetInitiative(
        state,
        "char2",
        "player1", // player1 trying to modify player2's character
        15,
        2,
        false,
      );

      expect(result.broadcast).toBe(false);
      expect(result.save).toBe(false);
      expect(mockCharacterService.setInitiative).not.toHaveBeenCalled();
    });

    it("should reject initiative setting for non-existent character", () => {
      const result = handler.handleSetInitiative(state, "nonexistent", "player1", 15, 2, false);

      expect(result.broadcast).toBe(false);
      expect(result.save).toBe(false);
      expect(mockCharacterService.setInitiative).not.toHaveBeenCalled();
    });

    it("should clear initiative when initiative value is undefined", () => {
      state.characters[0].initiative = 16;

      const result = handler.handleSetInitiative(
        state,
        "char1",
        "player1",
        undefined,
        undefined,
        false,
      );

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(true);
      expect(mockCharacterService.clearInitiative).toHaveBeenCalledWith(state, "char1");
      expect(mockCharacterService.setInitiative).not.toHaveBeenCalled();
      expect(state.characters[0].initiative).toBeUndefined();
    });

    it("should set currentTurnCharacterId when setting first initiative during active combat", () => {
      // Start combat with no initiative set
      state.combatActive = true;
      state.currentTurnCharacterId = undefined;

      // Set initiative for first character
      const result = handler.handleSetInitiative(
        state,
        "char1",
        "player1",
        15,
        2,
        false, // not DM
      );

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(true);
      expect(state.currentTurnCharacterId).toBe("char1");
      expect(mockCharacterService.getCharactersInInitiativeOrder).toHaveBeenCalled();
    });

    it("should not change currentTurnCharacterId when already set during active combat", () => {
      // Start combat with initiative already set
      state.combatActive = true;
      state.characters[0].initiative = 20;
      state.currentTurnCharacterId = "char1";

      // Set initiative for second character
      const result = handler.handleSetInitiative(
        state,
        "char2",
        "player2",
        15,
        2,
        false, // not DM
      );

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(true);
      // currentTurnCharacterId should remain unchanged
      expect(state.currentTurnCharacterId).toBe("char1");
    });

    it("should auto-start combat when setting first initiative", () => {
      // Combat is not active
      state.combatActive = false;
      state.currentTurnCharacterId = undefined;

      // Set initiative for first character
      const result = handler.handleSetInitiative(
        state,
        "char1",
        "player1",
        15,
        2,
        false, // not DM
      );

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(true);
      // Combat should now be active
      expect(state.combatActive).toBe(true);
      // currentTurnCharacterId should be set to the character who rolled
      expect(state.currentTurnCharacterId).toBe("char1");
    });

    it("should auto-start combat and set current turn for subsequent initiative rolls", () => {
      // Combat is not active
      state.combatActive = false;
      state.currentTurnCharacterId = undefined;

      // First character sets initiative
      handler.handleSetInitiative(state, "char1", "player1", 15, 2, false);

      expect(state.combatActive).toBe(true);
      expect(state.currentTurnCharacterId).toBe("char1");

      // Second character sets initiative - current turn should not change
      const result = handler.handleSetInitiative(state, "char2", "player2", 18, 3, false);

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(true);
      expect(state.combatActive).toBe(true);
      // Current turn should remain with first character who rolled
      expect(state.currentTurnCharacterId).toBe("char1");
    });
  });

  describe("the manual-entry toggle", () => {
    it("defaults ON, so manual entry works with nothing configured", () => {
      expect(state.initiativeManualOverride).toBe(true);

      const result = handler.handleSetInitiative(state, "char1", "player1", 15, 2, false);

      expect(result).toEqual({ broadcast: true, save: true });
    });

    it("refuses a player's manual entry when the DM has turned it off", () => {
      state.initiativeManualOverride = false;

      const result = handler.handleSetInitiative(state, "char1", "player1", 15, 2, false);

      expect(result).toEqual({ broadcast: false, save: false });
      expect(mockCharacterService.setInitiative).not.toHaveBeenCalled();
    });

    it("never blocks the DM, who is who the toggle exists for", () => {
      state.initiativeManualOverride = false;

      const result = handler.handleSetInitiative(state, "char1", "dm-uid", 15, 2, true);

      expect(result).toEqual({ broadcast: true, save: true });
    });

    it("still lets a player CLEAR their initiative while the toggle is off", () => {
      // Clearing is not an override: a player withdrawing from a fight is not
      // claiming a number. Folding the two together would make "no overrides"
      // quietly mean "you can never leave the order".
      state.initiativeManualOverride = false;

      const result = handler.handleSetInitiative(state, "char1", "player1", undefined, 0, false);

      expect(result).toEqual({ broadcast: true, save: true });
      expect(mockCharacterService.clearInitiative).toHaveBeenCalledWith(state, "char1");
    });
  });

  describe("a hand-entered initiative reaches the roll log", () => {
    it("marks it hand-entered STRUCTURALLY, and claims no die", () => {
      state.characters[0].initiativeModifier = 3;

      handler.handleSetInitiative(state, "char1", "player1", 17, 3, false);

      expect(state.diceRolls).toHaveLength(1);
      const roll = state.diceRolls[0];

      // The marker is the load-bearing part. It used to be the word "(entered)"
      // inside a free-text label, which no renderer could act on — so the row
      // looked identical to a rolled one. This is what the log colours.
      expect(roll.handEntered).toBe(true);
      expect(roll.label).toBe("Fighter — initiative");

      // And it no longer says "d20": a row claiming a die is a row claiming the
      // server rolled it, which is the one thing this entry must not say.
      expect(roll.formula).toBe("14 + 3");
      expect(roll.formula).not.toMatch(/d20/);
      expect(roll.breakdown[0].die).toBeUndefined();
      expect(roll.breakdown[0].rolls).toBeUndefined();
      expect(roll.breakdown[0].subtotal).toBe(14);
      expect(roll.breakdown[1].subtotal).toBe(3);

      expect(roll.total).toBe(17);
      expect(roll.playerUid).toBe("player1");
    });

    it("is public for a visible character", () => {
      handler.handleSetInitiative(state, "char1", "player1", 17, 3, false);

      // Absent means public, the convention rollFor already follows.
      expect(state.diceRolls[0].visibility).toBeUndefined();
    });

    it("keeps a HIDDEN character's hand-entered line away from players", () => {
      // The rolled path and this one both name the creature, so gating only
      // the roll would have moved the leak here rather than closed it — and
      // hand entry is the ordinary physical-dice workflow, not an edge case.
      const target = state.characters.find((character) => character.id === "char1");
      if (target) target.visibleToPlayers = false;

      handler.handleSetInitiative(state, "char1", "player1", 17, 3, true);

      expect(state.diceRolls[0].visibility).toBe("dm");
    });

    it("carries the superseded TOTAL, not the die face it used to", () => {
      // First value, then the override the DM allowed after a physical re-roll.
      handler.handleSetInitiative(state, "char1", "player1", 4, 0, false);
      state.characters[0].initiative = 4;
      state.characters[0].initiativeModifier = 0;

      handler.handleSetInitiative(state, "char1", "player1", 18, 0, false);

      expect(state.diceRolls).toHaveLength(2);
      // Roll-level, and the whole result. A struck-out FACE only means anything
      // beside a number claiming to be a die, and this one no longer does —
      // what a reader wants is "it was 4, now it is 18".
      expect(state.diceRolls[1].supersededTotal).toBe(4);
      expect(state.diceRolls[1].total).toBe(18);
      expect(state.diceRolls[1].breakdown[0].dropped).toBeUndefined();
    });

    it("has nothing to strike through on a first entry", () => {
      // The COMMON case at a physical-dice table: there was never a server roll
      // to supersede, so the row shows the number alone.
      handler.handleSetInitiative(state, "char1", "player1", 11, 0, false);

      expect(state.diceRolls[0].handEntered).toBe(true);
      expect(state.diceRolls[0].supersededTotal).toBeUndefined();
    });

    it("takes a number no die could produce without complaint", () => {
      // A DM typing 47 for a monster is legitimate. This used to need a special
      // shape, because the ordinary shape claimed a d20 and 47 is not a face.
      // With no die claimed anywhere, there is nothing left to be inconsistent
      // with, and the two cases produce one shape.
      handler.handleSetInitiative(state, "char3", "dm-uid", 47, 0, true);

      const roll = state.diceRolls[0];
      expect(roll.formula).toBe("47");
      expect(roll.total).toBe(47);
      expect(roll.handEntered).toBe(true);
      expect(roll.breakdown[0].die).toBeUndefined();
      expect(roll.breakdown[0].rolls).toBeUndefined();
    });

    it("logs nothing when initiative is CLEARED — there is no roll to show", () => {
      handler.handleSetInitiative(state, "char1", "player1", undefined, 0, false);

      expect(state.diceRolls).toHaveLength(0);
    });

    it("stores the value even when the log line cannot be written", () => {
      // A missing player record must cost the LOG LINE, never the initiative:
      // a turn order with no explanation beats no turn order.
      const result = handler.handleSetInitiative(state, "char3", "ghost", 12, 0, true);

      expect(result).toEqual({ broadcast: true, save: true });
      expect(mockCharacterService.setInitiative).toHaveBeenCalledWith(state, "char3", 12, 0);
      expect(state.diceRolls).toHaveLength(0);
    });
  });

  describe("handleStartCombat", () => {
    beforeEach(() => {
      // Set up characters with initiative
      state.characters[0].initiative = 15;
      state.characters[0].initiativeModifier = 2;
      state.characters[1].initiative = 18;
      state.characters[1].initiativeModifier = 1;
      state.characters[2].initiative = 10;
      state.characters[2].initiativeModifier = 0;
    });

    it("should allow DM to start combat", () => {
      const result = handler.handleStartCombat(state, "dmPlayer", true);

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(true);
      expect(state.combatActive).toBe(true);
      expect(state.currentTurnCharacterId).toBe("char2"); // Wizard has highest initiative
    });

    it("should reject non-DM starting combat", () => {
      const result = handler.handleStartCombat(state, "player1", false);

      expect(result.broadcast).toBe(false);
      expect(result.save).toBe(false);
      expect(state.combatActive).toBe(false);
      expect(state.currentTurnCharacterId).toBeUndefined();
    });

    it("should start combat with no current turn if no characters have initiative", () => {
      state.characters.forEach((c) => {
        c.initiative = undefined;
        c.initiativeModifier = 0;
      });

      const result = handler.handleStartCombat(state, "dmPlayer", true);

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(true);
      expect(state.combatActive).toBe(true);
      expect(state.currentTurnCharacterId).toBeUndefined();
    });
  });

  describe("handleEndCombat", () => {
    beforeEach(() => {
      state.combatActive = true;
      state.currentTurnCharacterId = "char1";
      state.characters[0].initiative = 15;
      state.characters[1].initiative = 18;
    });

    it("should allow DM to end combat", () => {
      const result = handler.handleEndCombat(state, "dmPlayer", true);

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(true);
      expect(state.combatActive).toBe(false);
      expect(state.currentTurnCharacterId).toBeUndefined();
    });

    it("should NOT discard the rolled initiative when combat ends", () => {
      // Pausing a fight must not cost the table a re-roll. Throwing the rolls
      // away is what the separate "Clear All Initiative" control is for.
      handler.handleEndCombat(state, "dmPlayer", true);

      expect(mockCharacterService.clearAllInitiative).not.toHaveBeenCalled();
      expect(state.characters[0].initiative).toBe(15);
      expect(state.characters[1].initiative).toBe(18);
    });

    it("should reject non-DM ending combat", () => {
      const result = handler.handleEndCombat(state, "player1", false);

      expect(result.broadcast).toBe(false);
      expect(result.save).toBe(false);
      expect(state.combatActive).toBe(true);
      expect(state.currentTurnCharacterId).toBe("char1");
      expect(mockCharacterService.clearAllInitiative).not.toHaveBeenCalled();
    });
  });

  describe("movement budget resets", () => {
    beforeEach(() => {
      state.combatActive = true;
      state.characters[0].initiative = 15;
      state.characters[1].initiative = 18;
      state.characters[2].initiative = 10;
      // Order: char2, char1, char3. Everyone has spent something.
      for (const character of state.characters) {
        character.movementUsed = 20;
        character.movementDiagonals = 3;
      }
      state.currentTurnCharacterId = "char2";
    });

    it("next-turn resets the budget of the character whose turn STARTS, and no one else's", () => {
      handler.handleNextTurn(state, "dmPlayer", true);
      expect(state.currentTurnCharacterId).toBe("char1");
      expect(state.characters[0]).toMatchObject({ movementUsed: 0, movementDiagonals: 0 });
      expect(state.characters[1]).toMatchObject({ movementUsed: 20, movementDiagonals: 3 });
      expect(state.characters[2]).toMatchObject({ movementUsed: 20, movementDiagonals: 3 });
    });

    it("previous-turn is a correction: the pointer moves, nobody's budget refills", () => {
      handler.handlePreviousTurn(state, "dmPlayer", true);
      expect(state.currentTurnCharacterId).toBe("char3");
      expect(state.characters.every((c) => c.movementUsed === 20)).toBe(true);
    });

    it("in round 1 the FIRST turn start resets a spend made before it (only the acting combatant is pre-stamped)", () => {
      // Review round 3: combat start stamped everyone with round 1, so every
      // round-1 turn start was a no-op and a pre-turn spend stood through it.
      // Only the combatant whose turn BEGINS at the start is stamped now.
      handler.handleStartCombat(state, "dmPlayer", true);
      expect(state.characters.filter((c) => "movementRound" in c).map((c) => c.id)).toEqual([
        "char2",
      ]);
      state.characters[0].movementUsed = 25; // moved out of turn during round 1
      state.currentTurnCharacterId = "char2";
      handler.handleNextTurn(state, "dmPlayer", true); // -> char1's first turn
      expect(state.characters[0]).toMatchObject({ movementUsed: 0, movementRound: 1 });
    });

    it("PREV then NEXT from the TOP of the order in round 1 refills nothing — from the state Start Combat actually produces", () => {
      // The clamp `Math.max(1, round - 1)` ate the backward wrap while the
      // forward wrap still counted: two presses minted round 2 and a reset.
      // And the holder Start Combat seats used to carry NO stamp, so the same
      // two presses refilled it by a different road (flagged-items review).
      handler.handleStartCombat(state, "dmPlayer", true); // char2 holds the turn, stamped by the start
      state.characters[1].movementUsed = 30; // and spends it
      handler.handlePreviousTurn(state, "player1", false); // wraps back -> char3, round 0
      expect(state.combatRound).toBe(0);
      handler.handleNextTurn(state, "player1", false); // wraps forward -> char2, round 1 again
      expect(state.combatRound).toBe(1);
      expect(state.currentTurnCharacterId).toBe("char2");
      expect(state.characters[1].movementUsed).toBe(30);
    });

    it("a combatant leaving from the END of the order while acting hands the turn to the top and counts the lap — once", () => {
      state.combatRound = 1;
      for (const c of state.characters) c.movementRound = 1;
      state.currentTurnCharacterId = "char3"; // last in the order, its turn running
      handler.handleSetInitiative(state, "char3", "dmPlayer", undefined, 0, true); // it leaves
      // The turn passed exactly as a NEXT would have: a new lap, the top resets.
      expect(state.currentTurnCharacterId).toBe("char2");
      expect(state.combatRound).toBe(2);
      expect(state.characters[1]).toMatchObject({ movementUsed: 0, movementRound: 2 });
      handler.handleNextTurn(state, "dmPlayer", true); // -> char1, the same lap
      expect(state.currentTurnCharacterId).toBe("char1");
      expect(state.combatRound).toBe(2);
    });

    it("a turn pointer DANGLING outside the order (a loaded file's stale id) still counts the lap the next NEXT opens", () => {
      state.combatRound = 1;
      for (const c of state.characters) c.movementRound = 1;
      state.currentTurnCharacterId = "nobody";
      handler.handleNextTurn(state, "dmPlayer", true); // -> top of the order: a new lap
      expect(state.combatRound).toBe(2);
      expect(state.currentTurnCharacterId).toBe("char2");
      expect(state.characters[1]).toMatchObject({ movementUsed: 0, movementRound: 2 });
    });

    it("a turn start resets once per ROUND: PREV then NEXT back onto yourself refills nothing", () => {
      // Any player can nudge the order (the help text says so), so this is
      // the road a player would take to refill their own budget.
      state.combatRound = 1;
      state.characters[0].movementRound = 1; // char1's turn already started this round
      state.currentTurnCharacterId = "char2";
      handler.handleNextTurn(state, "player1", false); // -> char1: first time this round
      expect(state.currentTurnCharacterId).toBe("char1");
      expect(state.characters[0]).toMatchObject({ movementUsed: 20 }); // stamped 1 already: no reset
      state.characters[0].movementUsed = 25;
      handler.handlePreviousTurn(state, "player1", false); // -> char2
      handler.handleNextTurn(state, "player1", false); // -> char1 again, same round
      expect(state.characters[0].movementUsed).toBe(25);
    });

    it("wrapping the order forward is a new round (everyone resets again); wrapping back un-counts it", () => {
      state.combatRound = 1;
      for (const c of state.characters) c.movementRound = 1;
      state.currentTurnCharacterId = "char3"; // last in the order
      handler.handleNextTurn(state, "dmPlayer", true); // wraps -> char2, round 2
      expect(state.combatRound).toBe(2);
      expect(state.characters[1]).toMatchObject({ movementUsed: 0, movementRound: 2 });
      state.characters[1].movementUsed = 15;
      handler.handlePreviousTurn(state, "dmPlayer", true); // wraps back -> char3, round 1
      expect(state.combatRound).toBe(1);
      handler.handleNextTurn(state, "dmPlayer", true); // forward again -> char2, round 2: already stamped
      expect(state.characters[1].movementUsed).toBe(15);
    });

    it("clearing ONE combatant's initiative passes the turn to the next in order if it was theirs, and keeps its round stamp and its spend", () => {
      // Any player may clear their OWN initiative; zeroing here was a
      // two-click refill (clear, re-roll, walk on) — review round 3. And a
      // pointer BLANKED here sent the next NEXT to the top of the order with a
      // round counted, so everyone behind the leaver lost that round's turn.
      state.combatRound = 1;
      state.currentTurnCharacterId = "char1"; // the middle of char2, char1, char3
      state.characters[0].movementRound = 1;
      handler.handleSetInitiative(state, "char1", "player1", undefined, 0, false);
      expect(state.currentTurnCharacterId).toBe("char3");
      expect(state.combatRound).toBe(1); // no wrap, no lap
      expect(state.characters[2]).toMatchObject({ movementUsed: 0, movementRound: 1 }); // char3's turn began
      expect(state.characters[0]).toMatchObject({ movementUsed: 20, movementDiagonals: 3 });
      expect(state.characters[0].movementRound).toBe(1); // the stamp stays: no second budget this round
      // Someone else's clear leaves the pointer alone.
      state.currentTurnCharacterId = "char2";
      handler.handleSetInitiative(state, "char3", "dmPlayer", undefined, 0, true);
      expect(state.currentTurnCharacterId).toBe("char2");
    });

    it("a tie in the order does not move the survivors: pc-before-npc and array-index tie-breaks hold across a leave", () => {
      // char1 (pc) and char3 (npc) both stand at 15; char2 at 18. The npc is put
      // FIRST in the array, so only the pc-before-npc rule can order the tie —
      // a stable sort with no tie-break would put char3 ahead and make char1
      // the last in the order (a wrap, and round 2).
      state.characters.reverse();
      const byId = (id: string) => state.characters.find((c) => c.id === id)!;
      byId("char1").initiative = 15;
      byId("char2").initiative = 18;
      byId("char3").initiative = 15;
      state.combatRound = 1;
      state.currentTurnCharacterId = "char1";
      handler.handleSetInitiative(state, "char1", "player1", undefined, 0, false);
      expect(state.currentTurnCharacterId).toBe("char3"); // the npc behind it, not char2
      expect(state.combatRound).toBe(1);
    });

    it("the round's floor is one lap below the oldest stamp, and a stamp AHEAD of the round is honoured: PREV laps refill nothing and freeze nothing", () => {
      // Order char2(18), char1(15), char3(10); everyone acted in round 1 and
      // spent 20 (char2: 25). Any player can nudge the order, so this is the
      // road a player would take to refill their own budget: PREV past the top.
      state.combatRound = 1;
      for (const c of state.characters) c.movementRound = 1;
      state.currentTurnCharacterId = "char2";
      state.characters[1].movementUsed = 25;
      handler.handlePreviousTurn(state, "player1", false); // wraps back -> char3, round 0
      handler.handlePreviousTurn(state, "player1", false); // -> char1
      handler.handlePreviousTurn(state, "player1", false); // -> char2
      expect(state.combatRound).toBe(0);
      handler.handleNextTurn(state, "player1", false); // -> char1, round 0: its stamp (1) is AHEAD of the round
      expect(state.currentTurnCharacterId).toBe("char1");
      expect(state.characters[0].movementUsed).toBe(20); // `>=`: no refill
      handler.handlePreviousTurn(state, "player1", false); // -> char2
      handler.handlePreviousTurn(state, "player1", false); // wraps back again: would be -1; the floor (oldest stamp 1, one lap below) holds 0
      expect(state.currentTurnCharacterId).toBe("char3");
      expect(state.combatRound).toBe(0);
      handler.handleNextTurn(state, "player1", false); // wraps -> char2, round 1 (not 0)
      expect(state.currentTurnCharacterId).toBe("char2");
      expect(state.combatRound).toBe(1);
      expect(state.characters[1].movementUsed).toBe(25); // stamped 1 >= 1: no refill
      // Real play resumes: the next forward wrap is a genuine new round and refills.
      handler.handleNextTurn(state, "player1", false); // -> char1
      handler.handleNextTurn(state, "player1", false); // -> char3
      handler.handleNextTurn(state, "player1", false); // wraps -> char2, round 2
      expect(state.combatRound).toBe(2);
      expect(state.characters[1]).toMatchObject({ movementUsed: 0, movementRound: 2 });
    });

    it("the floor is one lap below the NEWEST in-order stamp: with stamps 9 and 8, two laps back park at 8, not 7", () => {
      // Order char2(18), char1(15): char2 acted in round 9, char1 last in 8.
      // The OLDEST stamp would let the round fall to 7 and freeze char2's
      // budget on the way back up.
      state.characters[2].initiative = undefined; // only two in the order
      state.combatRound = 9;
      state.characters[1].movementRound = 9;
      state.characters[0].movementRound = 8;
      state.currentTurnCharacterId = "char2";
      for (let i = 0; i < 4; i += 1) handler.handlePreviousTurn(state, "player1", false); // two laps back
      expect(state.combatRound).toBe(8);
    });

    it("a combatant who LEFT the order keeps its stamp, and that stamp is not the floor's business: in-order only", () => {
      // Order char2(18), char1(15) at round 12, both stamped 9; char3 acted
      // in round 12 and withdrew with its stamp 12 intact. Counting it would
      // hold the round at 11 forever (a PREV that cannot rewind); ignoring it
      // lets the correction walk to 10.
      state.combatRound = 12;
      state.characters[1].movementRound = 9;
      state.characters[0].movementRound = 9;
      state.characters[2].initiative = undefined;
      state.characters[2].movementRound = 12;
      state.currentTurnCharacterId = "char2";
      for (let i = 0; i < 4; i += 1) handler.handlePreviousTurn(state, "player1", false); // two laps back
      expect(state.combatRound).toBe(10);
      expect(state.characters[0].movementUsed).toBe(20); // PREV starts no turn
    });

    it("PREV from a BLANK pointer un-counts the lap NEXT counts from it: the pair nets zero", () => {
      state.combatRound = 3;
      state.currentTurnCharacterId = undefined;
      handler.handlePreviousTurn(state, "player1", false); // -> last in the order
      expect(state.currentTurnCharacterId).toBe("char3");
      handler.handleNextTurn(state, "player1", false); // wraps -> top, the lap counted
      expect(state.combatRound).toBe(3);
    });

    it("clear, re-roll lower, walk on: a leaver re-entering in the SAME round gets no second budget", () => {
      // Order char2(18), char1(15), char3(10), round 1: char1 acted and spent,
      // and the turn moved on to char3.
      state.combatRound = 1;
      state.characters[0].movementRound = 1;
      state.characters[0].movementUsed = 20;
      state.currentTurnCharacterId = "char3";
      handler.handleSetInitiative(state, "char1", "player1", undefined, 0, false); // leaves
      handler.handleSetInitiative(state, "char1", "dmPlayer", 1, 0, true); // re-enters at the bottom
      handler.handleNextTurn(state, "player1", false); // -> char1 (now last; no wrap)
      expect(state.currentTurnCharacterId).toBe("char1");
      expect(state.combatRound).toBe(1);
      expect(state.characters[0].movementUsed).toBe(20); // the stamp stayed: 1 >= 1, no refill
    });

    it("the LAST combatant clearing its own initiative leaves no turn to pass", () => {
      state.combatRound = 1;
      for (const c of state.characters) c.initiative = undefined;
      state.characters[0].initiative = 15;
      state.currentTurnCharacterId = "char1";
      handler.handleSetInitiative(state, "char1", "player1", undefined, 0, false);
      expect(state.currentTurnCharacterId).toBeUndefined();
      expect(state.combatRound).toBe(1);
    });

    it("the ORDINARY road into a fight — the first initiative value — resets everyone", () => {
      // Combat auto-starts on the first initiative (applyInitiative); nobody
      // has to press Start Combat. Budgets left over from the last fight must
      // not open this one.
      state.combatActive = false;
      state.currentTurnCharacterId = undefined;
      for (const character of state.characters) character.initiative = undefined;
      handler.handleSetInitiative(state, "char1", "dmPlayer", 11, 0, true);
      expect(state.combatActive).toBe(true);
      expect(state.currentTurnCharacterId).toBe("char1");
      expect(state.characters[0].movementRound).toBe(1); // the first roller's turn IS starting
      expect(state.characters.every((c) => c.movementUsed === 0 && c.movementDiagonals === 0)).toBe(
        true,
      );
    });

    it("combat active with no turn set: the first initiative gives the turn AND resets that character", () => {
      state.currentTurnCharacterId = undefined;
      for (const character of state.characters) character.initiative = undefined;
      handler.handleSetInitiative(state, "char3", "dmPlayer", 11, 0, true);
      expect(state.currentTurnCharacterId).toBe("char3");
      expect(state.characters[2]).toMatchObject({ movementUsed: 0, movementDiagonals: 0 });
      expect(state.characters[0].movementUsed).toBe(20);
    });

    it("clear-all-initiative leaves combat on but empties the order — so it clears the turn and every budget", () => {
      handler.handleClearAllInitiative(state, "dmPlayer", true);
      expect(state.combatActive).toBe(true);
      expect(state.currentTurnCharacterId).toBeUndefined();
      expect(state.characters.every((c) => c.movementUsed === 0)).toBe(true);
    });

    it("the explicit Start Combat / End Combat buttons reset everyone — both counters, and the round returns to 1", () => {
      state.combatRound = 4;
      handler.handleStartCombat(state, "dmPlayer", true);
      expect(state.combatRound).toBe(1);
      expect(state.characters.every((c) => c.movementUsed === 0 && c.movementDiagonals === 0)).toBe(
        true,
      );
      for (const character of state.characters) {
        character.movementUsed = 5;
        character.movementDiagonals = 2;
      }
      state.combatRound = 3;
      handler.handleEndCombat(state, "dmPlayer", true);
      expect(state.combatRound).toBe(1);
      expect(
        state.characters.every(
          (c) => c.movementUsed === 0 && c.movementDiagonals === 0 && !("movementRound" in c),
        ),
      ).toBe(true);
    });
  });

  describe("handleNextTurn", () => {
    beforeEach(() => {
      state.combatActive = true;
      state.characters[0].initiative = 15;
      state.characters[0].initiativeModifier = 2; // total 17
      state.characters[1].initiative = 18;
      state.characters[1].initiativeModifier = 1; // total 19
      state.characters[2].initiative = 10;
      state.characters[2].initiativeModifier = 0; // total 10
      // Order should be: char2 (19), char1 (17), char3 (10)
      state.currentTurnCharacterId = "char2";
    });

    it("should allow DM to advance to next turn", () => {
      const result = handler.handleNextTurn(state, "dmPlayer", true);

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(true);
      expect(state.currentTurnCharacterId).toBe("char1");
    });

    it("should wrap around to first character when advancing from last", () => {
      state.currentTurnCharacterId = "char3";

      const result = handler.handleNextTurn(state, "dmPlayer", true);

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(true);
      expect(state.currentTurnCharacterId).toBe("char2");
    });

    it("should allow non-DM advancing turn", () => {
      const result = handler.handleNextTurn(state, "player1", false);

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(true);
      expect(state.currentTurnCharacterId).toBe("char1");
    });

    it("should do nothing if no characters in initiative order", () => {
      state.characters.forEach((c) => {
        c.initiative = undefined;
      });

      const result = handler.handleNextTurn(state, "dmPlayer", true);

      expect(result.broadcast).toBe(false);
      expect(result.save).toBe(false);
      expect(state.currentTurnCharacterId).toBe("char2");
    });
  });

  describe("handlePreviousTurn", () => {
    beforeEach(() => {
      state.combatActive = true;
      state.characters[0].initiative = 15;
      state.characters[0].initiativeModifier = 2; // total 17
      state.characters[1].initiative = 18;
      state.characters[1].initiativeModifier = 1; // total 19
      state.characters[2].initiative = 10;
      state.characters[2].initiativeModifier = 0; // total 10
      // Order should be: char2 (19), char1 (17), char3 (10)
      state.currentTurnCharacterId = "char1";
    });

    it("should allow DM to go back to previous turn", () => {
      const result = handler.handlePreviousTurn(state, "dmPlayer", true);

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(true);
      expect(state.currentTurnCharacterId).toBe("char2");
    });

    it("should wrap around to last character when going back from first", () => {
      state.currentTurnCharacterId = "char2";

      const result = handler.handlePreviousTurn(state, "dmPlayer", true);

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(true);
      expect(state.currentTurnCharacterId).toBe("char3");
    });

    it("should allow non-DM going back turn", () => {
      const result = handler.handlePreviousTurn(state, "player1", false);

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(true);
      expect(state.currentTurnCharacterId).toBe("char2");
    });

    it("should do nothing if no characters in initiative order", () => {
      state.characters.forEach((c) => {
        c.initiative = undefined;
      });

      const result = handler.handlePreviousTurn(state, "dmPlayer", true);

      expect(result.broadcast).toBe(false);
      expect(result.save).toBe(false);
      expect(state.currentTurnCharacterId).toBe("char1");
    });
  });

  describe("handleClearAllInitiative", () => {
    beforeEach(() => {
      state.characters[0].initiative = 15;
      state.characters[1].initiative = 18;
      state.characters[2].initiative = 10;
    });

    it("should allow DM to clear all initiative", () => {
      const result = handler.handleClearAllInitiative(state, "dmPlayer", true);

      expect(result.broadcast).toBe(true);
      expect(result.save).toBe(true);
      expect(mockCharacterService.clearAllInitiative).toHaveBeenCalledWith(state);
    });

    it("should reject non-DM clearing all initiative", () => {
      const result = handler.handleClearAllInitiative(state, "player1", false);

      expect(result.broadcast).toBe(false);
      expect(result.save).toBe(false);
      expect(mockCharacterService.clearAllInitiative).not.toHaveBeenCalled();
    });
  });
});
