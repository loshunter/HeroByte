/**
 * Characterization tests for CharacterMessageHandler
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/server/src/ws/messageRouter.ts
 * - create-character (lines 213-226)
 * - claim-character (lines 461-466)
 * - add-player-character (lines 468-501)
 * - delete-player-character (lines 503-526)
 * - update-character-name (lines 528-547)
 * - update-character-hp (lines 549-556)
 * - set-character-status-effects (lines 558-579)
 *
 * Target: apps/server/src/ws/handlers/CharacterMessageHandler.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { MessageRouter } from "../../messageRouter.js";
import { RoomService } from "../../../domains/room/service.js";
import { PlayerService } from "../../../domains/player/service.js";
import { TokenService } from "../../../domains/token/service.js";
import { MapService } from "../../../domains/map/service.js";
import { DiceService } from "../../../domains/dice/service.js";
import { CharacterService } from "../../../domains/character/service.js";
import { PropService } from "../../../domains/prop/service.js";
import { SelectionService } from "../../../domains/selection/service.js";
import { AuthService } from "../../../domains/auth/service.js";
import type { ClientMessage } from "@shared";
import type { WebSocketServer, WebSocket } from "ws";

describe("CharacterMessageHandler - Characterization Tests", () => {
  let messageRouter: MessageRouter;
  let roomService: RoomService;
  let playerService: PlayerService;
  let tokenService: TokenService;
  let mapService: MapService;
  let diceService: DiceService;
  let characterService: CharacterService;
  let propService: PropService;
  let selectionService: SelectionService;
  let authService: AuthService;
  let mockWss: WebSocketServer;
  let mockUidToWs: Map<string, WebSocket>;
  let mockGetAuthorizedClients: () => Set<WebSocket>;

  const playerUid = "player-123";
  const dmUid = "dm-456";

  beforeEach(() => {
    // Initialize services
    roomService = new RoomService();
    playerService = new PlayerService();
    tokenService = new TokenService();
    mapService = new MapService();
    diceService = new DiceService();
    characterService = new CharacterService();
    propService = new PropService();
    selectionService = new SelectionService();
    authService = new AuthService();

    // Mock WebSocket infrastructure
    mockWss = {} as WebSocketServer;
    mockUidToWs = new Map();
    mockGetAuthorizedClients = vi.fn(() => new Set());

    // Setup initial state with players
    roomService.setState({
      players: [
        {
          uid: playerUid,
          name: "Player",
          portrait: "",
          micLevel: 0,
          lastHeartbeat: Date.now(),
          hp: 10,
          maxHp: 10,
          isDM: false,
          statusEffects: [],
        },
        {
          uid: dmUid,
          name: "DM",
          portrait: "",
          micLevel: 0,
          lastHeartbeat: Date.now(),
          hp: 10,
          maxHp: 10,
          isDM: true,
          statusEffects: [],
        },
      ],
      characters: [],
    });

    // Create MessageRouter instance
    messageRouter = new MessageRouter(
      roomService,
      playerService,
      tokenService,
      mapService,
      diceService,
      characterService,
      propService,
      selectionService,
      authService,
      mockWss,
      mockUidToWs,
      mockGetAuthorizedClients,
    );
  });

  describe("create-character message", () => {
    it("should create character when DM creates it", () => {
      const createMessage: ClientMessage = {
        t: "create-character",
        name: "Test Character",
        maxHp: 100,
        portrait: "portrait.png",
      };

      messageRouter.route(createMessage, dmUid);

      const state = roomService.getState();
      expect(state.characters).toHaveLength(1);
      expect(state.characters[0].name).toBe("Test Character");
      expect(state.characters[0].maxHp).toBe(100);
      expect(state.characters[0].hp).toBe(100);
      expect(state.characters[0].portrait).toBe("portrait.png");
      expect(state.characters[0].type).toBe("pc");
    });

    it("should not create character when non-DM tries", () => {
      const createMessage: ClientMessage = {
        t: "create-character",
        name: "Hacked Character",
        maxHp: 100,
        portrait: "",
      };

      messageRouter.route(createMessage, playerUid);

      const state = roomService.getState();
      expect(state.characters).toHaveLength(0);
    });
  });

  describe("claim-character message", () => {
    let characterId: string;

    beforeEach(() => {
      // Create an unclaimed character
      const state = roomService.getState();
      const character = characterService.createCharacter(state, "Unclaimed Char", 80, "");
      characterId = character.id;
      roomService.createSnapshot();
    });

    it("should allow player to claim unclaimed character", () => {
      const claimMessage: ClientMessage = {
        t: "claim-character",
        characterId: characterId,
      };

      messageRouter.route(claimMessage, playerUid);

      const state = roomService.getState();
      const character = state.characters.find((c) => c.id === characterId);
      expect(character?.ownedByPlayerUID).toBe(playerUid);
    });
  });

  describe("add-player-character message", () => {
    it("should create character, auto-claim, and spawn token for player", () => {
      const addMessage: ClientMessage = {
        t: "add-player-character",
        name: "Player Character",
        maxHp: 120,
      };

      messageRouter.route(addMessage, playerUid);

      const state = roomService.getState();

      // Should create character
      expect(state.characters).toHaveLength(1);
      const character = state.characters[0];
      expect(character.name).toBe("Player Character");
      expect(character.maxHp).toBe(120);
      expect(character.hp).toBe(120);
      expect(character.type).toBe("pc");
      expect(character.ownedByPlayerUID).toBe(playerUid);

      // Should auto-claim (sets ownedByPlayerUID)
      expect(character.ownedByPlayerUID).toBe(playerUid);

      // Should create and link token
      expect(state.tokens).toHaveLength(1);
      const token = state.tokens[0];
      expect(token.owner).toBe(playerUid);
      expect(character.tokenId).toBe(token.id);
    });

    it("should use default maxHp if not provided", () => {
      const addMessage: ClientMessage = {
        t: "add-player-character",
        name: "Default HP Character",
      };

      messageRouter.route(addMessage, playerUid);

      const state = roomService.getState();
      const character = state.characters[0];
      expect(character.maxHp).toBe(100); // Default
    });
  });

  describe("delete-player-character message", () => {
    let characterId: string;
    let tokenId: string;

    beforeEach(() => {
      // Create a character owned by player
      const state = roomService.getState();
      const character = characterService.createCharacter(state, "My Character", 100, "", "pc");
      character.ownedByPlayerUID = playerUid;
      characterId = character.id;

      // Create and link a token
      const token = tokenService.createToken(state, playerUid, 100, 100);
      tokenId = token.id;
      characterService.linkToken(state, characterId, tokenId);

      roomService.createSnapshot();
    });

    it("should delete character and linked token when owner deletes", () => {
      const deleteMessage: ClientMessage = {
        t: "delete-player-character",
        characterId: characterId,
      };

      messageRouter.route(deleteMessage, playerUid);

      const state = roomService.getState();
      expect(state.characters.find((c) => c.id === characterId)).toBeUndefined();
      expect(state.tokens.find((t) => t.id === tokenId)).toBeUndefined();
    });

    it("should not delete character when non-owner tries", () => {
      const otherPlayerUid = "other-player";

      // Ensure character has the correct owner
      const beforeState = roomService.getState();
      const charBefore = beforeState.characters.find((c) => c.id === characterId);
      expect(charBefore?.ownedByPlayerUID).toBe(playerUid);

      const deleteMessage: ClientMessage = {
        t: "delete-player-character",
        characterId: characterId,
      };

      messageRouter.route(deleteMessage, otherPlayerUid);

      const state = roomService.getState();
      expect(state.characters.find((c) => c.id === characterId)).toBeDefined();
    });

    it("should remove token from selection when deleted", () => {
      // Select the token first
      selectionService.selectObject(roomService.getState(), playerUid, tokenId);

      const deleteMessage: ClientMessage = {
        t: "delete-player-character",
        characterId: characterId,
      };

      messageRouter.route(deleteMessage, playerUid);

      const state = roomService.getState();
      const selectedObject = state.selectedObjects?.[playerUid];
      expect(selectedObject).toBeUndefined();
    });
  });

  describe("update-character-name message", () => {
    let characterId: string;

    beforeEach(() => {
      // Create a character owned by player
      const state = roomService.getState();
      const character = characterService.createCharacter(state, "Old Name", 100, "", "pc");
      character.ownedByPlayerUID = playerUid;
      characterId = character.id;
      roomService.createSnapshot();
    });

    it("should update character name when owner updates it", () => {
      const updateMessage: ClientMessage = {
        t: "update-character-name",
        characterId: characterId,
        name: "New Name",
      };

      messageRouter.route(updateMessage, playerUid);

      const state = roomService.getState();
      const character = state.characters.find((c) => c.id === characterId);
      expect(character?.name).toBe("New Name");
    });

    it("should not update character name when non-owner tries", () => {
      const otherPlayerUid = "other-player";
      const updateMessage: ClientMessage = {
        t: "update-character-name",
        characterId: characterId,
        name: "Hacked Name",
      };

      messageRouter.route(updateMessage, otherPlayerUid);

      const state = roomService.getState();
      const character = state.characters.find((c) => c.id === characterId);
      expect(character?.name).toBe("Old Name"); // Should not change
    });
  });

  describe("update-character-hp message", () => {
    let characterId: string;

    beforeEach(() => {
      // Create a character
      const state = roomService.getState();
      const character = characterService.createCharacter(state, "Test Char", 100, "");
      characterId = character.id;
      roomService.createSnapshot();
    });

    it("should update character HP", () => {
      const updateMessage: ClientMessage = {
        t: "update-character-hp",
        characterId: characterId,
        hp: 50,
        maxHp: 120,
      };

      messageRouter.route(updateMessage, playerUid);

      const state = roomService.getState();
      const character = state.characters.find((c) => c.id === characterId);
      expect(character?.hp).toBe(50);
      expect(character?.maxHp).toBe(120);
    });
  });

  describe("set-character-status-effects message", () => {
    let characterId: string;

    beforeEach(() => {
      // Create a character owned by player
      const state = roomService.getState();
      const character = characterService.createCharacter(state, "Test Char", 100, "", "pc");
      character.ownedByPlayerUID = playerUid;
      characterId = character.id;
      roomService.createSnapshot();
    });

    it("should set status effects when owner updates them", () => {
      const setEffectsMessage: ClientMessage = {
        t: "set-character-status-effects",
        characterId: characterId,
        effects: ["poisoned", "stunned"],
      };

      messageRouter.route(setEffectsMessage, playerUid);

      const state = roomService.getState();
      const character = state.characters.find((c) => c.id === characterId);
      expect(character?.statusEffects).toEqual(["poisoned", "stunned"]);
    });

    it("should set status effects when DM updates them", () => {
      const setEffectsMessage: ClientMessage = {
        t: "set-character-status-effects",
        characterId: characterId,
        effects: ["blessed"],
      };

      messageRouter.route(setEffectsMessage, dmUid);

      const state = roomService.getState();
      const character = state.characters.find((c) => c.id === characterId);
      expect(character?.statusEffects).toEqual(["blessed"]);
    });

    it("should not set status effects when non-owner tries", () => {
      const otherPlayerUid = "other-player";
      const setEffectsMessage: ClientMessage = {
        t: "set-character-status-effects",
        characterId: characterId,
        effects: ["hacked"],
      };

      messageRouter.route(setEffectsMessage, otherPlayerUid);

      const state = roomService.getState();
      const character = state.characters.find((c) => c.id === characterId);
      // Status effects should be undefined (not set) or empty
      expect(character?.statusEffects === undefined || character?.statusEffects?.length === 0).toBe(true);
    });
  });
});
