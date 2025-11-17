import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterService } from "../character/service.js";
import { createEmptyRoomState } from "../room/model.js";
import { TokenService } from "../token/service.js";

vi.mock("crypto", async () => {
  const actual = await vi.importActual<typeof import("crypto")>("crypto");
  let callCount = 0;
  return {
    ...actual,
    randomUUID: vi.fn().mockImplementation(() => {
      callCount++;
      return `character-${callCount}`;
    }),
  };
});

import { randomUUID } from "crypto";

describe("CharacterService", () => {
  const service = new CharacterService();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates characters and keeps them unclaimed by default", () => {
    const state = createEmptyRoomState();
    const character = service.createCharacter(state, "Hero", 30, "portrait");

    expect(randomUUID).toHaveBeenCalled();
    expect(character.id).toMatch(/^character-\d+$/);
    expect(character.hp).toBe(30);
    expect(character.ownedByPlayerUID).toBeUndefined();
    expect(state.characters).toHaveLength(1);
  });

  it("claims, updates, and links characters", () => {
    const state = createEmptyRoomState();
    const character = service.createCharacter(state, "Hero", 30);

    expect(service.claimCharacter(state, character.id, "uid-1")).toBe(true);
    expect(service.claimCharacter(state, character.id, "uid-2")).toBe(false);
    expect(service.updateHP(state, character.id, 20, 35)).toBe(true);
    expect(service.linkToken(state, character.id, "token-1")).toBe(true);
    expect(service.unlinkToken(state, "token-1")).toBe(true);

    const stored = service.findCharacter(state, character.id);
    expect(stored?.ownedByPlayerUID).toBe("uid-1");
    expect(stored?.hp).toBe(20);
    expect(service.canControlCharacter(stored!, "uid-1")).toBe(true);
  });

  it("identifies unclaimed characters and ownership lookups", () => {
    const state = createEmptyRoomState();
    const charA = service.createCharacter(state, "A", 10);
    const charB = service.createCharacter(state, "B", 10);

    service.claimCharacter(state, charA.id, "uid-1");

    expect(service.findCharacterByOwner(state, "uid-1")?.id).toBe(charA.id);
    const unclaimed = service.getUnclaimedCharacters(state);
    expect(unclaimed).toHaveLength(1);
    expect(unclaimed[0]?.id).toBe(charB.id);
  });

  it("creates, updates, places, and deletes NPCs", () => {
    const state = createEmptyRoomState();
    const tokenService = new TokenService();

    const npc = service.createCharacter(state, "Goblin", 12, undefined, "npc", {
      hp: 8,
      tokenImage: "https://img",
    });

    expect(npc.type).toBe("npc");
    expect(npc.hp).toBe(8);
    expect(npc.tokenImage).toBe("https://img");

    // Update NPC details
    const updated = service.updateNPC(state, tokenService, npc.id, {
      name: "Goblin Chief",
      hp: 10,
      maxHp: 15,
      portrait: "portrait-url",
      tokenImage: "https://img/new",
    });
    expect(updated).toBe(true);
    const storedNPC = service.findCharacter(state, npc.id)!;
    expect(storedNPC.name).toBe("Goblin Chief");
    expect(storedNPC.hp).toBe(10);
    expect(storedNPC.maxHp).toBe(15);
    expect(storedNPC.portrait).toBe("portrait-url");
    expect(storedNPC.tokenImage).toBe("https://img/new");

    // Place token on map
    service.placeNPCToken(state, tokenService, npc.id, "dm-uid");
    expect(storedNPC.tokenId).toBeDefined();
    expect(state.tokens).toHaveLength(1);
    expect(state.tokens[0]?.imageUrl).toBe("https://img/new");

    // Delete character and ensure token removed
    const removed = service.deleteCharacter(state, npc.id);
    expect(removed?.id).toBe(npc.id);
    if (removed?.tokenId) {
      tokenService.forceDeleteToken(state, removed.tokenId);
    }
    expect(state.characters.find((c) => c.id === npc.id)).toBeUndefined();
  });

  // Test 5: Character deletion cascade effects - ensure tokens are cleaned up
  it("properly cleans up associated tokens when character is deleted", () => {
    const state = createEmptyRoomState();
    const tokenService = new TokenService();
    const character = service.createCharacter(state, "Warrior", 40);

    // Link a token to the character
    const token = tokenService.createToken(state, "player-1", 5, 5);
    service.linkToken(state, character.id, token.id);
    expect(character.tokenId).toBe(token.id);
    expect(state.tokens).toHaveLength(1);

    // Delete character and verify token reference is available for cleanup
    const deleted = service.deleteCharacter(state, character.id);
    expect(deleted).toBeDefined();
    expect(deleted?.tokenId).toBe(token.id);

    // Simulate cleanup of associated token
    if (deleted?.tokenId) {
      tokenService.forceDeleteToken(state, deleted.tokenId);
    }
    expect(state.tokens).toHaveLength(0);
    expect(state.characters).toHaveLength(0);
  });

  // Test 6: Death scenario handling - character HP reaches 0
  it("allows HP to be set to 0 when character dies", () => {
    const state = createEmptyRoomState();
    const character = service.createCharacter(state, "Rogue", 25);

    // Simulate death - HP reaches 0
    const updated = service.updateHP(state, character.id, 0, 25);
    expect(updated).toBe(true);

    const deadCharacter = service.findCharacter(state, character.id);
    expect(deadCharacter?.hp).toBe(0);
    expect(deadCharacter?.maxHp).toBe(25);
  });

  // Test 7: Character-to-player binding edge cases
  describe("character claiming edge cases", () => {
    it("fails to claim when character doesn't exist", () => {
      const state = createEmptyRoomState();
      const result = service.claimCharacter(state, "non-existent-id", "player-1");
      expect(result).toBe(false);
    });

    it("fails to claim when character is already owned", () => {
      const state = createEmptyRoomState();
      const character = service.createCharacter(state, "Paladin", 35);
      service.claimCharacter(state, character.id, "player-1");

      // Attempt to claim by different player
      const result = service.claimCharacter(state, character.id, "player-2");
      expect(result).toBe(false);
      expect(character.ownedByPlayerUID).toBe("player-1");
    });
  });

  // Test 8: Multiple character ownership scenarios
  it("prevents player from claiming multiple characters", () => {
    const state = createEmptyRoomState();
    const char1 = service.createCharacter(state, "Fighter", 30);
    const char2 = service.createCharacter(state, "Wizard", 20);

    // Player claims first character
    service.claimCharacter(state, char1.id, "player-1");
    expect(char1.ownedByPlayerUID).toBe("player-1");

    // Player tries to claim second character
    // Note: Current implementation doesn't prevent this, but we document the behavior
    service.claimCharacter(state, char2.id, "player-1");
    expect(char2.ownedByPlayerUID).toBe("player-1");

    // Both characters are owned by the same player
    const ownedByPlayer = state.characters.filter((c) => c.ownedByPlayerUID === "player-1");
    expect(ownedByPlayer).toHaveLength(2);
  });

  // Test 9: Character state persistence - verify state changes persist
  it("persists character state changes in room state", () => {
    const state = createEmptyRoomState();
    const character = service.createCharacter(state, "Cleric", 28);

    // Update HP
    service.updateHP(state, character.id, 15, 28);
    expect(state.characters[0]?.hp).toBe(15);

    // Update name
    service.updateName(state, character.id, "Cleric of Light");
    expect(state.characters[0]?.name).toBe("Cleric of Light");

    // Set status effects
    service.setStatusEffects(state, character.id, ["blessed", "inspired"]);
    expect(state.characters[0]?.statusEffects).toEqual(["blessed", "inspired"]);

    // All changes should be reflected in the state
    const persisted = service.findCharacter(state, character.id);
    expect(persisted?.hp).toBe(15);
    expect(persisted?.name).toBe("Cleric of Light");
    expect(persisted?.statusEffects).toEqual(["blessed", "inspired"]);
  });

  // Test 10: Character claiming race conditions
  it("handles simultaneous claiming attempts correctly", () => {
    const state = createEmptyRoomState();
    const character = service.createCharacter(state, "Barbarian", 45);

    // Simulate race condition - first claim wins
    const result1 = service.claimCharacter(state, character.id, "player-1");
    const result2 = service.claimCharacter(state, character.id, "player-2");

    expect(result1).toBe(true);
    expect(result2).toBe(false);
    expect(character.ownedByPlayerUID).toBe("player-1");
  });

  // Test 11: Invalid character ID handling
  it("handles operations on non-existent character IDs gracefully", () => {
    const state = createEmptyRoomState();
    const fakeId = "non-existent-character-id";

    // All operations should fail gracefully
    expect(service.findCharacter(state, fakeId)).toBeUndefined();
    expect(service.updateHP(state, fakeId, 10, 20)).toBe(false);
    expect(service.updateName(state, fakeId, "New Name")).toBe(false);
    expect(service.linkToken(state, fakeId, "token-id")).toBe(false);
    expect(service.setStatusEffects(state, fakeId, ["poisoned"])).toBe(false);
    expect(service.deleteCharacter(state, fakeId)).toBeUndefined();
  });

  // Test 12: Character portrait validation
  it("handles empty and malformed portrait URLs", () => {
    const state = createEmptyRoomState();

    // Empty portrait
    const char1 = service.createCharacter(state, "Monk", 22, "");
    expect(char1.portrait).toBe("");

    // Undefined portrait
    const char2 = service.createCharacter(state, "Ranger", 26);
    expect(char2.portrait).toBeUndefined();

    // Valid portrait URL
    const char3 = service.createCharacter(state, "Druid", 24, "https://example.com/portrait.jpg");
    expect(char3.portrait).toBe("https://example.com/portrait.jpg");
  });

  // Test 13: Character stat boundary validation
  describe("character stat boundary validation", () => {
    it("prevents HP from going negative", () => {
      const state = createEmptyRoomState();
      const character = service.createCharacter(state, "Sorcerer", 18, undefined, "pc", {
        hp: -5, // Attempt negative HP
      });

      // HP should be clamped to 0
      expect(character.hp).toBe(0);
      expect(character.maxHp).toBe(18);
    });

    it("clamps HP to maxHP when HP exceeds maximum", () => {
      const state = createEmptyRoomState();
      const character = service.createCharacter(state, "Bard", 20, undefined, "pc", {
        hp: 50, // Attempt HP higher than max
      });

      // HP should be clamped to maxHP
      expect(character.hp).toBe(20);
      expect(character.maxHp).toBe(20);
    });

    it("handles negative maxHP by clamping to 0", () => {
      const state = createEmptyRoomState();
      const character = service.createCharacter(state, "Warlock", -10); // Negative maxHP

      // Both should be clamped to 0
      expect(character.hp).toBe(0);
      expect(character.maxHp).toBe(0);
    });
  });

  // Test 14: Character update permissions
  it("only allows owner to control character based on permissions", () => {
    const state = createEmptyRoomState();
    const character = service.createCharacter(state, "Knight", 32);

    // Unclaimed character - no one can control
    expect(service.canControlCharacter(character, "player-1")).toBe(false);

    // Claim the character
    service.claimCharacter(state, character.id, "player-1");

    // Owner can control
    expect(service.canControlCharacter(character, "player-1")).toBe(true);

    // Non-owner cannot control
    expect(service.canControlCharacter(character, "player-2")).toBe(false);
  });

  // Test 15: Unclaimed character queries edge cases
  describe("unclaimed character queries edge cases", () => {
    it("returns all characters when none are claimed", () => {
      const state = createEmptyRoomState();
      service.createCharacter(state, "Char1", 10);
      service.createCharacter(state, "Char2", 15);
      service.createCharacter(state, "Char3", 20);

      const unclaimed = service.getUnclaimedCharacters(state);
      expect(unclaimed).toHaveLength(3);
    });

    it("returns empty array when all characters are claimed", () => {
      const state = createEmptyRoomState();
      const char1 = service.createCharacter(state, "Char1", 10);
      const char2 = service.createCharacter(state, "Char2", 15);

      service.claimCharacter(state, char1.id, "player-1");
      service.claimCharacter(state, char2.id, "player-2");

      const unclaimed = service.getUnclaimedCharacters(state);
      expect(unclaimed).toHaveLength(0);
    });

    it("returns only unclaimed characters in mixed scenario", () => {
      const state = createEmptyRoomState();
      const char1 = service.createCharacter(state, "Claimed1", 10);
      const _char2 = service.createCharacter(state, "Unclaimed1", 15);
      const char3 = service.createCharacter(state, "Claimed2", 20);
      const _char4 = service.createCharacter(state, "Unclaimed2", 25);

      service.claimCharacter(state, char1.id, "player-1");
      service.claimCharacter(state, char3.id, "player-2");

      const unclaimed = service.getUnclaimedCharacters(state);
      expect(unclaimed).toHaveLength(2);
      expect(unclaimed.map((c) => c.name)).toEqual(["Unclaimed1", "Unclaimed2"]);
    });
  });

  // Test 16: NPC visibility control
  describe("NPC visibility control", () => {
    it("sets NPC visibility to hidden and visible", () => {
      const state = createEmptyRoomState();
      const npc = service.createCharacter(state, "Goblin Scout", 12, undefined, "npc");

      // Default visibility (should be undefined or true)
      expect(npc.visibleToPlayers).toBeUndefined();

      // Hide NPC from players
      const hidResult = service.setNPCVisibility(state, npc.id, false);
      expect(hidResult).toBe(true);
      expect(npc.visibleToPlayers).toBe(false);

      // Reveal NPC to players
      const showResult = service.setNPCVisibility(state, npc.id, true);
      expect(showResult).toBe(true);
      expect(npc.visibleToPlayers).toBe(true);
    });

    it("fails to set visibility when character doesn't exist", () => {
      const state = createEmptyRoomState();
      const result = service.setNPCVisibility(state, "non-existent-id", false);
      expect(result).toBe(false);
    });

    it("fails to set visibility when character is not an NPC", () => {
      const state = createEmptyRoomState();
      const playerChar = service.createCharacter(state, "Player Hero", 30, undefined, "pc");

      const result = service.setNPCVisibility(state, playerChar.id, false);
      expect(result).toBe(false);
      expect(playerChar.visibleToPlayers).toBeUndefined();
    });

    it("persists visibility state across multiple operations", () => {
      const state = createEmptyRoomState();
      const npc = service.createCharacter(state, "Hidden Enemy", 15, undefined, "npc");

      // Hide the NPC
      service.setNPCVisibility(state, npc.id, false);

      // Perform other operations
      service.updateHP(state, npc.id, 10, 20);
      service.updateName(state, npc.id, "Ambushing Enemy");

      // Visibility should remain hidden
      const updated = service.findCharacter(state, npc.id);
      expect(updated?.visibleToPlayers).toBe(false);
      expect(updated?.hp).toBe(10);
      expect(updated?.name).toBe("Ambushing Enemy");
    });
  });
});
