/**
 * Characterization tests for PlayerMessageHandler
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/server/src/ws/messageRouter.ts
 * - portrait (lines 190-195)
 * - rename (lines 197-202)
 * - mic-level (lines 204-208)
 * - set-hp (lines 210-215)
 * - set-status-effects (lines 217-222)
 * - toggle-dm (lines 224-228) - DEPRECATED
 *
 * Target: apps/server/src/ws/handlers/PlayerMessageHandler.ts
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

describe("PlayerMessageHandler - Characterization Tests", () => {
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

  describe("portrait message", () => {
    it("should set player portrait", () => {
      const portraitMessage: ClientMessage = {
        t: "portrait",
        data: "data:image/png;base64,iVBORw0KGgoAAAANS...",
      };

      messageRouter.route(portraitMessage, playerUid);

      const state = roomService.getState();
      const player = state.players.find((p) => p.uid === playerUid);
      expect(player?.portrait).toBe("data:image/png;base64,iVBORw0KGgoAAAANS...");
    });

    it("should not set portrait when service returns false", () => {
      const portraitMessage: ClientMessage = {
        t: "portrait",
        data: "",
      };

      // Empty data should not update portrait
      messageRouter.route(portraitMessage, playerUid);

      const state = roomService.getState();
      const player = state.players.find((p) => p.uid === playerUid);
      expect(player?.portrait).toBe(""); // Should remain empty
    });
  });

  describe("rename message", () => {
    it("should rename player", () => {
      const renameMessage: ClientMessage = {
        t: "rename",
        name: "New Player Name",
      };

      messageRouter.route(renameMessage, playerUid);

      const state = roomService.getState();
      const player = state.players.find((p) => p.uid === playerUid);
      expect(player?.name).toBe("New Player Name");
    });

    it("should allow empty name", () => {
      const renameMessage: ClientMessage = {
        t: "rename",
        name: "",
      };

      messageRouter.route(renameMessage, playerUid);

      const state = roomService.getState();
      const player = state.players.find((p) => p.uid === playerUid);
      expect(player?.name).toBe(""); // Service allows empty names
    });
  });

  describe("mic-level message", () => {
    it("should set microphone level", () => {
      const micLevelMessage: ClientMessage = {
        t: "mic-level",
        level: 75,
      };

      messageRouter.route(micLevelMessage, playerUid);

      const state = roomService.getState();
      const player = state.players.find((p) => p.uid === playerUid);
      expect(player?.micLevel).toBe(75);
    });

    it("should handle zero mic level", () => {
      // First set to non-zero
      const setMessage: ClientMessage = {
        t: "mic-level",
        level: 50,
      };
      messageRouter.route(setMessage, playerUid);

      // Then set to zero
      const zeroMessage: ClientMessage = {
        t: "mic-level",
        level: 0,
      };
      messageRouter.route(zeroMessage, playerUid);

      const state = roomService.getState();
      const player = state.players.find((p) => p.uid === playerUid);
      expect(player?.micLevel).toBe(0);
    });

    it("should handle max mic level", () => {
      const micLevelMessage: ClientMessage = {
        t: "mic-level",
        level: 100,
      };

      messageRouter.route(micLevelMessage, playerUid);

      const state = roomService.getState();
      const player = state.players.find((p) => p.uid === playerUid);
      expect(player?.micLevel).toBe(100);
    });
  });

  describe("set-hp message", () => {
    it("should set player HP", () => {
      const setHpMessage: ClientMessage = {
        t: "set-hp",
        hp: 5,
        maxHp: 15,
      };

      messageRouter.route(setHpMessage, playerUid);

      const state = roomService.getState();
      const player = state.players.find((p) => p.uid === playerUid);
      expect(player?.hp).toBe(5);
      expect(player?.maxHp).toBe(15);
    });

    it("should set HP to zero", () => {
      const setHpMessage: ClientMessage = {
        t: "set-hp",
        hp: 0,
        maxHp: 10,
      };

      messageRouter.route(setHpMessage, playerUid);

      const state = roomService.getState();
      const player = state.players.find((p) => p.uid === playerUid);
      expect(player?.hp).toBe(0);
      expect(player?.maxHp).toBe(10);
    });

    it("should handle negative HP values", () => {
      const setHpMessage: ClientMessage = {
        t: "set-hp",
        hp: -5,
        maxHp: 10,
      };

      messageRouter.route(setHpMessage, playerUid);

      const state = roomService.getState();
      const player = state.players.find((p) => p.uid === playerUid);
      expect(player?.hp).toBe(-5);
    });
  });

  describe("set-status-effects message", () => {
    it("should set player status effects", () => {
      const setEffectsMessage: ClientMessage = {
        t: "set-status-effects",
        effects: ["Poisoned", "Blinded"],
      };

      messageRouter.route(setEffectsMessage, playerUid);

      const state = roomService.getState();
      const player = state.players.find((p) => p.uid === playerUid);
      expect(player?.statusEffects).toEqual(["Poisoned", "Blinded"]);
    });

    it("should clear status effects with empty array", () => {
      // First set some effects
      const setMessage: ClientMessage = {
        t: "set-status-effects",
        effects: ["Poisoned"],
      };
      messageRouter.route(setMessage, playerUid);

      // Then clear them
      const clearMessage: ClientMessage = {
        t: "set-status-effects",
        effects: [],
      };
      messageRouter.route(clearMessage, playerUid);

      const state = roomService.getState();
      const player = state.players.find((p) => p.uid === playerUid);
      expect(player?.statusEffects).toEqual([]);
    });

    it("should handle multiple status effects", () => {
      const setEffectsMessage: ClientMessage = {
        t: "set-status-effects",
        effects: ["Poisoned", "Blinded", "Stunned", "Prone"],
      };

      messageRouter.route(setEffectsMessage, playerUid);

      const state = roomService.getState();
      const player = state.players.find((p) => p.uid === playerUid);
      expect(player?.statusEffects).toHaveLength(4);
      expect(player?.statusEffects).toContain("Poisoned");
      expect(player?.statusEffects).toContain("Blinded");
      expect(player?.statusEffects).toContain("Stunned");
      expect(player?.statusEffects).toContain("Prone");
    });
  });

  describe("toggle-dm message (DEPRECATED)", () => {
    it("should be ignored and log warning", () => {
      const consoleSpy = vi.spyOn(console, "warn");

      const toggleDmMessage: ClientMessage = {
        t: "toggle-dm",
      };

      messageRouter.route(toggleDmMessage, playerUid);

      const state = roomService.getState();
      const player = state.players.find((p) => p.uid === playerUid);
      expect(player?.isDM).toBe(false); // Should not change

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("toggle-dm message from"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("ignored - use elevate-to-dm instead"),
      );

      consoleSpy.mockRestore();
    });
  });
});
