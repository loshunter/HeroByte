/**
 * Characterization tests for PropMessageHandler
 *
 * These tests capture the behavior of the original code BEFORE extraction.
 * They serve as regression tests during and after refactoring.
 *
 * Source: apps/server/src/ws/messageRouter.ts
 * - create-prop (lines 415-432)
 * - update-prop (lines 434-450)
 * - delete-prop (lines 452-465)
 *
 * Target: apps/server/src/ws/handlers/PropMessageHandler.ts
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

describe("PropMessageHandler - Characterization Tests", () => {
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
      props: [],
      gridSize: 50,
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

  describe("create-prop message", () => {
    it("should create prop when DM creates it", () => {
      const createMessage: ClientMessage = {
        t: "create-prop",
        label: "Treasure Chest",
        imageUrl: "chest.png",
        owner: dmUid,
        size: "medium",
        viewport: { x: 100, y: 100, zoom: 1 },
      };

      messageRouter.route(createMessage, dmUid);

      const state = roomService.getState();
      expect(state.props).toHaveLength(1);
      expect(state.props[0].label).toBe("Treasure Chest");
      expect(state.props[0].imageUrl).toBe("chest.png");
      expect(state.props[0].owner).toBe(dmUid);
      expect(state.props[0].size).toBe("medium");
    });

    it("should not create prop when non-DM tries", () => {
      const createMessage: ClientMessage = {
        t: "create-prop",
        label: "Hacked Prop",
        imageUrl: "hack.png",
        owner: playerUid,
        size: "small",
        viewport: { x: 0, y: 0, zoom: 1 },
      };

      messageRouter.route(createMessage, playerUid);

      const state = roomService.getState();
      expect(state.props).toHaveLength(0);
    });
  });

  describe("update-prop message", () => {
    let propId: string;

    beforeEach(() => {
      // Create a prop
      const state = roomService.getState();
      const prop = propService.createProp(
        state,
        "Old Prop",
        "old.png",
        dmUid,
        "small",
        { x: 0, y: 0, zoom: 1 },
        state.gridSize,
      );
      propId = prop.id;
      roomService.createSnapshot();
    });

    it("should update prop when DM updates it", () => {
      const updateMessage: ClientMessage = {
        t: "update-prop",
        id: propId,
        label: "New Prop",
        imageUrl: "new.png",
        owner: playerUid,
        size: "large",
      };

      messageRouter.route(updateMessage, dmUid);

      const state = roomService.getState();
      const prop = state.props.find((p) => p.id === propId);
      expect(prop?.label).toBe("New Prop");
      expect(prop?.imageUrl).toBe("new.png");
      expect(prop?.owner).toBe(playerUid);
      expect(prop?.size).toBe("large");
    });

    it("should not update prop when non-DM tries", () => {
      const updateMessage: ClientMessage = {
        t: "update-prop",
        id: propId,
        label: "Hacked Prop",
        imageUrl: "hack.png",
      };

      messageRouter.route(updateMessage, playerUid);

      const state = roomService.getState();
      const prop = state.props.find((p) => p.id === propId);
      expect(prop?.label).toBe("Old Prop"); // Should not change
      expect(prop?.imageUrl).toBe("old.png");
    });
  });

  describe("delete-prop message", () => {
    let propId: string;

    beforeEach(() => {
      // Create a prop
      const state = roomService.getState();
      const prop = propService.createProp(
        state,
        "Deletable Prop",
        "delete.png",
        dmUid,
        "medium",
        { x: 50, y: 50, zoom: 1 },
        state.gridSize,
      );
      propId = prop.id;
      roomService.createSnapshot();
    });

    it("should delete prop when DM deletes it", () => {
      const deleteMessage: ClientMessage = {
        t: "delete-prop",
        id: propId,
      };

      messageRouter.route(deleteMessage, dmUid);

      const state = roomService.getState();
      expect(state.props.find((p) => p.id === propId)).toBeUndefined();
    });

    it("should remove prop from selection when deleted", () => {
      // Select the prop first
      const propKey = `prop:${propId}`;
      selectionService.selectObject(roomService.getState(), dmUid, propKey);

      const deleteMessage: ClientMessage = {
        t: "delete-prop",
        id: propId,
      };

      messageRouter.route(deleteMessage, dmUid);

      const state = roomService.getState();
      const selectedObject = state.selectedObjects?.[dmUid];
      expect(selectedObject).toBeUndefined();
    });

    it("should not delete prop when non-DM tries", () => {
      const deleteMessage: ClientMessage = {
        t: "delete-prop",
        id: propId,
      };

      messageRouter.route(deleteMessage, playerUid);

      const state = roomService.getState();
      expect(state.props.find((p) => p.id === propId)).toBeDefined();
    });
  });
});
