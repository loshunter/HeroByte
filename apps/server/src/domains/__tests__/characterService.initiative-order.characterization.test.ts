import { describe, expect, it } from "vitest";
import { CharacterService } from "../character/service.js";
import { createEmptyRoomState } from "../room/model.js";
import type { Character } from "@herobyte/shared";

/**
 * CHARACTERIZATION TESTS for Initiative Order Tiebreaker Logic
 *
 * Purpose: Capture the expected behavior of initiative ordering when characters have tied values.
 *
 * Background: Bug reported where tied initiative values cause unstable sorting, leading to
 * "next/previous" buttons jumping around unpredictably in the DM interface.
 *
 * Expected Tiebreaker Rules:
 * 1. Primary: Initiative value (highest first)
 * 2. Secondary: Character type (PCs before NPCs when tied)
 * 3. Tertiary: Creation order (preserve array position when type and initiative match)
 *
 * These tests document the DESIRED behavior before implementing the fix.
 */
describe("CharacterService - Initiative Order Tiebreaker", () => {
  const service = new CharacterService();

  describe("Basic initiative ordering (no ties)", () => {
    it("orders characters by initiative descending when all have different values", () => {
      const state = createEmptyRoomState();

      // Create characters with different initiative values
      const char1 = service.createCharacter(state, "Fighter", 30, undefined, "pc");
      const char2 = service.createCharacter(state, "Wizard", 20, undefined, "pc");
      const char3 = service.createCharacter(state, "Rogue", 25, undefined, "pc");

      char1.initiative = 15;
      char2.initiative = 22;
      char3.initiative = 18;

      const ordered = service.getCharactersInInitiativeOrder(state);

      expect(ordered).toHaveLength(3);
      expect(ordered[0]?.id).toBe(char2.id); // Wizard (22)
      expect(ordered[1]?.id).toBe(char3.id); // Rogue (18)
      expect(ordered[2]?.id).toBe(char1.id); // Fighter (15)
    });

    it("excludes characters with no initiative set", () => {
      const state = createEmptyRoomState();

      const char1 = service.createCharacter(state, "Fighter", 30, undefined, "pc");
      const char2 = service.createCharacter(state, "Wizard", 20, undefined, "pc");
      const char3 = service.createCharacter(state, "Rogue", 25, undefined, "pc");

      char1.initiative = 15;
      // char2 has no initiative
      char3.initiative = 18;

      const ordered = service.getCharactersInInitiativeOrder(state);

      expect(ordered).toHaveLength(2);
      expect(ordered.find((c) => c.id === char2.id)).toBeUndefined();
    });
  });

  describe("Tied initiatives between same character type", () => {
    it("maintains stable order for tied PCs based on creation order", () => {
      const state = createEmptyRoomState();

      // Create PCs in specific order
      const fighter = service.createCharacter(state, "Fighter", 30, undefined, "pc");
      const paladin = service.createCharacter(state, "Paladin", 35, undefined, "pc");
      const cleric = service.createCharacter(state, "Cleric", 28, undefined, "pc");

      // All have same initiative
      fighter.initiative = 15;
      paladin.initiative = 15;
      cleric.initiative = 15;

      const ordered = service.getCharactersInInitiativeOrder(state);

      // Should maintain creation order: Fighter → Paladin → Cleric
      expect(ordered).toHaveLength(3);
      expect(ordered[0]?.id).toBe(fighter.id);
      expect(ordered[1]?.id).toBe(paladin.id);
      expect(ordered[2]?.id).toBe(cleric.id);
    });

    it("maintains stable order for tied NPCs based on creation order", () => {
      const state = createEmptyRoomState();

      // Create NPCs in specific order
      const goblin1 = service.createCharacter(state, "Goblin 1", 12, undefined, "npc");
      const goblin2 = service.createCharacter(state, "Goblin 2", 12, undefined, "npc");
      const goblin3 = service.createCharacter(state, "Goblin 3", 12, undefined, "npc");

      // All have same initiative
      goblin1.initiative = 10;
      goblin2.initiative = 10;
      goblin3.initiative = 10;

      const ordered = service.getCharactersInInitiativeOrder(state);

      // Should maintain creation order: Goblin 1 → Goblin 2 → Goblin 3
      expect(ordered).toHaveLength(3);
      expect(ordered[0]?.id).toBe(goblin1.id);
      expect(ordered[1]?.id).toBe(goblin2.id);
      expect(ordered[2]?.id).toBe(goblin3.id);
    });
  });

  describe("Tied initiatives between PCs and NPCs", () => {
    it("places PCs before NPCs when initiative is tied", () => {
      const state = createEmptyRoomState();

      // Create PC first, then NPCs
      const fighter = service.createCharacter(state, "Fighter", 30, undefined, "pc");
      const goblin1 = service.createCharacter(state, "Goblin 1", 12, undefined, "npc");
      const goblin2 = service.createCharacter(state, "Goblin 2", 12, undefined, "npc");

      // All have same initiative
      fighter.initiative = 15;
      goblin1.initiative = 15;
      goblin2.initiative = 15;

      const ordered = service.getCharactersInInitiativeOrder(state);

      // PC should come first, then NPCs in creation order
      expect(ordered).toHaveLength(3);
      expect(ordered[0]?.id).toBe(fighter.id); // PC first
      expect(ordered[1]?.id).toBe(goblin1.id); // NPC second (created first)
      expect(ordered[2]?.id).toBe(goblin2.id); // NPC third (created second)
    });

    it("places PCs before NPCs even when NPC was created first", () => {
      const state = createEmptyRoomState();

      // Create NPC first, then PC
      const goblin = service.createCharacter(state, "Goblin", 12, undefined, "npc");
      const fighter = service.createCharacter(state, "Fighter", 30, undefined, "pc");

      // Both have same initiative
      goblin.initiative = 15;
      fighter.initiative = 15;

      const ordered = service.getCharactersInInitiativeOrder(state);

      // PC should come first despite being created second
      expect(ordered).toHaveLength(2);
      expect(ordered[0]?.id).toBe(fighter.id); // PC first
      expect(ordered[1]?.id).toBe(goblin.id); // NPC second
    });

    it("handles multiple PCs and NPCs with same initiative", () => {
      const state = createEmptyRoomState();

      // Create mixed characters in specific order
      const fighter = service.createCharacter(state, "Fighter", 30, undefined, "pc");
      const goblin1 = service.createCharacter(state, "Goblin 1", 12, undefined, "npc");
      const wizard = service.createCharacter(state, "Wizard", 20, undefined, "pc");
      const goblin2 = service.createCharacter(state, "Goblin 2", 12, undefined, "npc");
      const rogue = service.createCharacter(state, "Rogue", 25, undefined, "pc");

      // All have same initiative
      const sharedInit = 15;
      fighter.initiative = sharedInit;
      goblin1.initiative = sharedInit;
      wizard.initiative = sharedInit;
      goblin2.initiative = sharedInit;
      rogue.initiative = sharedInit;

      const ordered = service.getCharactersInInitiativeOrder(state);

      // All PCs should come before all NPCs
      expect(ordered).toHaveLength(5);

      // First 3 should be PCs in creation order
      expect(ordered[0]?.id).toBe(fighter.id);
      expect(ordered[1]?.id).toBe(wizard.id);
      expect(ordered[2]?.id).toBe(rogue.id);

      // Last 2 should be NPCs in creation order
      expect(ordered[3]?.id).toBe(goblin1.id);
      expect(ordered[4]?.id).toBe(goblin2.id);
    });
  });

  describe("Complex mixed initiative scenarios", () => {
    it("applies all tiebreaker rules correctly in a complex scenario", () => {
      const state = createEmptyRoomState();

      // Create characters with various initiative values and types
      const fighter = service.createCharacter(state, "Fighter", 30, undefined, "pc"); // init 20
      const wizard = service.createCharacter(state, "Wizard", 20, undefined, "pc"); // init 15
      const goblin1 = service.createCharacter(state, "Goblin 1", 12, undefined, "npc"); // init 18
      const rogue = service.createCharacter(state, "Rogue", 25, undefined, "pc"); // init 15
      const goblin2 = service.createCharacter(state, "Goblin 2", 12, undefined, "npc"); // init 15
      const orc = service.createCharacter(state, "Orc", 20, undefined, "npc"); // init 20
      const cleric = service.createCharacter(state, "Cleric", 28, undefined, "pc"); // init 12

      fighter.initiative = 20;
      wizard.initiative = 15;
      goblin1.initiative = 18;
      rogue.initiative = 15;
      goblin2.initiative = 15;
      orc.initiative = 20;
      cleric.initiative = 12;

      const ordered = service.getCharactersInInitiativeOrder(state);

      expect(ordered).toHaveLength(7);

      // Initiative 20 group: PC (Fighter) before NPC (Orc)
      expect(ordered[0]?.id).toBe(fighter.id);
      expect(ordered[1]?.id).toBe(orc.id);

      // Initiative 18 group: Only Goblin1
      expect(ordered[2]?.id).toBe(goblin1.id);

      // Initiative 15 group: PCs (Wizard, Rogue) before NPC (Goblin2)
      expect(ordered[3]?.id).toBe(wizard.id);
      expect(ordered[4]?.id).toBe(rogue.id);
      expect(ordered[5]?.id).toBe(goblin2.id);

      // Initiative 12 group: Only Cleric
      expect(ordered[6]?.id).toBe(cleric.id);
    });
  });

  describe("Edge cases", () => {
    it("handles empty character list", () => {
      const state = createEmptyRoomState();
      const ordered = service.getCharactersInInitiativeOrder(state);
      expect(ordered).toHaveLength(0);
    });

    it("handles single character", () => {
      const state = createEmptyRoomState();
      const fighter = service.createCharacter(state, "Fighter", 30, undefined, "pc");
      fighter.initiative = 15;

      const ordered = service.getCharactersInInitiativeOrder(state);
      expect(ordered).toHaveLength(1);
      expect(ordered[0]?.id).toBe(fighter.id);
    });

    it("maintains stable order across multiple calls (stability test)", () => {
      const state = createEmptyRoomState();

      // Create characters with tied initiatives
      const char1 = service.createCharacter(state, "Char1", 30, undefined, "pc");
      const char2 = service.createCharacter(state, "Char2", 20, undefined, "pc");
      const char3 = service.createCharacter(state, "Char3", 25, undefined, "pc");

      char1.initiative = 15;
      char2.initiative = 15;
      char3.initiative = 15;

      // Call multiple times and verify order is consistent
      const order1 = service.getCharactersInInitiativeOrder(state);
      const order2 = service.getCharactersInInitiativeOrder(state);
      const order3 = service.getCharactersInInitiativeOrder(state);

      const getIds = (chars: Character[]) => chars.map((c) => c.id);

      expect(getIds(order1)).toEqual(getIds(order2));
      expect(getIds(order2)).toEqual(getIds(order3));
    });
  });

  describe("Real-world scenario from bug report", () => {
    it("handles 3-way tie scenario that caused the bug", () => {
      const state = createEmptyRoomState();

      // Recreate the scenario from the screenshot:
      // Characters displayed as 1,2,3,4,5,6,7 but next button goes 1→4→5→6→7→2→3→1
      // This suggests characters 2,3,4 have tied initiatives

      const char1 = service.createCharacter(state, "Character 1", 30, undefined, "pc");
      const char2 = service.createCharacter(state, "Character 2", 30, undefined, "npc");
      const char3 = service.createCharacter(state, "Character 3", 30, undefined, "npc");
      const char4 = service.createCharacter(state, "Character 4", 30, undefined, "npc");
      const char5 = service.createCharacter(state, "Character 5", 30, undefined, "pc");
      const char6 = service.createCharacter(state, "Character 6", 30, undefined, "pc");
      const char7 = service.createCharacter(state, "Character 7", 30, undefined, "pc");

      // Set initiatives to create the problematic scenario
      char1.initiative = 20; // Unique
      char2.initiative = 15; // Tied (NPC)
      char3.initiative = 15; // Tied (NPC)
      char4.initiative = 15; // Tied (NPC)
      char5.initiative = 12; // Unique
      char6.initiative = 10; // Unique
      char7.initiative = 8; // Unique

      const ordered = service.getCharactersInInitiativeOrder(state);

      expect(ordered).toHaveLength(7);

      // Expected order with proper tiebreaker:
      // 1. Character 1 (init 20)
      // 2-4. Characters 2,3,4 (init 15, NPCs in creation order)
      // 5. Character 5 (init 12)
      // 6. Character 6 (init 10)
      // 7. Character 7 (init 8)

      expect(ordered[0]?.id).toBe(char1.id);
      expect(ordered[1]?.id).toBe(char2.id); // First NPC created with init 15
      expect(ordered[2]?.id).toBe(char3.id); // Second NPC created with init 15
      expect(ordered[3]?.id).toBe(char4.id); // Third NPC created with init 15
      expect(ordered[4]?.id).toBe(char5.id);
      expect(ordered[5]?.id).toBe(char6.id);
      expect(ordered[6]?.id).toBe(char7.id);
    });
  });
});
