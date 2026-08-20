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
import type { CharacterService } from "../../../domains/character/service.js";
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
      getCharactersInInitiativeOrder: vi.fn((state: RoomState) => {
        return state.characters
          .filter((c) => c.initiative !== undefined)
          .sort((a, b) => {
            const aTotal = (a.initiative ?? 0) + (a.initiativeModifier ?? 0);
            const bTotal = (b.initiative ?? 0) + (b.initiativeModifier ?? 0);
            return bTotal - aTotal; // Higher initiative first
          });
      }),
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
    it("records it as a d20 result, labelled as entered rather than rolled", () => {
      state.characters[0].initiativeModifier = 3;

      handler.handleSetInitiative(state, "char1", "player1", 17, 3, false);

      expect(state.diceRolls).toHaveLength(1);
      const roll = state.diceRolls[0];
      expect(roll.label).toBe("Fighter — initiative (entered)");
      expect(roll.formula).toBe("d20 + 3");
      expect(roll.total).toBe(17);
      // The implied face: what the player says the physical die showed.
      expect(roll.breakdown[0].rolls).toEqual([14]);
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

    it("strikes the superseded value through, in the channel advantage uses", () => {
      // First value, then the override the DM allowed after a physical re-roll.
      handler.handleSetInitiative(state, "char1", "player1", 4, 0, false);
      state.characters[0].initiative = 4;
      state.characters[0].initiativeModifier = 0;

      handler.handleSetInitiative(state, "char1", "player1", 18, 0, false);

      expect(state.diceRolls).toHaveLength(2);
      expect(state.diceRolls[1].breakdown[0].rolls).toEqual([18]);
      expect(state.diceRolls[1].breakdown[0].dropped).toEqual([4]);
    });

    it("has nothing to strike through on a first entry", () => {
      handler.handleSetInitiative(state, "char1", "player1", 11, 0, false);

      expect(state.diceRolls[0].breakdown[0].dropped).toBeUndefined();
    });

    it("refuses to call an impossible number a d20 roll", () => {
      // A DM typing 47 for a monster is legitimate; logging it as "d20 rolled
      // 47" would make the log the one thing at the table lying about dice.
      handler.handleSetInitiative(state, "char3", "dm-uid", 47, 0, true);

      const roll = state.diceRolls[0];
      expect(roll.formula).toBe("47");
      expect(roll.total).toBe(47);
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
