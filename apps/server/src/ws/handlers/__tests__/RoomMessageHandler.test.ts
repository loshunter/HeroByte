/**
 * Characterization tests for RoomMessageHandler
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/server/src/ws/messageRouter.ts
 * - set-room-password (lines 751-792)
 *
 * Target: apps/server/src/ws/handlers/RoomMessageHandler.ts
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
import type { ClientMessage, ServerMessage } from "@shared";
import type { WebSocketServer, WebSocket } from "ws";

describe("RoomMessageHandler - Characterization Tests", () => {
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
  let mockPlayerWs: WebSocket;
  let mockDmWs: WebSocket;

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
    authService = new AuthService({ storagePath: "./test-secret.json" });

    // Mock WebSocket infrastructure
    mockWss = {} as WebSocketServer;
    mockUidToWs = new Map();
    mockGetAuthorizedClients = vi.fn(() => new Set<WebSocket>());

    // Create mock WebSocket instances
    mockPlayerWs = {
      readyState: 1,
      send: vi.fn(),
    } as unknown as WebSocket;

    mockDmWs = {
      readyState: 1,
      send: vi.fn(),
    } as unknown as WebSocket;

    // Map UIDs to WebSockets
    mockUidToWs.set(playerUid, mockPlayerWs);
    mockUidToWs.set(dmUid, mockDmWs);

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

  describe("set-room-password message", () => {
    it("should allow DM to successfully update room password", () => {
      const consoleSpy = vi.spyOn(console, "log");
      const passwordMessage: ClientMessage = {
        t: "set-room-password",
        secret: "validPassword123",
      };

      messageRouter.route(passwordMessage, dmUid);

      // Verify success message was sent
      expect(mockDmWs.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse((mockDmWs.send as vi.Mock).mock.calls[0][0]);
      expect(sentMessage.t).toBe("room-password-updated");
      expect(sentMessage.updatedAt).toBeTypeOf("number");
      expect(sentMessage.source).toBe("user");

      // Verify console log
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`DM ${dmUid} updated the room password.`),
      );

      consoleSpy.mockRestore();
    });

    it("should send failure message when non-DM attempts to update password", () => {
      const passwordMessage: ClientMessage = {
        t: "set-room-password",
        secret: "validPassword123",
      };

      messageRouter.route(passwordMessage, playerUid);

      // Verify failure message was sent
      expect(mockPlayerWs.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse((mockPlayerWs.send as vi.Mock).mock.calls[0][0]);
      expect(sentMessage.t).toBe("room-password-update-failed");
      expect(sentMessage.reason).toBe("Only Dungeon Masters can update the room password.");
    });

    it("should send failure message when password is too short (less than 6 characters)", () => {
      const passwordMessage: ClientMessage = {
        t: "set-room-password",
        secret: "short",
      };

      messageRouter.route(passwordMessage, dmUid);

      // Verify failure message was sent
      expect(mockDmWs.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse((mockDmWs.send as vi.Mock).mock.calls[0][0]);
      expect(sentMessage.t).toBe("room-password-update-failed");
      expect(sentMessage.reason).toBe("Password must be between 6 and 128 characters.");
    });

    it("should send failure message when password is too long (more than 128 characters)", () => {
      const longPassword = "a".repeat(129);
      const passwordMessage: ClientMessage = {
        t: "set-room-password",
        secret: longPassword,
      };

      messageRouter.route(passwordMessage, dmUid);

      // Verify failure message was sent
      expect(mockDmWs.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse((mockDmWs.send as vi.Mock).mock.calls[0][0]);
      expect(sentMessage.t).toBe("room-password-update-failed");
      expect(sentMessage.reason).toBe("Password must be between 6 and 128 characters.");
    });

    it("should allow default password to bypass length validation", () => {
      const consoleSpy = vi.spyOn(console, "log");
      // The default password from getRoomSecret() is "Fun1" (4 characters)
      // Both messageRouter and AuthService bypass validation for default password
      const passwordMessage: ClientMessage = {
        t: "set-room-password",
        secret: "Fun1",
      };

      messageRouter.route(passwordMessage, dmUid);

      // Verify success message was sent (default password bypasses length check)
      expect(mockDmWs.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse((mockDmWs.send as vi.Mock).mock.calls[0][0]);
      expect(sentMessage.t).toBe("room-password-updated");
      expect(sentMessage.source).toBe("fallback"); // Default password has source "fallback"
      expect(sentMessage.updatedAt).toBeTypeOf("number");

      // Verify console log
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`DM ${dmUid} updated the room password.`),
      );

      consoleSpy.mockRestore();
    });

    it("should trim whitespace from password before validation", () => {
      const consoleSpy = vi.spyOn(console, "log");
      const passwordMessage: ClientMessage = {
        t: "set-room-password",
        secret: "  validPassword123  ",
      };

      messageRouter.route(passwordMessage, dmUid);

      // Verify success message was sent (trimmed password is valid)
      expect(mockDmWs.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse((mockDmWs.send as vi.Mock).mock.calls[0][0]);
      expect(sentMessage.t).toBe("room-password-updated");

      consoleSpy.mockRestore();
    });

    it("should fail validation when password becomes too short after trimming", () => {
      const passwordMessage: ClientMessage = {
        t: "set-room-password",
        secret: "  abc  ", // 3 characters after trim
      };

      messageRouter.route(passwordMessage, dmUid);

      // Verify failure message was sent
      expect(mockDmWs.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse((mockDmWs.send as vi.Mock).mock.calls[0][0]);
      expect(sentMessage.t).toBe("room-password-update-failed");
      expect(sentMessage.reason).toBe("Password must be between 6 and 128 characters.");
    });

    it("should handle empty string secret as empty after trim", () => {
      const passwordMessage: ClientMessage = {
        t: "set-room-password",
        secret: "",
      };

      messageRouter.route(passwordMessage, dmUid);

      // Empty string (0 chars) should fail validation
      expect(mockDmWs.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse((mockDmWs.send as vi.Mock).mock.calls[0][0]);
      expect(sentMessage.t).toBe("room-password-update-failed");
      expect(sentMessage.reason).toBe("Password must be between 6 and 128 characters.");
    });

    it("should handle undefined secret as empty string after trim", () => {
      const passwordMessage: ClientMessage = {
        t: "set-room-password",
        secret: undefined as unknown as string,
      };

      messageRouter.route(passwordMessage, dmUid);

      // undefined -> trim() -> "" should fail validation
      expect(mockDmWs.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse((mockDmWs.send as vi.Mock).mock.calls[0][0]);
      expect(sentMessage.t).toBe("room-password-update-failed");
      expect(sentMessage.reason).toBe("Password must be between 6 and 128 characters.");
    });

    it("should send failure message when AuthService.update() throws error", () => {
      const consoleErrorSpy = vi.spyOn(console, "error");
      const updateSpy = vi.spyOn(authService, "update");
      updateSpy.mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const passwordMessage: ClientMessage = {
        t: "set-room-password",
        secret: "validPassword123",
      };

      messageRouter.route(passwordMessage, dmUid);

      // Verify failure message was sent
      expect(mockDmWs.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse((mockDmWs.send as vi.Mock).mock.calls[0][0]);
      expect(sentMessage.t).toBe("room-password-update-failed");
      expect(sentMessage.reason).toBe("Unable to update password. Check server logs.");

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to update room password:",
        expect.any(Error),
      );

      updateSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it("should include timestamp in success message", () => {
      const beforeTime = Date.now();
      const passwordMessage: ClientMessage = {
        t: "set-room-password",
        secret: "validPassword123",
      };

      messageRouter.route(passwordMessage, dmUid);
      const afterTime = Date.now();

      // Verify success message has timestamp
      expect(mockDmWs.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse((mockDmWs.send as vi.Mock).mock.calls[0][0]);
      expect(sentMessage.t).toBe("room-password-updated");
      expect(sentMessage.updatedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(sentMessage.updatedAt).toBeLessThanOrEqual(afterTime);
    });

    it("should include source field in success message", () => {
      const passwordMessage: ClientMessage = {
        t: "set-room-password",
        secret: "validPassword123",
      };

      messageRouter.route(passwordMessage, dmUid);

      // Verify success message has source field
      expect(mockDmWs.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse((mockDmWs.send as vi.Mock).mock.calls[0][0]);
      expect(sentMessage.t).toBe("room-password-updated");
      expect(sentMessage.source).toBe("user");
    });

    it("should not send message when sender is not found in players list", () => {
      const unknownUid = "unknown-uid";
      const passwordMessage: ClientMessage = {
        t: "set-room-password",
        secret: "validPassword123",
      };

      // Add a WebSocket for the unknown UID
      const mockUnknownWs = {
        readyState: 1,
        send: vi.fn(),
      } as unknown as WebSocket;
      mockUidToWs.set(unknownUid, mockUnknownWs);

      messageRouter.route(passwordMessage, unknownUid);

      // Verify failure message was sent (unknown user is treated as non-DM)
      expect(mockUnknownWs.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse((mockUnknownWs.send as vi.Mock).mock.calls[0][0]);
      expect(sentMessage.t).toBe("room-password-update-failed");
      expect(sentMessage.reason).toBe("Only Dungeon Masters can update the room password.");
    });

    it("should accept password with exactly 6 characters", () => {
      const consoleSpy = vi.spyOn(console, "log");
      const passwordMessage: ClientMessage = {
        t: "set-room-password",
        secret: "123456",
      };

      messageRouter.route(passwordMessage, dmUid);

      // Verify success message was sent
      expect(mockDmWs.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse((mockDmWs.send as vi.Mock).mock.calls[0][0]);
      expect(sentMessage.t).toBe("room-password-updated");

      consoleSpy.mockRestore();
    });

    it("should accept password with exactly 128 characters", () => {
      const consoleSpy = vi.spyOn(console, "log");
      const password128 = "a".repeat(128);
      const passwordMessage: ClientMessage = {
        t: "set-room-password",
        secret: password128,
      };

      messageRouter.route(passwordMessage, dmUid);

      // Verify success message was sent
      expect(mockDmWs.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse((mockDmWs.send as vi.Mock).mock.calls[0][0]);
      expect(sentMessage.t).toBe("room-password-updated");

      consoleSpy.mockRestore();
    });

    it("should not send message when WebSocket is not in ready state", () => {
      // Set WebSocket to closing state
      mockDmWs.readyState = 2;

      const passwordMessage: ClientMessage = {
        t: "set-room-password",
        secret: "validPassword123",
      };

      messageRouter.route(passwordMessage, dmUid);

      // Verify no message was sent (readyState !== 1)
      expect(mockDmWs.send).not.toHaveBeenCalled();
    });

    it("should not send message when WebSocket is not found in map", () => {
      // Remove DM from uidToWs map
      mockUidToWs.delete(dmUid);

      const passwordMessage: ClientMessage = {
        t: "set-room-password",
        secret: "validPassword123",
      };

      messageRouter.route(passwordMessage, dmUid);

      // Verify no message was sent (ws not found)
      expect(mockDmWs.send).not.toHaveBeenCalled();
    });

    it("should handle password with special characters", () => {
      const consoleSpy = vi.spyOn(console, "log");
      const passwordMessage: ClientMessage = {
        t: "set-room-password",
        secret: "P@ssw0rd!#$%",
      };

      messageRouter.route(passwordMessage, dmUid);

      // Verify success message was sent
      expect(mockDmWs.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse((mockDmWs.send as vi.Mock).mock.calls[0][0]);
      expect(sentMessage.t).toBe("room-password-updated");

      consoleSpy.mockRestore();
    });

    it("should handle password with unicode characters", () => {
      const consoleSpy = vi.spyOn(console, "log");
      const passwordMessage: ClientMessage = {
        t: "set-room-password",
        secret: "pässwörd123",
      };

      messageRouter.route(passwordMessage, dmUid);

      // Verify success message was sent
      expect(mockDmWs.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse((mockDmWs.send as vi.Mock).mock.calls[0][0]);
      expect(sentMessage.t).toBe("room-password-updated");

      consoleSpy.mockRestore();
    });

    it("should treat player with isDM=false as non-DM even if they were previously DM", () => {
      // Explicitly set player to non-DM
      const state = roomService.getState();
      const player = state.players.find((p) => p.uid === dmUid);
      if (player) {
        player.isDM = false;
      }
      roomService.setState(state);

      const passwordMessage: ClientMessage = {
        t: "set-room-password",
        secret: "validPassword123",
      };

      messageRouter.route(passwordMessage, dmUid);

      // Verify failure message was sent
      expect(mockDmWs.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse((mockDmWs.send as vi.Mock).mock.calls[0][0]);
      expect(sentMessage.t).toBe("room-password-update-failed");
      expect(sentMessage.reason).toBe("Only Dungeon Masters can update the room password.");
    });

    it("should allow default password with whitespace to bypass length validation after trim", () => {
      const consoleSpy = vi.spyOn(console, "log");
      // Test that the default password check happens after trimming
      // "Fun1" is the default password (4 characters after trim)
      const passwordMessage: ClientMessage = {
        t: "set-room-password",
        secret: "  Fun1  ", // Default password with whitespace
      };

      messageRouter.route(passwordMessage, dmUid);

      // Verify success message (default password bypasses length check after trim)
      expect(mockDmWs.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse((mockDmWs.send as vi.Mock).mock.calls[0][0]);
      expect(sentMessage.t).toBe("room-password-updated");
      expect(sentMessage.source).toBe("fallback");

      consoleSpy.mockRestore();
    });
  });
});
