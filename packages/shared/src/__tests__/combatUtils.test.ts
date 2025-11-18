// ============================================================================
// COMBAT UTILITIES TESTS
// ============================================================================
// Test coverage for combat participation business rules

import { describe, it, expect } from "vitest";
import {
  shouldCharacterParticipateInCombat,
  filterCombatEligibleCharacters,
  isDMCharacter,
} from "../combatUtils.js";
import type { Character, Player } from "../index.js";

describe("shouldCharacterParticipateInCombat", () => {
  describe("NPC characters", () => {
    it("should always allow NPCs to participate in combat", () => {
      const npc: Character = {
        id: "npc-1",
        type: "npc",
        name: "Goblin",
        hp: 10,
        maxHp: 10,
        ownedByPlayerUID: null,
      };

      const players: Player[] = [
        { uid: "dm-user", name: "DM", isDM: true },
        { uid: "player-user", name: "Player 1", isDM: false },
      ];

      expect(shouldCharacterParticipateInCombat(npc, players)).toBe(true);
    });

    it("should allow NPCs even when owned by a player (edge case)", () => {
      const npc: Character = {
        id: "npc-1",
        type: "npc",
        name: "Familiar",
        hp: 5,
        maxHp: 5,
        ownedByPlayerUID: "player-user",
      };

      const players: Player[] = [{ uid: "player-user", name: "Player 1", isDM: false }];

      expect(shouldCharacterParticipateInCombat(npc, players)).toBe(true);
    });
  });

  describe("PC characters owned by regular players", () => {
    it("should allow PCs owned by regular (non-DM) players", () => {
      const pc: Character = {
        id: "pc-1",
        type: "pc",
        name: "Ranger",
        hp: 20,
        maxHp: 20,
        ownedByPlayerUID: "player-user",
      };

      const players: Player[] = [
        { uid: "dm-user", name: "DM", isDM: true },
        { uid: "player-user", name: "Player 1", isDM: false },
      ];

      expect(shouldCharacterParticipateInCombat(pc, players)).toBe(true);
    });

    it("should allow PCs when there is no DM", () => {
      const pc: Character = {
        id: "pc-1",
        type: "pc",
        name: "Wizard",
        hp: 15,
        maxHp: 15,
        ownedByPlayerUID: "player-user",
      };

      const players: Player[] = [{ uid: "player-user", name: "Player 1", isDM: false }];

      expect(shouldCharacterParticipateInCombat(pc, players)).toBe(true);
    });

    it("should allow PCs with no owner", () => {
      const pc: Character = {
        id: "pc-1",
        type: "pc",
        name: "Unclaimed PC",
        hp: 10,
        maxHp: 10,
        ownedByPlayerUID: null,
      };

      const players: Player[] = [{ uid: "dm-user", name: "DM", isDM: true }];

      expect(shouldCharacterParticipateInCombat(pc, players)).toBe(true);
    });
  });

  describe("PC characters owned by DM", () => {
    it("should exclude PCs owned by the DM", () => {
      const dmPC: Character = {
        id: "pc-1",
        type: "pc",
        name: "DM's Character",
        hp: 25,
        maxHp: 25,
        ownedByPlayerUID: "dm-user",
      };

      const players: Player[] = [
        { uid: "dm-user", name: "DM", isDM: true },
        { uid: "player-user", name: "Player 1", isDM: false },
      ];

      expect(shouldCharacterParticipateInCombat(dmPC, players)).toBe(false);
    });

    it("should exclude PCs when DM is identified by isDM flag", () => {
      const dmPC: Character = {
        id: "pc-1",
        type: "pc",
        name: "Game Master PC",
        hp: 30,
        maxHp: 30,
        ownedByPlayerUID: "gm-id",
      };

      const players: Player[] = [
        { uid: "gm-id", name: "Game Master", isDM: true },
        { uid: "player-1", name: "Player 1", isDM: false },
        { uid: "player-2", name: "Player 2", isDM: false },
      ];

      expect(shouldCharacterParticipateInCombat(dmPC, players)).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty players array", () => {
      const pc: Character = {
        id: "pc-1",
        type: "pc",
        name: "Solo PC",
        hp: 10,
        maxHp: 10,
        ownedByPlayerUID: "player-user",
      };

      expect(shouldCharacterParticipateInCombat(pc, [])).toBe(true);
    });

    it("should handle multiple DMs (should use first DM found)", () => {
      const dmPC: Character = {
        id: "pc-1",
        type: "pc",
        name: "DM's Character",
        hp: 20,
        maxHp: 20,
        ownedByPlayerUID: "dm-1",
      };

      const players: Player[] = [
        { uid: "dm-1", name: "DM 1", isDM: true },
        { uid: "dm-2", name: "DM 2", isDM: true },
        { uid: "player-user", name: "Player 1", isDM: false },
      ];

      // Should exclude PC owned by first DM
      expect(shouldCharacterParticipateInCombat(dmPC, players)).toBe(false);
    });

    it("should handle DM with undefined isDM (treated as false)", () => {
      const pc: Character = {
        id: "pc-1",
        type: "pc",
        name: "Player Character",
        hp: 15,
        maxHp: 15,
        ownedByPlayerUID: "player-user",
      };

      const players: Player[] = [
        { uid: "player-user", name: "Player 1" } as Player, // isDM is undefined
      ];

      expect(shouldCharacterParticipateInCombat(pc, players)).toBe(true);
    });
  });
});

