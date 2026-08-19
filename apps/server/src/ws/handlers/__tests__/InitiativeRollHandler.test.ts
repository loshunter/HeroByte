/**
 * InitiativeRollHandler
 *
 * The rolled path: the SERVER throws the die. These tests use the real
 * DiceService rather than a stub, because the thing being asserted is that a
 * roll genuinely lands in state.diceRolls where the table can read it — a stub
 * would let that pass while nothing was logged.
 *
 * @module ws/handlers/__tests__/InitiativeRollHandler.test
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { InitiativeRollHandler } from "../InitiativeRollHandler.js";
import type { Character } from "@herobyte/shared";
import { createEmptyRoomState } from "../../../domains/room/model.js";
import type { RoomState } from "../../../domains/room/model.js";
import type { CharacterService } from "../../../domains/character/service.js";
import { DiceService } from "../../../domains/dice/service.js";
import type { PlayerService } from "../../../domains/player/service.js";

describe("InitiativeRollHandler", () => {
  let rollHandler: InitiativeRollHandler;
  let mockCharacterService: CharacterService;
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

    diceService = new DiceService();
    mockPlayerService = {
      findPlayer: vi.fn((_state: RoomState, uid: string) =>
        uid === "ghost" ? undefined : { uid, name: `Player ${uid}` },
      ),
    } as unknown as PlayerService;

    rollHandler = new InitiativeRollHandler(mockCharacterService, diceService, mockPlayerService);
  });

  describe("handleRollInitiative", () => {
    // A seeded stand-in for cryptoDiceRng: the sequence is fixed, so "the
    // server rolled this" is provable rather than asserted. Faces are ignored
    // deliberately — a d20 that started returning d6 values would still pass
    // here, which is why one test below asserts the FORMULA too.
    const seeded = (values: number[]) => {
      let i = 0;
      return () => values[i++ % values.length];
    };

    it("rolls the die itself and stores the total as initiative", () => {
      const result = rollHandler.handleRollInitiative(
        state,
        "char1",
        "player1",
        false,
        undefined,
        seeded([14]),
      );

      expect(result).toEqual({ broadcast: true, save: true });
      expect(mockCharacterService.setInitiative).toHaveBeenCalledWith(state, "char1", 14, 0);
    });

    it("puts the roll in the log where the table can see it", () => {
      rollHandler.handleRollInitiative(state, "char1", "player1", false, undefined, seeded([9]));

      expect(state.diceRolls).toHaveLength(1);
      const roll = state.diceRolls[0];
      expect(roll.total).toBe(9);
      expect(roll.formula).toBe("d20");
      expect(roll.label).toBe("Fighter — initiative");
      // Public by omission: turn order the table cannot check is not turn order.
      expect(roll.visibility).toBeUndefined();
      // Bound from the connection, not from the character being rolled for.
      expect(roll.playerUid).toBe("player1");
      expect(roll.playerName).toBe("Player player1");
    });

    it("adds the character's modifier, and says so in the formula", () => {
      state.characters[0].initiativeModifier = 3;

      rollHandler.handleRollInitiative(state, "char1", "player1", false, undefined, seeded([14]));

      expect(state.diceRolls[0].formula).toBe("d20 + 3");
      expect(state.diceRolls[0].total).toBe(17);
      expect(mockCharacterService.setInitiative).toHaveBeenCalledWith(state, "char1", 17, 3);
    });

    it("contributes no term for a zero modifier, so the log reads d20", () => {
      // "d20 + 0" is noise on every roll by a character with no bonus, which
      // is most of them.
      rollHandler.handleRollInitiative(state, "char1", "player1", false, undefined, seeded([5]));

      expect(state.diceRolls[0].formula).toBe("d20");
      expect(state.diceRolls[0].breakdown).toHaveLength(1);
    });

    it("rolls with the modifier the sender supplied, and persists it over the stored one", () => {
      // The dial and the roll are ONE gesture in the modal: drag to +5, press
      // Roll. Before the message carried a modifier the server applied the +2
      // it still had on file, and nothing anywhere failed — the number just
      // came back wrong.
      state.characters[0].initiativeModifier = 2;

      rollHandler.handleRollInitiative(state, "char1", "player1", false, 5, seeded([10]));

      expect(state.diceRolls[0].formula).toBe("d20 + 5");
      expect(state.diceRolls[0].total).toBe(15);
      // The fourth argument is what applyInitiative writes back, so a supplied
      // modifier STICKS rather than applying to one roll and then reverting.
      expect(mockCharacterService.setInitiative).toHaveBeenCalledWith(state, "char1", 15, 5);
    });

    it("treats a supplied zero as a real value, not as 'use the stored one'", () => {
      // Guards the `??` in the fallback. Under `||` a deliberate 0 — a player
      // clearing their bonus — would silently pick the stored modifier back up,
      // and the only visible symptom would be a total nobody can account for.
      state.characters[0].initiativeModifier = 4;

      rollHandler.handleRollInitiative(state, "char1", "player1", false, 0, seeded([11]));

      expect(state.diceRolls[0].formula).toBe("d20");
      expect(state.diceRolls[0].total).toBe(11);
      expect(mockCharacterService.setInitiative).toHaveBeenCalledWith(state, "char1", 11, 0);
    });

    it("refuses a player rolling for a character they do not own, and logs nothing", () => {
      const result = rollHandler.handleRollInitiative(
        state,
        "char2",
        "player1",
        false,
        undefined,
        seeded([20]),
      );

      expect(result).toEqual({ broadcast: false, save: false });
      expect(state.diceRolls).toHaveLength(0);
      expect(mockCharacterService.setInitiative).not.toHaveBeenCalled();
    });

    it("lets the DM roll for a character they do not own", () => {
      const result = rollHandler.handleRollInitiative(
        state,
        "char3",
        "dm-uid",
        true,
        undefined,
        seeded([12]),
      );

      expect(result).toEqual({ broadcast: true, save: true });
      expect(state.diceRolls[0].label).toBe("Goblin — initiative");
    });

    it("drops a roll from a uid with no player record rather than inventing one", () => {
      const result = rollHandler.handleRollInitiative(
        state,
        "char3",
        "ghost",
        true,
        undefined,
        seeded([20]),
      );

      expect(result).toEqual({ broadcast: false, save: false });
      expect(state.diceRolls).toHaveLength(0);
    });

    it("refuses an unknown character", () => {
      const result = rollHandler.handleRollInitiative(
        state,
        "nope",
        "player1",
        true,
        undefined,
        seeded([20]),
      );

      expect(result).toEqual({ broadcast: false, save: false });
      expect(state.diceRolls).toHaveLength(0);
    });

    it("auto-starts combat on the first roll, like the manual path does", () => {
      expect(state.combatActive).toBe(false);

      rollHandler.handleRollInitiative(state, "char1", "player1", false, undefined, seeded([14]));

      expect(state.combatActive).toBe(true);
      expect(state.currentTurnCharacterId).toBe("char1");
    });
  });
});
