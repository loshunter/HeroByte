import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";

vi.mock("fs", () => ({
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(false),
}));

import { DisconnectionCleanupManager } from "../DisconnectionCleanupManager.js";
import type { RoomService } from "../../../domains/room/service.js";
import type { SelectionService } from "../../../domains/selection/service.js";
import type { WebSocket } from "ws";
import type { RoomSnapshot } from "@shared";

class FakeWebSocket {
  public readyState = 1;
  public send = vi.fn<(data: string | Buffer) => void>();
  public close = vi.fn<(code?: number, reason?: string) => void>((_code, _reason) => {
    this.readyState = 3;
  });
}

describe("DisconnectionCleanupManager - Characterization Tests", () => {
  let cleanupManager: DisconnectionCleanupManager;
  let mockRoomService: RoomService;
  let mockSelectionService: SelectionService;
  let uidToWs: Map<string, WebSocket>;
  let authenticatedUids: Set<string>;
  let authenticatedSessions: Map<string, { roomId: string; authedAt: number }>;
  let getAuthenticatedClients: () => Set<WebSocket>;
  let roomState: RoomSnapshot;
  let broadcastSpy: MockInstance;
  let deselectSpy: MockInstance;
  let consoleLogSpy: MockInstance;

  beforeEach(() => {
    // Create fresh maps/sets for each test
    uidToWs = new Map();
    authenticatedUids = new Set();
    authenticatedSessions = new Map();

    // Initialize room state with test data
    roomState = {
      gridSize: 50,
      gridSquareSize: 5,
      mapBackground: null,
      users: ["user1", "user2"],
      players: [
        { uid: "user1", name: "Player 1", portrait: null, isDM: false },
        { uid: "user2", name: "Player 2", portrait: null, isDM: false },
      ],
      tokens: [
        {
          id: "token1",
          owner: "user1",
          name: "Token 1",
          x: 100,
          y: 100,
          color: "#ff0000",
          size: 1,
        },
        {
          id: "token2",
          owner: "user2",
          name: "Token 2",
          x: 200,
          y: 200,
          color: "#00ff00",
          size: 1,
        },
      ],
      characters: [],
      drawings: [],
      pointers: [],
      rollHistory: [],
      props: [],
      selectionState: {},
      initiativeOrder: null,
      currentTurn: null,
      combatActive: false,
      playerStagingZone: null,
    };

    // Mock RoomService
    mockRoomService = {
      getState: vi.fn(() => roomState),
      broadcast: vi.fn(),
    } as unknown as RoomService;

    // Mock SelectionService
    mockSelectionService = {
      deselect: vi.fn(),
    } as unknown as SelectionService;

    // Mock getAuthenticatedClients
    const mockClients = new Set<WebSocket>();
    getAuthenticatedClients = vi.fn(() => mockClients);

    // Create spies
    broadcastSpy = vi.spyOn(mockRoomService, "broadcast");
    deselectSpy = vi.spyOn(mockSelectionService, "deselect");
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Create DisconnectionCleanupManager
    cleanupManager = new DisconnectionCleanupManager(
      {
        roomService: mockRoomService,
        selectionService: mockSelectionService,
        getAuthenticatedClients,
      },
      uidToWs,
      authenticatedUids,
      authenticatedSessions,
    );
  });

  describe("Basic cleanup for normal disconnection", () => {
    it("cleans up user from state on normal disconnection", () => {
      // Setup: uid in state.users, authenticatedUids, uidToWs
      const uid = "user1";
      const ws = new FakeWebSocket() as unknown as WebSocket;
      uidToWs.set(uid, ws);
      authenticatedUids.add(uid);
      authenticatedSessions.set(uid, { roomId: "room1", authedAt: Date.now() });

      // Verify initial state
      expect(roomState.users).toContain(uid);
      expect(authenticatedUids.has(uid)).toBe(true);
      expect(authenticatedSessions.has(uid)).toBe(true);
      expect(uidToWs.has(uid)).toBe(true);

      // Execute: cleanupPlayer(uid)
      cleanupManager.cleanupPlayer(uid);

      // Assert: user removed from state.users
      expect(roomState.users).not.toContain(uid);
      expect(roomState.users).toEqual(["user2"]);

      // Assert: authenticatedUids does not contain uid
      expect(authenticatedUids.has(uid)).toBe(false);

      // Assert: authenticatedSessions does not contain uid
      expect(authenticatedSessions.has(uid)).toBe(false);

      // Assert: uidToWs does not contain uid
      expect(uidToWs.has(uid)).toBe(false);
    });

    it("deselects player selections on cleanup", () => {
      // Setup: player has selections (mocked via selectionService)
      const uid = "user1";

      // Execute: cleanupPlayer(uid)
      cleanupManager.cleanupPlayer(uid);

      // Assert: selectionService.deselect called with (state, uid)
      expect(deselectSpy).toHaveBeenCalledOnce();
      expect(deselectSpy).toHaveBeenCalledWith(roomState, uid);
    });

    it("broadcasts updated state after cleanup", () => {
      // Setup: multiple authenticated clients
      const uid = "user1";

      // Execute: cleanupPlayer(uid)
      cleanupManager.cleanupPlayer(uid);

      // Assert: roomService.broadcast called once
      expect(broadcastSpy).toHaveBeenCalledOnce();

      // Assert: broadcast called with getAuthenticatedClients()
      expect(getAuthenticatedClients).toHaveBeenCalledOnce();
    });
  });

  describe("Race condition prevention", () => {
    it("skips cleanup if connection has been replaced (race prevention)", () => {
      // Setup: uidToWs.get(uid) returns different WebSocket than provided
      const uid = "user1";
      const oldWs = new FakeWebSocket() as unknown as WebSocket;
      const currentWs = new FakeWebSocket() as unknown as WebSocket;

      uidToWs.set(uid, currentWs); // Current connection is different
      authenticatedUids.add(uid);

      // Execute: cleanupPlayer(uid, { ws: oldWs })
      cleanupManager.cleanupPlayer(uid, { ws: oldWs });

      // Assert: NO cleanup performed
      expect(roomState.users).toContain(uid); // Still in users
      expect(authenticatedUids.has(uid)).toBe(true); // Still authenticated
      expect(uidToWs.has(uid)).toBe(true); // Still in map

      // Assert: broadcast NOT called
      expect(broadcastSpy).not.toHaveBeenCalled();

      // Assert: console.log shows "Ignoring close event for replaced connection"
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[WebSocket] Ignoring close event for replaced connection: ${uid}`,
      );
    });

    it("performs cleanup if connection is current", () => {
      // Setup: uidToWs.get(uid) returns same WebSocket as provided
      const uid = "user1";
      const currentWs = new FakeWebSocket() as unknown as WebSocket;

      uidToWs.set(uid, currentWs);
      authenticatedUids.add(uid);

      // Execute: cleanupPlayer(uid, { ws: currentWs })
      cleanupManager.cleanupPlayer(uid, { ws: currentWs });

      // Assert: cleanup performed
      expect(roomState.users).not.toContain(uid);
      expect(authenticatedUids.has(uid)).toBe(false);
      expect(uidToWs.has(uid)).toBe(false);

      // Assert: broadcast called
      expect(broadcastSpy).toHaveBeenCalledOnce();
    });
  });

  describe("Timeout cleanup - close WebSocket", () => {
    it("closes WebSocket when closeWebSocket option is true", () => {
      // Setup: WebSocket is open (readyState = 1)
      const uid = "user1";
      const ws = new FakeWebSocket() as unknown as WebSocket;
      uidToWs.set(uid, ws);

      expect(ws.readyState).toBe(1); // Open

      // Execute: cleanupPlayer(uid, { closeWebSocket: true })
      cleanupManager.cleanupPlayer(uid, { closeWebSocket: true });

      // Assert: socket.close(4000, "Heartbeat timeout") called
      expect(ws.close).toHaveBeenCalledOnce();
      expect(ws.close).toHaveBeenCalledWith(4000, "Heartbeat timeout");
    });

    it("skips WebSocket close if socket already closed", () => {
      // Setup: WebSocket is closed (readyState = 3)
      const uid = "user1";
      const ws = new FakeWebSocket() as unknown as WebSocket;
      ws.readyState = 3; // Closed
      uidToWs.set(uid, ws);

      // Execute: cleanupPlayer(uid, { closeWebSocket: true })
      cleanupManager.cleanupPlayer(uid, { closeWebSocket: true });

      // Assert: socket.close NOT called
      expect(ws.close).not.toHaveBeenCalled();
    });
  });

  describe("Timeout cleanup - remove player entity and tokens", () => {
    it("removes player entity when removePlayer option is true", () => {
      // Setup: player exists in state.players
      const uid = "user1";
      expect(roomState.players).toHaveLength(2);
      expect(roomState.players.some((p) => p.uid === uid)).toBe(true);

      // Execute: cleanupPlayer(uid, { removePlayer: true })
      cleanupManager.cleanupPlayer(uid, { removePlayer: true });

      // Assert: player removed from state.players
      expect(roomState.players).toHaveLength(1);
      expect(roomState.players.some((p) => p.uid === uid)).toBe(false);
      expect(roomState.players[0].uid).toBe("user2");
    });

    it("removes player tokens when removeTokens option is true", () => {
      // Setup: tokens with owner=uid exist in state.tokens
      const uid = "user1";
      expect(roomState.tokens).toHaveLength(2);
      expect(roomState.tokens.some((t) => t.owner === uid)).toBe(true);

      // Execute: cleanupPlayer(uid, { removeTokens: true })
      cleanupManager.cleanupPlayer(uid, { removeTokens: true });

      // Assert: tokens removed from state.tokens
      expect(roomState.tokens).toHaveLength(1);
      expect(roomState.tokens.some((t) => t.owner === uid)).toBe(false);
      expect(roomState.tokens[0].owner).toBe("user2");
    });

    it("removes both player and tokens when both options are true", () => {
      // Setup: player and tokens exist
      const uid = "user1";

      // Execute: cleanupPlayer with both options
      cleanupManager.cleanupPlayer(uid, {
        removePlayer: true,
        removeTokens: true,
      });

      // Assert: both removed
      expect(roomState.players.some((p) => p.uid === uid)).toBe(false);
      expect(roomState.tokens.some((t) => t.owner === uid)).toBe(false);
    });
  });

  describe("Normal disconnect does NOT remove player/tokens", () => {
    it("does not remove player/tokens on normal disconnect", () => {
      // Setup: player and tokens exist
      const uid = "user1";
      expect(roomState.players.some((p) => p.uid === uid)).toBe(true);
      expect(roomState.tokens.some((t) => t.owner === uid)).toBe(true);

      // Execute: cleanupPlayer(uid) - no options
      cleanupManager.cleanupPlayer(uid);

      // Assert: player still in state.players
      expect(roomState.players.some((p) => p.uid === uid)).toBe(true);

      // Assert: tokens still in state.tokens
      expect(roomState.tokens.some((t) => t.owner === uid)).toBe(true);

      // Assert: but user removed from state.users
      expect(roomState.users).not.toContain(uid);
    });
  });

  describe("Complete timeout scenario", () => {
    it("performs complete timeout cleanup with all options", () => {
      // Setup: full player state
      const uid = "user1";
      const ws = new FakeWebSocket() as unknown as WebSocket;
      uidToWs.set(uid, ws);
      authenticatedUids.add(uid);
      authenticatedSessions.set(uid, { roomId: "room1", authedAt: Date.now() });

      // Verify initial state
      expect(ws.readyState).toBe(1);
      expect(roomState.users).toContain(uid);
      expect(roomState.players.some((p) => p.uid === uid)).toBe(true);
      expect(roomState.tokens.some((t) => t.owner === uid)).toBe(true);

      // Execute: complete timeout cleanup
      cleanupManager.cleanupPlayer(uid, {
        closeWebSocket: true,
        removePlayer: true,
        removeTokens: true,
      });

      // Assert: WebSocket closed
      expect(ws.close).toHaveBeenCalledWith(4000, "Heartbeat timeout");

      // Assert: player removed
      expect(roomState.players.some((p) => p.uid === uid)).toBe(false);

      // Assert: tokens removed
      expect(roomState.tokens.some((t) => t.owner === uid)).toBe(false);

      // Assert: user removed
      expect(roomState.users).not.toContain(uid);

      // Assert: auth state cleared
      expect(authenticatedUids.has(uid)).toBe(false);
      expect(authenticatedSessions.has(uid)).toBe(false);
      expect(uidToWs.has(uid)).toBe(false);

      // Assert: deselect called
      expect(deselectSpy).toHaveBeenCalledWith(roomState, uid);

      // Assert: broadcast called
      expect(broadcastSpy).toHaveBeenCalledOnce();
    });
  });
});