describe("filterCombatEligibleCharacters", () => {
  it("should filter out DM's PC from mixed character array", () => {
    const characters: Character[] = [
      {
        id: "pc-1",
        type: "pc",
        name: "Player 1 PC",
        hp: 20,
        maxHp: 20,
        ownedByPlayerUID: "player-1",
      },
      {
        id: "pc-dm",
        type: "pc",
        name: "DM PC",
        hp: 25,
        maxHp: 25,
        ownedByPlayerUID: "dm-user",
      },
      {
        id: "npc-1",
        type: "npc",
        name: "Orc",
        hp: 15,
        maxHp: 15,
        ownedByPlayerUID: null,
      },
    ];

    const players: Player[] = [
      { uid: "dm-user", name: "DM", isDM: true },
      { uid: "player-1", name: "Player 1", isDM: false },
    ];

    const eligible = filterCombatEligibleCharacters(characters, players);

    expect(eligible).toHaveLength(2);
    expect(eligible.find((c) => c.id === "pc-1")).toBeDefined();
    expect(eligible.find((c) => c.id === "npc-1")).toBeDefined();
    expect(eligible.find((c) => c.id === "pc-dm")).toBeUndefined();
  });

  it("should return all characters when no DM is present", () => {
    const characters: Character[] = [
      {
        id: "pc-1",
        type: "pc",
        name: "Player 1 PC",
        hp: 20,
        maxHp: 20,
        ownedByPlayerUID: "player-1",
      },
      {
        id: "pc-2",
        type: "pc",
        name: "Player 2 PC",
        hp: 18,
        maxHp: 18,
        ownedByPlayerUID: "player-2",
      },
      {
        id: "npc-1",
        type: "npc",
        name: "Dragon",
        hp: 100,
        maxHp: 100,
        ownedByPlayerUID: null,
      },
    ];

    const players: Player[] = [
      { uid: "player-1", name: "Player 1", isDM: false },
      { uid: "player-2", name: "Player 2", isDM: false },
    ];

    const eligible = filterCombatEligibleCharacters(characters, players);

    expect(eligible).toHaveLength(3);
  });

  it("should return empty array for empty input", () => {
    const eligible = filterCombatEligibleCharacters([], []);

    expect(eligible).toEqual([]);
  });

  it("should preserve character order", () => {
    const characters: Character[] = [
      {
        id: "npc-1",
        type: "npc",
        name: "Goblin 1",
        hp: 7,
        maxHp: 7,
        ownedByPlayerUID: null,
      },
      {
        id: "pc-1",
        type: "pc",
        name: "Fighter",
        hp: 20,
        maxHp: 20,
        ownedByPlayerUID: "player-1",
      },
      {
        id: "npc-2",
        type: "npc",
        name: "Goblin 2",
        hp: 7,
        maxHp: 7,
        ownedByPlayerUID: null,
      },
    ];

    const players: Player[] = [
      { uid: "dm-user", name: "DM", isDM: true },
      { uid: "player-1", name: "Player 1", isDM: false },
    ];

    const eligible = filterCombatEligibleCharacters(characters, players);

    expect(eligible.map((c) => c.id)).toEqual(["npc-1", "pc-1", "npc-2"]);
  });
});

