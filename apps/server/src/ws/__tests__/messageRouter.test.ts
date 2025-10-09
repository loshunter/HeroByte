import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageRouter } from "../messageRouter.js";
import { RoomService } from "../../domains/room/service.js";
import { PlayerService } from "../../domains/player/service.js";
import { TokenService } from "../../domains/token/service.js";
import { MapService } from "../../domains/map/service.js";
import { DiceService } from "../../domains/dice/service.js";
import { CharacterService } from "../../domains/character/service.js";
import type { WebSocket, WebSocketServer } from "ws";
import type { ClientMessage, RoomState } from "@shared";

describe("MessageRouter", () => {
  let router: MessageRouter;
  let mockRoomService: RoomService;
  let mockPlayerService: PlayerService;
  let mockTokenService: TokenService;
  let mockMapService: MapService;
  let mockDiceService: DiceService;
  let mockCharacterService: CharacterService;
  let mockWss: WebSocketServer;
  let mockUidToWs: Map<string, WebSocket>;
  let mockGetAuthorizedClients: () => Set<WebSocket>;
  let mockState: RoomState;

  beforeEach(() => {
    // Create mock state
    mockState = {
      id: "test-room",
      name: "Test Room",
      players: [{ uid: "player-1", name: "Alice", portrait: null, isDM: false, hp: 10, maxHp: 10, micLevel: 0, lastHeartbeat: Date.now() }],
      tokens: [],
      characters: [],
      map: { background: null, gridSize: 50, pointers: {}, drawings: [] },
      diceRolls: [],
      sceneObjects: [],
    };

    // Mock services
    mockRoomService = {
      getState: vi.fn(() => mockState),
      broadcast: vi.fn(),
      saveState: vi.fn(),
      loadSnapshot: vi.fn(),
      applySceneObjectTransform: vi.fn(() => true),
    } as unknown as RoomService;

    mockPlayerService = {
      setPortrait: vi.fn(() => true),
      rename: vi.fn(() => true),
      setMicLevel: vi.fn(() => true),
      setHP: vi.fn(() => true),
      setDMMode: vi.fn(() => true),
    } as unknown as PlayerService;

    mockTokenService = {
      moveToken: vi.fn(() => true),
      recolorToken: vi.fn(() => true),
      deleteToken: vi.fn(() => true),
      setImageUrl: vi.fn(() => true),
      clearAllTokensExcept: vi.fn(),
      forceDeleteToken: vi.fn(),
    } as unknown as TokenService;

    mockMapService = {
      setBackground: vi.fn(),
      setGridSize: vi.fn(),
      placePointer: vi.fn(),
      addDrawing: vi.fn(),
      undoDrawing: vi.fn(() => true),
      redoDrawing: vi.fn(() => true),
      clearDrawings: vi.fn(),
      selectDrawing: vi.fn(() => true),
      deselectDrawing: vi.fn(),
      moveDrawing: vi.fn(() => true),
      deleteDrawing: vi.fn(() => true),
    } as unknown as MapService;

    mockDiceService = {
      addRoll: vi.fn(),
      clearHistory: vi.fn(),
    } as unknown as DiceService;

    mockCharacterService = {
      createCharacter: vi.fn(),
      updateNPC: vi.fn(() => true),
      deleteCharacter: vi.fn(() => ({ id: "char-1", name: "NPC", tokenId: "token-1" })),
      placeNPCToken: vi.fn(() => true),
      claimCharacter: vi.fn(() => true),
      updateHP: vi.fn(() => true),
      linkToken: vi.fn(() => true),
    } as unknown as CharacterService;

    mockWss = {} as WebSocketServer;
    mockUidToWs = new Map();
    mockGetAuthorizedClients = vi.fn(() => new Set());

    router = new MessageRouter(
      mockRoomService,
      mockPlayerService,
      mockTokenService,
      mockMapService,
      mockDiceService,
      mockCharacterService,
      mockWss,
      mockUidToWs,
      mockGetAuthorizedClients,
    );
  });

  describe("Token Actions", () => {
    it("routes move message to tokenService", () => {
      const msg: ClientMessage = { t: "move", id: "token-1", x: 10, y: 20 };
      router.route(msg, "player-1");

      expect(mockTokenService.moveToken).toHaveBeenCalledWith(mockState, "token-1", "player-1", 10, 20);
      expect(mockRoomService.broadcast).toHaveBeenCalled();
    });

    it("routes recolor message to tokenService", () => {
      const msg: ClientMessage = { t: "recolor", id: "token-1" };
      router.route(msg, "player-1");

      expect(mockTokenService.recolorToken).toHaveBeenCalledWith(mockState, "token-1", "player-1");
      expect(mockRoomService.broadcast).toHaveBeenCalled();
    });

    it("routes delete-token message and broadcasts", () => {
      const msg: ClientMessage = { t: "delete-token", id: "token-1" };
      router.route(msg, "player-1");

      expect(mockTokenService.deleteToken).toHaveBeenCalledWith(mockState, "token-1", "player-1");
      expect(mockRoomService.broadcast).toHaveBeenCalled();
    });

    it("routes update-token-image and saves state", () => {
      const msg: ClientMessage = { t: "update-token-image", tokenId: "token-1", imageUrl: "http://example.com/img.png" };
      router.route(msg, "player-1");

      expect(mockTokenService.setImageUrl).toHaveBeenCalledWith(mockState, "token-1", "player-1", "http://example.com/img.png");
      expect(mockRoomService.broadcast).toHaveBeenCalled();
      expect(mockRoomService.saveState).toHaveBeenCalled();
    });
  });

  describe("Player Actions", () => {
    it("routes portrait message and saves state", () => {
      const msg: ClientMessage = { t: "portrait", data: "base64data" };
      router.route(msg, "player-1");

      expect(mockPlayerService.setPortrait).toHaveBeenCalledWith(mockState, "player-1", "base64data");
      expect(mockRoomService.broadcast).toHaveBeenCalled();
      expect(mockRoomService.saveState).toHaveBeenCalled();
    });

    it("routes rename message and saves state", () => {
      const msg: ClientMessage = { t: "rename", name: "Bob" };
      router.route(msg, "player-1");

      expect(mockPlayerService.rename).toHaveBeenCalledWith(mockState, "player-1", "Bob");
      expect(mockRoomService.broadcast).toHaveBeenCalled();
      expect(mockRoomService.saveState).toHaveBeenCalled();
    });

    it("routes mic-level message", () => {
      const msg: ClientMessage = { t: "mic-level", level: 5 };
      router.route(msg, "player-1");

      expect(mockPlayerService.setMicLevel).toHaveBeenCalledWith(mockState, "player-1", 5);
      expect(mockRoomService.broadcast).toHaveBeenCalled();
    });

    it("routes set-hp message and saves state", () => {
      const msg: ClientMessage = { t: "set-hp", hp: 15, maxHp: 20 };
      router.route(msg, "player-1");

      expect(mockPlayerService.setHP).toHaveBeenCalledWith(mockState, "player-1", 15, 20);
      expect(mockRoomService.broadcast).toHaveBeenCalled();
      expect(mockRoomService.saveState).toHaveBeenCalled();
    });

    it("routes toggle-dm message and saves state", () => {
      const msg: ClientMessage = { t: "toggle-dm", isDM: true };
      router.route(msg, "player-1");

      expect(mockPlayerService.setDMMode).toHaveBeenCalledWith(mockState, "player-1", true);
      expect(mockRoomService.broadcast).toHaveBeenCalled();
      expect(mockRoomService.saveState).toHaveBeenCalled();
    });
  });

  describe("Character Actions", () => {
    it("routes create-character message", () => {
      const msg: ClientMessage = { t: "create-character", name: "Hero", maxHp: 100, portrait: "portrait-data" };
      router.route(msg, "player-1");

      expect(mockCharacterService.createCharacter).toHaveBeenCalledWith(mockState, "Hero", 100, "portrait-data");
      expect(mockRoomService.broadcast).toHaveBeenCalled();
      expect(mockRoomService.saveState).toHaveBeenCalled();
    });

    it("routes create-npc message with npc type", () => {
      const msg: ClientMessage = { t: "create-npc", name: "Goblin", hp: 20, maxHp: 20, portrait: "goblin-portrait", tokenImage: "goblin-token" };
      router.route(msg, "player-1");

      expect(mockCharacterService.createCharacter).toHaveBeenCalledWith(
        mockState,
        "Goblin",
        20,
        "goblin-portrait",
        "npc",
        { hp: 20, tokenImage: "goblin-token" },
      );
      expect(mockRoomService.broadcast).toHaveBeenCalled();
      expect(mockRoomService.saveState).toHaveBeenCalled();
    });

    it("routes update-npc message", () => {
      const msg: ClientMessage = { t: "update-npc", id: "npc-1", name: "Updated Goblin", hp: 15, maxHp: 25, portrait: "new-portrait", tokenImage: "new-token" };
      router.route(msg, "player-1");

      expect(mockCharacterService.updateNPC).toHaveBeenCalledWith(mockState, mockTokenService, "npc-1", {
        name: "Updated Goblin",
        hp: 15,
        maxHp: 25,
        portrait: "new-portrait",
        tokenImage: "new-token",
      });
      expect(mockRoomService.broadcast).toHaveBeenCalled();
      expect(mockRoomService.saveState).toHaveBeenCalled();
    });

    it("routes delete-npc and removes associated token", () => {
      const msg: ClientMessage = { t: "delete-npc", id: "npc-1" };
      router.route(msg, "player-1");

      expect(mockCharacterService.deleteCharacter).toHaveBeenCalledWith(mockState, "npc-1");
      expect(mockTokenService.forceDeleteToken).toHaveBeenCalledWith(mockState, "token-1");
      expect(mockRoomService.broadcast).toHaveBeenCalled();
      expect(mockRoomService.saveState).toHaveBeenCalled();
    });

    it("routes claim-character message", () => {
      const msg: ClientMessage = { t: "claim-character", characterId: "char-1" };
      router.route(msg, "player-1");

      expect(mockCharacterService.claimCharacter).toHaveBeenCalledWith(mockState, "char-1", "player-1");
      expect(mockRoomService.broadcast).toHaveBeenCalled();
      expect(mockRoomService.saveState).toHaveBeenCalled();
    });

    it("routes update-character-hp message", () => {
      const msg: ClientMessage = { t: "update-character-hp", characterId: "char-1", hp: 50, maxHp: 100 };
      router.route(msg, "player-1");

      expect(mockCharacterService.updateHP).toHaveBeenCalledWith(mockState, "char-1", 50, 100);
      expect(mockRoomService.broadcast).toHaveBeenCalled();
      expect(mockRoomService.saveState).toHaveBeenCalled();
    });

    it("routes link-token message", () => {
      const msg: ClientMessage = { t: "link-token", characterId: "char-1", tokenId: "token-1" };
      router.route(msg, "player-1");

      expect(mockCharacterService.linkToken).toHaveBeenCalledWith(mockState, "char-1", "token-1");
      expect(mockRoomService.broadcast).toHaveBeenCalled();
      expect(mockRoomService.saveState).toHaveBeenCalled();
    });
  });

  describe("Map Actions", () => {
    it("routes map-background message", () => {
      const msg: ClientMessage = { t: "map-background", data: "background-data" };
      router.route(msg, "player-1");

      expect(mockMapService.setBackground).toHaveBeenCalledWith(mockState, "background-data");
      expect(mockRoomService.broadcast).toHaveBeenCalled();
    });

    it("routes grid-size message", () => {
      const msg: ClientMessage = { t: "grid-size", size: 100 };
      router.route(msg, "player-1");

      expect(mockMapService.setGridSize).toHaveBeenCalledWith(mockState, 100);
      expect(mockRoomService.broadcast).toHaveBeenCalled();
    });

    it("routes point message", () => {
      const msg: ClientMessage = { t: "point", x: 50, y: 75 };
      router.route(msg, "player-1");

      expect(mockMapService.placePointer).toHaveBeenCalledWith(mockState, "player-1", 50, 75);
      expect(mockRoomService.broadcast).toHaveBeenCalled();
    });

    it("routes draw message", () => {
      const drawing = { id: "draw-1", points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], color: "red", width: 2 };
      const msg: ClientMessage = { t: "draw", drawing };
      router.route(msg, "player-1");

      expect(mockMapService.addDrawing).toHaveBeenCalledWith(mockState, drawing, "player-1");
      expect(mockRoomService.broadcast).toHaveBeenCalled();
    });

    it("routes undo-drawing message", () => {
      const msg: ClientMessage = { t: "undo-drawing" };
      router.route(msg, "player-1");

      expect(mockMapService.undoDrawing).toHaveBeenCalledWith(mockState, "player-1");
      expect(mockRoomService.broadcast).toHaveBeenCalled();
    });

    it("routes clear-drawings message", () => {
      const msg: ClientMessage = { t: "clear-drawings" };
      router.route(msg, "player-1");

      expect(mockMapService.clearDrawings).toHaveBeenCalledWith(mockState);
      expect(mockRoomService.broadcast).toHaveBeenCalled();
    });
  });

  describe("Dice Actions", () => {
    it("routes dice-roll message", () => {
      const roll = { id: "roll-1", uid: "player-1", result: 15, expression: "1d20", timestamp: Date.now() };
      const msg: ClientMessage = { t: "dice-roll", roll };
      router.route(msg, "player-1");

      expect(mockDiceService.addRoll).toHaveBeenCalledWith(mockState, roll);
      expect(mockRoomService.broadcast).toHaveBeenCalled();
    });

    it("routes clear-roll-history message", () => {
      const msg: ClientMessage = { t: "clear-roll-history" };
      router.route(msg, "player-1");

      expect(mockDiceService.clearHistory).toHaveBeenCalledWith(mockState);
      expect(mockRoomService.broadcast).toHaveBeenCalled();
    });
  });

  describe("Room Management", () => {
    it("routes clear-all-tokens message", () => {
      const msg: ClientMessage = { t: "clear-all-tokens" };
      router.route(msg, "player-1");

      expect(mockTokenService.clearAllTokensExcept).toHaveBeenCalledWith(mockState, "player-1");
      expect(mockRoomService.broadcast).toHaveBeenCalled();
      expect(mockRoomService.saveState).toHaveBeenCalled();
    });

    it("routes heartbeat message and updates timestamp", () => {
      const msg: ClientMessage = { t: "heartbeat" };
      const beforeTime = Date.now();
      router.route(msg, "player-1");
      const afterTime = Date.now();

      const player = mockState.players.find(p => p.uid === "player-1");
      expect(player?.lastHeartbeat).toBeGreaterThanOrEqual(beforeTime);
      expect(player?.lastHeartbeat).toBeLessThanOrEqual(afterTime);
    });

    it("routes load-session message", () => {
      const snapshot = { ...mockState, name: "Loaded Session" };
      const msg: ClientMessage = { t: "load-session", snapshot };
      router.route(msg, "player-1");

      expect(mockRoomService.loadSnapshot).toHaveBeenCalledWith(snapshot);
      expect(mockRoomService.broadcast).toHaveBeenCalled();
      expect(mockRoomService.saveState).toHaveBeenCalled();
    });

    it("routes transform-object message", () => {
      const msg: ClientMessage = {
        t: "transform-object",
        id: "obj-1",
        position: { x: 10, y: 20 },
        scale: { x: 1.5, y: 1.5 },
        rotation: 45,
      };
      router.route(msg, "player-1");

      expect(mockRoomService.applySceneObjectTransform).toHaveBeenCalledWith("obj-1", "player-1", {
        position: { x: 10, y: 20 },
        scale: { x: 1.5, y: 1.5 },
        rotation: 45,
      });
      expect(mockRoomService.broadcast).toHaveBeenCalled();
      expect(mockRoomService.saveState).toHaveBeenCalled();
    });
  });

  describe("WebRTC Signaling", () => {
    it("routes rtc-signal to target peer", () => {
      const mockTargetWs = {
        readyState: 1,
        send: vi.fn(),
      } as unknown as WebSocket;

      mockUidToWs.set("player-2", mockTargetWs);

      const signal = { type: "offer", sdp: "test-sdp" };
      const msg: ClientMessage = { t: "rtc-signal", target: "player-2", signal };
      router.route(msg, "player-1");

      expect(mockTargetWs.send).toHaveBeenCalledWith(
        JSON.stringify({ t: "rtc-signal", from: "player-1", signal }),
      );
    });

    it("does not send rtc-signal if target not connected", () => {
      const signal = { type: "offer", sdp: "test-sdp" };
      const msg: ClientMessage = { t: "rtc-signal", target: "nonexistent", signal };

      expect(() => router.route(msg, "player-1")).not.toThrow();
    });
  });

  describe("Error Handling", () => {
    it("catches and logs errors from service calls", () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockTokenService.moveToken = vi.fn(() => {
        throw new Error("Service error");
      });

      const msg: ClientMessage = { t: "move", id: "token-1", x: 10, y: 20 };
      expect(() => router.route(msg, "player-1")).not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error routing message:", expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    it("logs warning for unknown message types", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const msg = { t: "unknown-type" } as unknown as ClientMessage;
      router.route(msg, "player-1");

      expect(consoleWarnSpy).toHaveBeenCalledWith("Unknown message type:", "unknown-type");
      consoleWarnSpy.mockRestore();
    });
  });
});
