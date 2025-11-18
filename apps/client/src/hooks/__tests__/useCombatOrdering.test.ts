// ============================================================================
// COMBAT ORDERING HOOK - TESTS
// ============================================================================
// Test-driven development for combat/initiative ordering logic

import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCombatOrdering } from "../useCombatOrdering";
import type { Character, Player, Token } from "@shared";

describe("useCombatOrdering", () => {
  const createMockPlayer = (uid: string, isDM = false): Player => ({
    uid,
    name: `Player ${uid}`,
    isDM,
  });

  const createMockCharacter = (
    id: string,
    ownedByPlayerUID: string,
    initiative?: number,
    type: "pc" | "npc" = "pc",
  ): Character => ({
    id,
    type,
    name: `Character ${id}`,
    hp: 100,
    maxHp: 100,
    ownedByPlayerUID: type === "npc" ? null : ownedByPlayerUID,
    initiative,
    initiativeModifier: 0,
  });

  const createMockToken = (id: string, owner: string): Token => ({
    id,
    owner,
    x: 0,
    y: 0,
    color: "#FF0000",
  });

  describe("when combat is NOT active", () => {
    it("should return entities in default order: DM first, then players, then NPCs", () => {
      const players = [
        createMockPlayer("dm-1", true),
        createMockPlayer("player-1"),
        createMockPlayer("player-2"),
      ];

      const characters = [
        createMockCharacter("char-dm", "dm-1"),
        createMockCharacter("char-1", "player-1"),
        createMockCharacter("char-2", "player-2"),
        createMockCharacter("npc-1", "", undefined, "npc"),
      ];

      const tokens: Token[] = [];

      const { result } = renderHook(() =>
        useCombatOrdering({
          players,
          characters,
          tokens,
          currentUid: "player-1",
          combatActive: false,
        }),
      );

      // DM entities are separated
      expect(result.current.dmEntities).toHaveLength(1);
      expect(result.current.dmEntities[0].character.id).toBe("char-dm");

      // Regular entities: players then NPCs
      expect(result.current.orderedEntities).toHaveLength(3);
      expect(result.current.orderedEntities[0].character.id).toBe("char-1");
      expect(result.current.orderedEntities[1].character.id).toBe("char-2");
      expect(result.current.orderedEntities[2].character.id).toBe("npc-1");
    });

    it("should keep DM visually separated with border", () => {
      const players = [createMockPlayer("dm-1", true), createMockPlayer("player-1")];
      const characters = [
        createMockCharacter("char-dm", "dm-1"),
        createMockCharacter("char-1", "player-1"),
      ];
      const tokens: Token[] = [];

      const { result } = renderHook(() =>
        useCombatOrdering({
          players,
          characters,
          tokens,
          currentUid: "player-1",
          combatActive: false,
        }),
      );

      // DM should be in dmEntities, not orderedEntities
      expect(result.current.dmEntities).toHaveLength(1);
      const dmEntity = result.current.dmEntities[0];
      expect(dmEntity.isFirstDM).toBe(true);
    });
  });

  describe("when combat IS active", () => {
    it("should reorder entities by initiative and exclude DM's player characters", () => {
      const players = [
        createMockPlayer("dm-1", true),
        createMockPlayer("player-1"),
        createMockPlayer("player-2"),
      ];

      const characters = [
        createMockCharacter("char-dm", "dm-1", 15), // DM with initiative - EXCLUDED from combat
        createMockCharacter("char-1", "player-1", 10), // Lower initiative
        createMockCharacter("char-2", "player-2", 20), // Highest initiative
        createMockCharacter("npc-1", "", 18, "npc"), // NPC with high initiative
      ];

      const tokens: Token[] = [];

      const { result } = renderHook(() =>
        useCombatOrdering({
          players,
          characters,
          tokens,
          currentUid: "player-1",
          combatActive: true,
        }),
      );

      // DM's character should be excluded, so only 3 entities
      expect(result.current.orderedEntities).toHaveLength(3);
      // Sorted by initiative: char-2 (20), npc-1 (18), char-1 (10)
      expect(result.current.orderedEntities[0].character.id).toBe("char-2");
      expect(result.current.orderedEntities[1].character.id).toBe("npc-1");
      expect(result.current.orderedEntities[2].character.id).toBe("char-1");
    });

    it("should handle entities with no initiative (treat as -1)", () => {
      const players = [createMockPlayer("player-1"), createMockPlayer("player-2")];

      const characters = [
        createMockCharacter("char-1", "player-1", 15), // Has initiative
        createMockCharacter("char-2", "player-2"), // No initiative
      ];

      const tokens: Token[] = [];

      const { result } = renderHook(() =>
        useCombatOrdering({
          players,
          characters,
          tokens,
          currentUid: "player-1",
          combatActive: true,
        }),
      );

      // Character with initiative should come first
      expect(result.current.orderedEntities[0].character.id).toBe("char-1");
      expect(result.current.orderedEntities[1].character.id).toBe("char-2");
    });

    it("should mark current turn entity correctly", () => {
      const players = [createMockPlayer("player-1")];
      const characters = [createMockCharacter("char-1", "player-1", 15)];
      const tokens: Token[] = [];

      const { result } = renderHook(() =>
        useCombatOrdering({
          players,
          characters,
          tokens,
          currentUid: "player-1",
          combatActive: true,
          currentTurnCharacterId: "char-1",
        }),
      );

      expect(result.current.orderedEntities[0].isCurrentTurn).toBe(true);
    });

    it("should handle multiple characters per player", () => {
      const players = [createMockPlayer("player-1")];
      const characters = [
        createMockCharacter("char-1a", "player-1", 20),
        createMockCharacter("char-1b", "player-1", 10),
      ];
      const tokens: Token[] = [];

      const { result } = renderHook(() =>
        useCombatOrdering({
          players,
          characters,
          tokens,
          currentUid: "player-1",
          combatActive: true,
        }),
      );

      expect(result.current.orderedEntities).toHaveLength(2);
      // Higher initiative first
      expect(result.current.orderedEntities[0].character.id).toBe("char-1a");
      expect(result.current.orderedEntities[1].character.id).toBe("char-1b");
    });
  });

  describe("entity metadata", () => {
    it("should correctly identify current player's entities", () => {
      const players = [createMockPlayer("player-1"), createMockPlayer("player-2")];
      const characters = [
        createMockCharacter("char-1", "player-1"),
        createMockCharacter("char-2", "player-2"),
      ];
      const tokens: Token[] = [];

      const { result } = renderHook(() =>
        useCombatOrdering({
          players,
          characters,
          tokens,
          currentUid: "player-1",
          combatActive: false,
        }),
      );

      expect(result.current.orderedEntities[0].isMe).toBe(true);
      expect(result.current.orderedEntities[1].isMe).toBe(false);
    });

    it("should link tokens to characters correctly", () => {
      const players = [createMockPlayer("player-1")];
      const characters = [createMockCharacter("char-1", "player-1")];
      const tokens = [createMockToken("token-1", "player-1")];

      // Link character to token
      characters[0].tokenId = "token-1";

      const { result } = renderHook(() =>
        useCombatOrdering({
          players,
          characters,
          tokens,
          currentUid: "player-1",
          combatActive: false,
        }),
      );

      expect(result.current.orderedEntities[0].token?.id).toBe("token-1");
    });
  });

  describe("edge cases", () => {
    it("should handle empty players/characters arrays", () => {
      const { result } = renderHook(() =>
        useCombatOrdering({
          players: [],
          characters: [],
          tokens: [],
          currentUid: "test",
          combatActive: false,
        }),
      );

      expect(result.current.orderedEntities).toEqual([]);
    });

    it("should handle player with no characters", () => {
      const players = [createMockPlayer("player-1")];
      const characters: Character[] = []; // No characters
      const tokens: Token[] = [];

      const { result } = renderHook(() =>
        useCombatOrdering({
          players,
          characters,
          tokens,
          currentUid: "player-1",
          combatActive: false,
        }),
      );

      expect(result.current.orderedEntities).toEqual([]);
    });
  });
});
