/**
 * Characterization tests for TokenMessageHandler
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/server/src/ws/messageRouter.ts
 * - move (lines 94-98)
 * - recolor (lines 100-104)
 * - delete-token (lines 106-120)
 * - update-token-image (lines 122-127)
 * - set-token-size (lines 129-134)
 * - set-token-color (lines 136-147)
 * - link-token (lines 559-564)
 * - clear-all-tokens (lines 815-837)
 *
 * Target: apps/server/src/ws/handlers/TokenMessageHandler.ts
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
import type { ClientMessage, Token } from "@shared";
import type { WebSocketServer, WebSocket } from "ws";

describe("TokenMessageHandler - Characterization Tests", () => {
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
  const tokenId = "token-abc";
  const characterId = "char-xyz";

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

    // Setup initial state with players and tokens
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
      tokens: [
        {
          id: tokenId,
          owner: playerUid,
          x: 100,
          y: 100,
          color: "hsl(0, 70%, 50%)",
          size: "medium",
        } as Token,
      ],
      characters: [
        {
          id: characterId,
          name: "Test Character",
          maxHp: 20,
          hp: 20,
          portrait: "",
          type: "player",
          claimedBy: null,
        },
      ],
    });

    // Trigger scene graph rebuild
    roomService.createSnapshot();

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

  describe("move message", () => {
    it("should move token when owner moves it", () => {
      const moveMessage: ClientMessage = {
        t: "move",
        id: tokenId,
        x: 200,
        y: 250,
      };

      messageRouter.route(moveMessage, playerUid);

      const state = roomService.getState();
      const token = state.tokens.find((t) => t.id === tokenId);
      expect(token?.x).toBe(200);
      expect(token?.y).toBe(250);
    });

    it("should not move token when non-owner tries", () => {
      const otherPlayerUid = "other-player";
      const moveMessage: ClientMessage = {
        t: "move",
        id: tokenId,
        x: 300,
        y: 300,
      };

      messageRouter.route(moveMessage, otherPlayerUid);

      const state = roomService.getState();
      const token = state.tokens.find((t) => t.id === tokenId);
      expect(token?.x).toBe(100); // Original position
      expect(token?.y).toBe(100);
    });
  });

  describe("recolor message", () => {
    it("should recolor token when owner requests it", () => {
      const recolorMessage: ClientMessage = {
        t: "recolor",
        id: tokenId,
      };

      messageRouter.route(recolorMessage, playerUid);

      const state = roomService.getState();
      const token = state.tokens.find((t) => t.id === tokenId);
      expect(token?.color).not.toBe("hsl(0, 70%, 50%)"); // Color should change
    });
  });

  describe("delete-token message", () => {
    it("should delete token when owner deletes it", () => {
      const deleteMessage: ClientMessage = {
        t: "delete-token",
        id: tokenId,
      };

      messageRouter.route(deleteMessage, playerUid);

      const state = roomService.getState();
      expect(state.tokens.find((t) => t.id === tokenId)).toBeUndefined();
    });

    it("should delete any token when DM deletes it", () => {
      const deleteMessage: ClientMessage = {
        t: "delete-token",
        id: tokenId,
      };

      messageRouter.route(deleteMessage, dmUid);

      const state = roomService.getState();
      expect(state.tokens.find((t) => t.id === tokenId)).toBeUndefined();
    });

    it("should remove token from selection when deleted", () => {
      // Select the token first
      selectionService.selectObject(roomService.getState(), playerUid, tokenId);

      const deleteMessage: ClientMessage = {
        t: "delete-token",
        id: tokenId,
      };

      messageRouter.route(deleteMessage, playerUid);

      const state = roomService.getState();
      // Selection service removes the object, so selectedObjects should not have this player's selection anymore
      const selectedObject = state.selectedObjects?.[playerUid];
      expect(selectedObject).toBeUndefined();
    });

    it("should not delete token when non-owner tries", () => {
      const otherPlayerUid = "other-player";
      const deleteMessage: ClientMessage = {
        t: "delete-token",
        id: tokenId,
      };

      messageRouter.route(deleteMessage, otherPlayerUid);

      const state = roomService.getState();
      expect(state.tokens.find((t) => t.id === tokenId)).toBeDefined();
    });
  });

  describe("update-token-image message", () => {
    it("should update token image when owner updates it", () => {
      const updateMessage: ClientMessage = {
        t: "update-token-image",
        tokenId: tokenId,
        imageUrl: "https://example.com/new-image.png",
      };

      messageRouter.route(updateMessage, playerUid);

      const state = roomService.getState();
      const token = state.tokens.find((t) => t.id === tokenId);
      expect(token?.imageUrl).toBe("https://example.com/new-image.png");
    });

    it("should not update token image when non-owner tries", () => {
      const otherPlayerUid = "other-player";
      const updateMessage: ClientMessage = {
        t: "update-token-image",
        tokenId: tokenId,
        imageUrl: "https://example.com/hacked.png",
      };

      messageRouter.route(updateMessage, otherPlayerUid);

      const state = roomService.getState();
      const token = state.tokens.find((t) => t.id === tokenId);
      expect(token?.imageUrl).toBeUndefined(); // Should not change
    });
  });

  describe("set-token-size message", () => {
    it("should set token size when owner updates it", () => {
      const sizeMessage: ClientMessage = {
        t: "set-token-size",
        tokenId: tokenId,
        size: "large",
      };

      messageRouter.route(sizeMessage, playerUid);

      const state = roomService.getState();
      const token = state.tokens.find((t) => t.id === tokenId);
      expect(token?.size).toBe("large");
    });

    it("should not set token size when non-owner tries", () => {
      const otherPlayerUid = "other-player";
      const sizeMessage: ClientMessage = {
        t: "set-token-size",
        tokenId: tokenId,
        size: "huge",
      };

      messageRouter.route(sizeMessage, otherPlayerUid);

      const state = roomService.getState();
      const token = state.tokens.find((t) => t.id === tokenId);
      expect(token?.size).toBe("medium"); // Should not change
    });
  });

  describe("set-token-color message", () => {
    it("should set token color when owner updates it", () => {
      const colorMessage: ClientMessage = {
        t: "set-token-color",
        tokenId: tokenId,
        color: "hsl(120, 70%, 50%)",
      };

      messageRouter.route(colorMessage, playerUid);

      const state = roomService.getState();
      const token = state.tokens.find((t) => t.id === tokenId);
      expect(token?.color).toBe("hsl(120, 70%, 50%)");
    });

    it("should set token color when DM updates it", () => {
      const colorMessage: ClientMessage = {
        t: "set-token-color",
        tokenId: tokenId,
        color: "hsl(240, 70%, 50%)",
      };

      messageRouter.route(colorMessage, dmUid);

      const state = roomService.getState();
      const token = state.tokens.find((t) => t.id === tokenId);
      expect(token?.color).toBe("hsl(240, 70%, 50%)");
    });

    it("should not set token color when non-owner tries", () => {
      const otherPlayerUid = "other-player";
      const colorMessage: ClientMessage = {
        t: "set-token-color",
        tokenId: tokenId,
        color: "hsl(300, 70%, 50%)",
      };

      messageRouter.route(colorMessage, otherPlayerUid);

      const state = roomService.getState();
      const token = state.tokens.find((t) => t.id === tokenId);
      expect(token?.color).toBe("hsl(0, 70%, 50%)"); // Should not change
    });
  });

  describe("link-token message", () => {
    it("should link token to character", () => {
      const linkMessage: ClientMessage = {
        t: "link-token",
        characterId: characterId,
        tokenId: tokenId,
      };

      messageRouter.route(linkMessage, playerUid);

      const state = roomService.getState();
      const character = state.characters.find((c) => c.id === characterId);
      expect(character?.tokenId).toBe(tokenId);
    });
  });

  describe("clear-all-tokens message", () => {
    beforeEach(() => {
      // Add more tokens for clear test
      const state = roomService.getState();
      state.tokens.push(
        {
          id: "token-2",
          owner: dmUid,
          x: 200,
          y: 200,
          color: "hsl(120, 70%, 50%)",
          size: "medium",
        } as Token,
        {
          id: "token-3",
          owner: "other-player",
          x: 300,
          y: 300,
          color: "hsl(240, 70%, 50%)",
          size: "medium",
        } as Token,
      );

      // Add another player
      state.players.push({
        uid: "other-player",
        name: "Other Player",
        portrait: "",
        micLevel: 0,
        lastHeartbeat: Date.now(),
        hp: 10,
        maxHp: 10,
        isDM: false,
        statusEffects: [],
      });

      roomService.createSnapshot();
    });

    it("should clear all tokens except DM's when DM clears", () => {
      const clearMessage: ClientMessage = {
        t: "clear-all-tokens",
      };

      messageRouter.route(clearMessage, dmUid);

      const state = roomService.getState();
      expect(state.tokens).toHaveLength(1);
      expect(state.tokens[0].owner).toBe(dmUid);
    });

    it("should remove all players except DM when DM clears", () => {
      const clearMessage: ClientMessage = {
        t: "clear-all-tokens",
      };

      const initialPlayerCount = roomService.getState().players.length;
      expect(initialPlayerCount).toBe(3); // DM + 2 players

      messageRouter.route(clearMessage, dmUid);

      const state = roomService.getState();
      expect(state.players).toHaveLength(1);
      expect(state.players[0].uid).toBe(dmUid);
    });

    it("should not clear tokens when non-DM tries", () => {
      const clearMessage: ClientMessage = {
        t: "clear-all-tokens",
      };

      messageRouter.route(clearMessage, playerUid);

      const state = roomService.getState();
      expect(state.tokens).toHaveLength(3); // Should not change
    });

    it("should deselect removed players", () => {
      // Select something as other player
      selectionService.selectObject(roomService.getState(), "other-player", "token-3");

      const clearMessage: ClientMessage = {
        t: "clear-all-tokens",
      };

      messageRouter.route(clearMessage, dmUid);

      const state = roomService.getState();
      const selectedObject = state.selectedObjects?.["other-player"];
      expect(selectedObject).toBeUndefined();
    });
  });
});