describe("isDMCharacter", () => {
  describe("DM characters", () => {
    it("should identify PC owned by DM as DM character", () => {
      const dmPC: Character = {
        id: "pc-1",
        type: "pc",
        name: "DM's Character",
        hp: 25,
        maxHp: 25,
        ownedByPlayerUID: "dm-user",
      };

      const players: Player[] = [
        { uid: "dm-user", name: "DM", isDM: true },
        { uid: "player-user", name: "Player 1", isDM: false },
      ];

      expect(isDMCharacter(dmPC, players)).toBe(true);
    });

    it("should handle multiple DM characters", () => {
      const dmPC1: Character = {
        id: "pc-1",
        type: "pc",
        name: "DM Character 1",
        hp: 20,
        maxHp: 20,
        ownedByPlayerUID: "dm-user",
      };

      const dmPC2: Character = {
        id: "pc-2",
        type: "pc",
        name: "DM Character 2",
        hp: 30,
        maxHp: 30,
        ownedByPlayerUID: "dm-user",
      };

      const players: Player[] = [
        { uid: "dm-user", name: "DM", isDM: true },
        { uid: "player-user", name: "Player 1", isDM: false },
      ];

      expect(isDMCharacter(dmPC1, players)).toBe(true);
      expect(isDMCharacter(dmPC2, players)).toBe(true);
    });
  });

  describe("Non-DM characters", () => {
    it("should return false for PC owned by regular player", () => {
      const playerPC: Character = {
        id: "pc-1",
        type: "pc",
        name: "Player's Character",
        hp: 20,
        maxHp: 20,
        ownedByPlayerUID: "player-user",
      };

      const players: Player[] = [
        { uid: "dm-user", name: "DM", isDM: true },
        { uid: "player-user", name: "Player 1", isDM: false },
      ];

      expect(isDMCharacter(playerPC, players)).toBe(false);
    });

    it("should return false for NPCs", () => {
      const npc: Character = {
        id: "npc-1",
        type: "npc",
        name: "Goblin",
        hp: 10,
        maxHp: 10,
        ownedByPlayerUID: null,
      };

      const players: Player[] = [
        { uid: "dm-user", name: "DM", isDM: true },
        { uid: "player-user", name: "Player 1", isDM: false },
      ];

      expect(isDMCharacter(npc, players)).toBe(false);
    });

    it("should return false when there is no DM", () => {
      const pc: Character = {
        id: "pc-1",
        type: "pc",
        name: "Player Character",
        hp: 15,
        maxHp: 15,
        ownedByPlayerUID: "player-user",
      };

      const players: Player[] = [{ uid: "player-user", name: "Player 1", isDM: false }];

      expect(isDMCharacter(pc, players)).toBe(false);
    });

    it("should return false for unowned PC", () => {
      const pc: Character = {
        id: "pc-1",
        type: "pc",
        name: "Unclaimed PC",
        hp: 10,
        maxHp: 10,
        ownedByPlayerUID: null,
      };

      const players: Player[] = [{ uid: "dm-user", name: "DM", isDM: true }];

      expect(isDMCharacter(pc, players)).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty players array", () => {
      const pc: Character = {
        id: "pc-1",
        type: "pc",
        name: "Solo PC",
        hp: 10,
        maxHp: 10,
        ownedByPlayerUID: "player-user",
      };

      expect(isDMCharacter(pc, [])).toBe(false);
    });

    it("should handle undefined isDM (treated as false)", () => {
      const pc: Character = {
        id: "pc-1",
        type: "pc",
        name: "Player Character",
        hp: 15,
        maxHp: 15,
        ownedByPlayerUID: "player-user",
      };

      const players: Player[] = [
        { uid: "player-user", name: "Player 1" } as Player, // isDM is undefined
      ];

      expect(isDMCharacter(pc, players)).toBe(false);
    });
  });
});
