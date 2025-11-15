/**
 * Characterization tests for NPCMessageHandler
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/server/src/ws/messageRouter.ts
 * - create-npc (lines 237-252)
 * - update-npc (lines 254-271)
 * - delete-npc (lines 273-288)
 * - place-npc-token (lines 290-301)
 *
 * Target: apps/server/src/ws/handlers/NPCMessageHandler.ts
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

describe("NPCMessageHandler - Characterization Tests", () => {
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

  describe("create-npc message", () => {
    it("should create NPC when DM creates it", () => {
      const createMessage: ClientMessage = {
        t: "create-npc",
        name: "Goblin",
        maxHp: 50,
        hp: 30,
        portrait: "goblin.png",
        tokenImage: "goblin-token.png",
      };

      messageRouter.route(createMessage, dmUid);

      const state = roomService.getState();
      expect(state.characters).toHaveLength(1);
      expect(state.characters[0].name).toBe("Goblin");
      expect(state.characters[0].maxHp).toBe(50);
      expect(state.characters[0].hp).toBe(30);
      expect(state.characters[0].portrait).toBe("goblin.png");
      expect(state.characters[0].type).toBe("npc");
      expect(state.characters[0].tokenImage).toBe("goblin-token.png");
    });

    it("should not create NPC when non-DM tries", () => {
      const createMessage: ClientMessage = {
        t: "create-npc",
        name: "Hacked NPC",
        maxHp: 100,
        portrait: "",
      };

      messageRouter.route(createMessage, playerUid);

      const state = roomService.getState();
      expect(state.characters).toHaveLength(0);
    });
  });

  describe("update-npc message", () => {
    let npcId: string;

    beforeEach(() => {
      // Create an NPC
      const state = roomService.getState();
      const npc = characterService.createCharacter(
        state,
        "Orc",
        80,
        "orc.png",
        "npc",
        { hp: 80, tokenImage: "orc-token.png" },
      );
      npcId = npc.id;
      roomService.createSnapshot();
    });

    it("should update NPC when DM updates it", () => {
      const updateMessage: ClientMessage = {
        t: "update-npc",
        id: npcId,
        name: "Orc Warrior",
        hp: 60,
        maxHp: 100,
        portrait: "orc-warrior.png",
        tokenImage: "orc-warrior-token.png",
      };

      messageRouter.route(updateMessage, dmUid);

      const state = roomService.getState();
      const npc = state.characters.find((c) => c.id === npcId);
      expect(npc?.name).toBe("Orc Warrior");
      expect(npc?.hp).toBe(60);
      expect(npc?.maxHp).toBe(100);
      expect(npc?.portrait).toBe("orc-warrior.png");
      expect(npc?.tokenImage).toBe("orc-warrior-token.png");
    });

    it("should not update NPC when non-DM tries", () => {
      const updateMessage: ClientMessage = {
        t: "update-npc",
        id: npcId,
        name: "Hacked Orc",
        hp: 10,
        maxHp: 10,
      };

      messageRouter.route(updateMessage, playerUid);

      const state = roomService.getState();
      const npc = state.characters.find((c) => c.id === npcId);
      expect(npc?.name).toBe("Orc"); // Should not change
      expect(npc?.hp).toBe(80);
      expect(npc?.maxHp).toBe(80);
    });
  });

  describe("delete-npc message", () => {
    let npcId: string;
    let tokenId: string;

    beforeEach(() => {
      // Create an NPC with a linked token
      const state = roomService.getState();
      const npc = characterService.createCharacter(state, "Troll", 120, "troll.png", "npc");
      npcId = npc.id;

      // Create and link a token
      const token = tokenService.createToken(state, dmUid, 100, 100);
      tokenId = token.id;
      characterService.linkToken(state, npcId, tokenId);

      roomService.createSnapshot();
    });

    it("should delete NPC and linked token when DM deletes it", () => {
      const deleteMessage: ClientMessage = {
        t: "delete-npc",
        id: npcId,
      };

      messageRouter.route(deleteMessage, dmUid);

      const state = roomService.getState();
      expect(state.characters.find((c) => c.id === npcId)).toBeUndefined();
      expect(state.tokens.find((t) => t.id === tokenId)).toBeUndefined();
    });

    it("should remove token from selection when deleted", () => {
      // Select the token first
      selectionService.selectObject(roomService.getState(), dmUid, tokenId);

      const deleteMessage: ClientMessage = {
        t: "delete-npc",
        id: npcId,
      };

      messageRouter.route(deleteMessage, dmUid);

      const state = roomService.getState();
      const selectedObject = state.selectedObjects?.[dmUid];
      expect(selectedObject).toBeUndefined();
    });

    it("should not delete NPC when non-DM tries", () => {
      const deleteMessage: ClientMessage = {
        t: "delete-npc",
        id: npcId,
      };

      messageRouter.route(deleteMessage, playerUid);

      const state = roomService.getState();
      expect(state.characters.find((c) => c.id === npcId)).toBeDefined();
      expect(state.tokens.find((t) => t.id === tokenId)).toBeDefined();
    });
  });

  describe("place-npc-token message", () => {
    let npcId: string;

    beforeEach(() => {
      // Create an NPC without a token
      const state = roomService.getState();
      const npc = characterService.createCharacter(
        state,
        "Dragon",
        200,
        "dragon.png",
        "npc",
        { tokenImage: "dragon-token.png" },
      );
      npcId = npc.id;
      roomService.createSnapshot();
    });

    it("should place token for NPC when DM requests it", () => {
      const placeMessage: ClientMessage = {
        t: "place-npc-token",
        id: npcId,
      };

      const stateBefore = roomService.getState();
      const tokenCountBefore = stateBefore.tokens.length;

      messageRouter.route(placeMessage, dmUid);

      const state = roomService.getState();
      const npc = state.characters.find((c) => c.id === npcId);

      // Should create a token
      expect(state.tokens).toHaveLength(tokenCountBefore + 1);

      // Should link token to NPC
      expect(npc?.tokenId).toBeDefined();
      const token = state.tokens.find((t) => t.id === npc?.tokenId);
      expect(token).toBeDefined();
      expect(token?.owner).toBe(dmUid);
      expect(token?.imageUrl).toBe("dragon-token.png");
    });

    it("should not place token when non-DM tries", () => {
      const placeMessage: ClientMessage = {
        t: "place-npc-token",
        id: npcId,
      };

      const stateBefore = roomService.getState();
      const tokenCountBefore = stateBefore.tokens.length;

      messageRouter.route(placeMessage, playerUid);

      const state = roomService.getState();
      expect(state.tokens).toHaveLength(tokenCountBefore); // Should not change
    });
  });
});
