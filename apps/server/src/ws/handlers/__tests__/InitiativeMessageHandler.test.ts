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
import type { Character } from "@shared";
import { createEmptyRoomState } from "../../../domains/room/model.js";
import type { RoomState } from "../../../domains/room/model.js";
import type { CharacterService } from "../../../domains/character/service.js";
import type { RoomService } from "../../../domains/room/service.js";

describe("InitiativeMessageHandler", () => {
  let handler: InitiativeMessageHandler;
  let mockCharacterService: CharacterService;
  let mockRoomService: RoomService;
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

    handler = new InitiativeMessageHandler(mockCharacterService, mockRoomService);
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
      expect(mockCharacterService.clearAllInitiative).toHaveBeenCalledWith(state);
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
