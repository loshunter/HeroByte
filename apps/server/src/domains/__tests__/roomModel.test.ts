import { describe, expect, it } from "vitest";
import { createEmptyRoomState, toSnapshot } from "../room/model.js";
import { SceneGraphBuilder } from "../room/scene/SceneGraphBuilder.js";
import { CharacterService } from "../character/service.js";
import { TokenService } from "../token/service.js";

describe("Room Model - toSnapshot", () => {
  const characterService = new CharacterService();
  const tokenService = new TokenService();
  const sceneGraphBuilder = new SceneGraphBuilder();

  describe("NPC visibility filtering", () => {
    it("filters hidden NPCs and their tokens for non-DM players", () => {
      const state = createEmptyRoomState();

      // Create visible NPC
      const visibleNPC = characterService.createCharacter(
        state,
        "Visible Guard",
        20,
        undefined,
        "npc",
      );

      // Create hidden NPC
      const hiddenNPC = characterService.createCharacter(
        state,
        "Hidden Assassin",
        15,
        undefined,
        "npc",
      );
      characterService.setNPCVisibility(state, hiddenNPC.id, false);

      // Place tokens for both NPCs
      characterService.placeNPCToken(state, tokenService, visibleNPC.id, "dm-uid");
      characterService.placeNPCToken(state, tokenService, hiddenNPC.id, "dm-uid");

      // Get snapshot for player (isDM = false)
      const playerSnapshot = toSnapshot(state, false);

      // Player should only see visible NPC
      expect(playerSnapshot.characters).toHaveLength(1);
      expect(playerSnapshot.characters[0]?.id).toBe(visibleNPC.id);
      expect(playerSnapshot.characters[0]?.name).toBe("Visible Guard");

      // Player should only see visible NPC's token
      expect(playerSnapshot.tokens).toHaveLength(1);
      expect(playerSnapshot.tokens[0]?.id).toBe(visibleNPC.tokenId);
    });

    it("shows all NPCs and tokens to DM regardless of visibility", () => {
      const state = createEmptyRoomState();

      // Create visible NPC
      const visibleNPC = characterService.createCharacter(
        state,
        "Visible Guard",
        20,
        undefined,
        "npc",
      );

      // Create hidden NPC
      const hiddenNPC = characterService.createCharacter(
        state,
        "Hidden Assassin",
        15,
        undefined,
        "npc",
      );
      characterService.setNPCVisibility(state, hiddenNPC.id, false);

      // Place tokens for both NPCs
      characterService.placeNPCToken(state, tokenService, visibleNPC.id, "dm-uid");
      characterService.placeNPCToken(state, tokenService, hiddenNPC.id, "dm-uid");

      // Get snapshot for DM (isDM = true)
      const dmSnapshot = toSnapshot(state, true);

      // DM should see both NPCs
      expect(dmSnapshot.characters).toHaveLength(2);
      const characterNames = dmSnapshot.characters.map((c) => c.name).sort();
      expect(characterNames).toEqual(["Hidden Assassin", "Visible Guard"]);

      // DM should see both tokens
      expect(dmSnapshot.tokens).toHaveLength(2);
    });

    it("treats NPCs with undefined visibility as visible", () => {
      const state = createEmptyRoomState();

      // Create NPC without explicit visibility (defaults to undefined)
      const npc = characterService.createCharacter(state, "Default Guard", 18, undefined, "npc");
      expect(npc.visibleToPlayers).toBeUndefined();

      characterService.placeNPCToken(state, tokenService, npc.id, "dm-uid");

      // Get snapshot for player
      const playerSnapshot = toSnapshot(state, false);

      // Player should see NPC with undefined visibility
      expect(playerSnapshot.characters).toHaveLength(1);
      expect(playerSnapshot.characters[0]?.name).toBe("Default Guard");
      expect(playerSnapshot.tokens).toHaveLength(1);
    });

    it("treats NPCs with explicit true visibility as visible", () => {
      const state = createEmptyRoomState();

      // Create NPC with explicit visibility = true
      const npc = characterService.createCharacter(state, "Revealed Enemy", 25, undefined, "npc");
      characterService.setNPCVisibility(state, npc.id, true);

      characterService.placeNPCToken(state, tokenService, npc.id, "dm-uid");

      // Get snapshot for player
      const playerSnapshot = toSnapshot(state, false);

      // Player should see NPC with explicit true visibility
      expect(playerSnapshot.characters).toHaveLength(1);
      expect(playerSnapshot.characters[0]?.name).toBe("Revealed Enemy");
      expect(playerSnapshot.characters[0]?.visibleToPlayers).toBe(true);
      expect(playerSnapshot.tokens).toHaveLength(1);
    });

    it("filters only NPCs with visibility explicitly set to false", () => {
      const state = createEmptyRoomState();

      // Create multiple NPCs with different visibility states
      characterService.createCharacter(state, "NPC1", 10, undefined, "npc"); // undefined
      const npc2 = characterService.createCharacter(state, "NPC2", 10, undefined, "npc");
      characterService.setNPCVisibility(state, npc2.id, true); // true
      const npc3 = characterService.createCharacter(state, "NPC3", 10, undefined, "npc");
      characterService.setNPCVisibility(state, npc3.id, false); // false

      // Get snapshot for player
      const playerSnapshot = toSnapshot(state, false);

      // Player should see NPC1 (undefined) and NPC2 (true), but not NPC3 (false)
      expect(playerSnapshot.characters).toHaveLength(2);
      const visibleNames = playerSnapshot.characters.map((c) => c.name).sort();
      expect(visibleNames).toEqual(["NPC1", "NPC2"]);
    });

    it("does not affect player characters", () => {
      const state = createEmptyRoomState();

      // Create player character
      const playerChar = characterService.createCharacter(state, "Hero", 30, undefined, "pc");
      characterService.claimCharacter(state, playerChar.id, "player-1");

      // Create hidden NPC
      const hiddenNPC = characterService.createCharacter(
        state,
        "Hidden Enemy",
        15,
        undefined,
        "npc",
      );
      characterService.setNPCVisibility(state, hiddenNPC.id, false);

      // Get snapshot for player
      const playerSnapshot = toSnapshot(state, false);

      // Player should see their own character
      expect(playerSnapshot.characters).toHaveLength(1);
      expect(playerSnapshot.characters[0]?.id).toBe(playerChar.id);
      expect(playerSnapshot.characters[0]?.name).toBe("Hero");
    });

    it("handles mixed scenario with player tokens and hidden NPC tokens", () => {
      const state = createEmptyRoomState();

      // Create player character with token
      const playerChar = characterService.createCharacter(state, "Warrior", 35, undefined, "pc");
      characterService.claimCharacter(state, playerChar.id, "player-1");
      const playerToken = tokenService.createToken(state, "player-1", 5, 5);
      characterService.linkToken(state, playerChar.id, playerToken.id);

      // Create visible NPC with token
      const visibleNPC = characterService.createCharacter(state, "Merchant", 10, undefined, "npc");
      characterService.placeNPCToken(state, tokenService, visibleNPC.id, "dm-uid");

      // Create hidden NPC with token
      const hiddenNPC = characterService.createCharacter(state, "Thief", 12, undefined, "npc");
      characterService.setNPCVisibility(state, hiddenNPC.id, false);
      characterService.placeNPCToken(state, tokenService, hiddenNPC.id, "dm-uid");

      // Get snapshot for player
      const playerSnapshot = toSnapshot(state, false);

      // Player should see player character and visible NPC
      expect(playerSnapshot.characters).toHaveLength(2);
      const characterNames = playerSnapshot.characters.map((c) => c.name).sort();
      expect(characterNames).toEqual(["Merchant", "Warrior"]);

      // Player should see player token and visible NPC token (not hidden NPC token)
      expect(playerSnapshot.tokens).toHaveLength(2);
      const tokenIds = playerSnapshot.tokens.map((t) => t.id).sort();
      expect(tokenIds).toContain(playerToken.id);
      expect(tokenIds).toContain(visibleNPC.tokenId);
      expect(tokenIds).not.toContain(hiddenNPC.tokenId);
    });

    it("filters hidden NPC token scene objects for non-DM players", () => {
      const state = createEmptyRoomState();

      // Create NPCs and tokens
      const visibleNPC = characterService.createCharacter(state, "Visible NPC", 10, undefined, "npc");
      const hiddenNPC = characterService.createCharacter(state, "Hidden NPC", 10, undefined, "npc");
      characterService.setNPCVisibility(state, hiddenNPC.id, false);

      characterService.placeNPCToken(state, tokenService, visibleNPC.id, "dm-uid");
      characterService.placeNPCToken(state, tokenService, hiddenNPC.id, "dm-uid");

      // Rebuild scene graph to populate token objects
      state.sceneObjects = sceneGraphBuilder.rebuild(state);

      expect(visibleNPC.tokenId).toBeTruthy();
      expect(hiddenNPC.tokenId).toBeTruthy();

      const visibleTokenSceneId = `token:${visibleNPC.tokenId!}`;
      const hiddenTokenSceneId = `token:${hiddenNPC.tokenId!}`;

      const playerSnapshot = toSnapshot(state, false);
      const dmSnapshot = toSnapshot(state, true);

      expect(playerSnapshot.sceneObjects.some((obj) => obj.id === visibleTokenSceneId)).toBe(true);
      expect(playerSnapshot.sceneObjects.some((obj) => obj.id === hiddenTokenSceneId)).toBe(false);

      expect(dmSnapshot.sceneObjects.some((obj) => obj.id === visibleTokenSceneId)).toBe(true);
      expect(dmSnapshot.sceneObjects.some((obj) => obj.id === hiddenTokenSceneId)).toBe(true);
    });
  });
});
