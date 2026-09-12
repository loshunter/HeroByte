// ============================================================================
// COMBAT ORDERING HOOK - TESTS
// ============================================================================
// Test-driven development for combat/initiative ordering logic

import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCombatOrdering } from "../useCombatOrdering";
import type { Character, Player, Token } from "@herobyte/shared";

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
      expect(result.current.dmEntities.map((e) => e.character.id)).toEqual(["char-dm"]);
      // The separator flag (written by the hook, read by no renderer today —
      // the group is gated on the bench's length): pinned here so a reader
      // that arrives finds it true.
      expect(result.current.dmEntities[0].isFirstDM).toBe(true);
    });
  });

  describe("when combat IS active", () => {
    it("reorders by initiative; the DM's ROLLED character stands in the order (kind dm), the unrolled one stays on the bench (F3)", () => {
      const players = [
        createMockPlayer("dm-1", true),
        createMockPlayer("player-1"),
        createMockPlayer("player-2"),
      ];

      const characters = [
        createMockCharacter("char-dm", "dm-1", 15), // the DM's ally, rolled — IN the order
        createMockCharacter("char-dm-bench", "dm-1"), // the DM's understudy — the bench
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
          currentTurnCharacterId: "char-dm",
        }),
      );

      // Sorted by initiative: char-2 (20), npc-1 (18), char-dm (15), char-1 (10)
      expect(result.current.orderedEntities.map((e) => e.character.id)).toEqual([
        "char-2",
        "npc-1",
        "char-dm",
        "char-1",
      ]);
      const ally = result.current.orderedEntities[2];
      expect(ally.kind).toBe("dm"); // the DM's affordances travel with the card
      expect(ally.isCurrentTurn).toBe(true); // the turn mark can land on it
      // The bench: only the unrolled one.
      expect(result.current.dmEntities.map((e) => e.character.id)).toEqual(["char-dm-bench"]);
    });

    it("a CO-DM's character (any DM is a DM) sits on the bench unrolled and joins the order rolled — never nowhere", () => {
      const players = [
        createMockPlayer("dm-1", true),
        createMockPlayer("dm-2", true),
        createMockPlayer("player-1"),
      ];
      const characters = [
        createMockCharacter("char-codm-bench", "dm-2"), // unrolled: the bench, not the void
        createMockCharacter("char-codm", "dm-2", 14), // rolled: the order
        createMockCharacter("char-1", "player-1", 10),
      ];
      const { result } = renderHook(() =>
        useCombatOrdering({
          players,
          characters,
          tokens: [],
          currentUid: "dm-2",
          combatActive: true,
        }),
      );
      expect(result.current.dmEntities.map((e) => e.character.id)).toEqual(["char-codm-bench"]);
      expect(result.current.orderedEntities.map((e) => e.character.id)).toEqual([
        "char-codm",
        "char-1",
      ]);
    });

    it("after END COMBAT (initiatives kept) the DM's rolled character comes home to the bench — the ordered branch still runs for the players", () => {
      const players = [createMockPlayer("dm-1", true), createMockPlayer("player-1")];
      const characters = [
        createMockCharacter("char-dm", "dm-1", 15),
        createMockCharacter("char-1", "player-1", 10),
      ];
      const { result } = renderHook(() =>
        useCombatOrdering({
          players,
          characters,
          tokens: [],
          currentUid: "dm-1",
          combatActive: false, // the fight ended; the rolls are still on file
        }),
      );
      expect(result.current.dmEntities.map((e) => e.character.id)).toEqual(["char-dm"]);
      expect(result.current.orderedEntities.map((e) => e.character.id)).toEqual(["char-1"]);
    });

    it("combat off with ONLY the DM's character rolled: the default branch, the card on the bench, the order empty", () => {
      const players = [createMockPlayer("dm-1", true), createMockPlayer("player-1")];
      const characters = [
        createMockCharacter("char-dm", "dm-1", 15),
        createMockCharacter("char-1", "player-1"),
      ];
      const { result } = renderHook(() =>
        useCombatOrdering({
          players,
          characters,
          tokens: [],
          currentUid: "dm-1",
          combatActive: false,
        }),
      );
      expect(result.current.dmEntities.map((e) => e.character.id)).toEqual(["char-dm"]);
      expect(result.current.orderedEntities.map((e) => e.character.id)).toEqual(["char-1"]);
    });

    it("with nothing rolled anywhere (the default branch) every DM-owned character is the bench", () => {
      const players = [createMockPlayer("dm-1", true), createMockPlayer("dm-2", true)];
      const characters = [
        createMockCharacter("char-dm", "dm-1"),
        createMockCharacter("char-codm", "dm-2"),
      ];
      const { result } = renderHook(() =>
        useCombatOrdering({
          players,
          characters,
          tokens: [],
          currentUid: "dm-1",
          combatActive: false,
        }),
      );
      expect(result.current.dmEntities.map((e) => e.character.id)).toEqual([
        "char-dm",
        "char-codm",
      ]);
      expect(result.current.orderedEntities).toEqual([]);
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

    it("falls back to the owner's token only for a player with ONE character — never for the second of two", () => {
      const players = [createMockPlayer("player-1")];
      const tokens = [createMockToken("tok-1", "player-1")];
      const one = renderHook(() =>
        useCombatOrdering({
          players,
          characters: [createMockCharacter("char-a", "player-1")],
          tokens,
          currentUid: "player-1",
          combatActive: false,
        }),
      );
      expect(one.result.current.orderedEntities[0].token?.id).toBe("tok-1");
      const two = renderHook(() =>
        useCombatOrdering({
          players,
          characters: [
            createMockCharacter("char-a", "player-1"),
            createMockCharacter("char-b", "player-1"),
          ],
          tokens,
          currentUid: "player-1",
          combatActive: false,
        }),
      );
      expect(two.result.current.orderedEntities.map((e) => e.token?.id)).toEqual([
        undefined,
        undefined,
      ]);
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
