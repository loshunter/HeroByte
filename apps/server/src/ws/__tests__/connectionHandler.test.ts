import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";

vi.mock("fs", () => ({
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(false),
  renameSync: vi.fn(),
}));

import type { Container } from "../../container.js";
import { ConnectionHandler } from "../connectionHandler.js";
import { RoomService } from "../../domains/room/service.js";
import { PlayerService } from "../../domains/player/service.js";
import { TokenService } from "../../domains/token/service.js";
import { MapService } from "../../domains/map/service.js";
import { DiceService } from "../../domains/dice/service.js";
import { CharacterService } from "../../domains/character/service.js";
import { PropService } from "../../domains/prop/service.js";
import { SelectionService } from "../../domains/selection/service.js";
import { MessageRouter } from "../messageRouter.js";
import { RateLimiter } from "../../middleware/rateLimit.js";
import { TokenBucketLimiter } from "../../middleware/authWorkLimit.js";
import type { ClientMessage } from "@herobyte/shared";
import type { WebSocket, WebSocketServer } from "ws";
import { AuthService } from "../../domains/auth/service.js";

type WebSocketEvent = "message" | "close";

class FakeWebSocket {
  public readyState = 1;
  public send = vi.fn<(data: string | Buffer) => void>();
  public ping = vi.fn();
  public close = vi.fn<(code?: number, reason?: string) => void>((_code, _reason) => {
    this.readyState = 3;
    this.emit("close");
  });
  private handlers: Partial<Record<WebSocketEvent, (data?: unknown) => void>> = {};

  on(event: WebSocketEvent, handler: (data?: unknown) => void) {
    this.handlers[event] = handler;
  }

  emit(event: WebSocketEvent, data?: unknown) {
    this.handlers[event]?.(data);
  }
}

class FakeWebSocketServer {
  public clients = new Set<FakeWebSocket>();
  private handlers: Partial<
    Record<"connection", (ws: FakeWebSocket, req: { url: string }) => void>
  > = {};

  on(event: "connection", handler: (ws: FakeWebSocket, req: { url: string }) => void) {
    this.handlers[event] = handler;
  }

  emitConnection(ws: FakeWebSocket, req: { url: string }) {
    this.clients.add(ws);
    this.handlers["connection"]?.(ws, req);
  }
}

const setupContainer = () => {
  const roomService = new RoomService();
  const playerService = new PlayerService();
  const tokenService = new TokenService();
  const mapService = new MapService();
  const diceService = new DiceService();
  const characterService = new CharacterService();
  const propService = new PropService();
  const selectionService = new SelectionService();
  const authService = new AuthService({ storagePath: "./test-room-secret.json" });
  // authenticate() awaits an async scrypt (S1); the real threadpool hash can
  // never complete while this suite holds fake timers, so pin verify to a
  // deterministic async double. Password-correctness itself is covered by
  // authService.test.ts with real crypto.
  vi.spyOn(authService, "verify").mockImplementation(async (secret: string) => secret === "Fun1");
  const fakeNodeServer = { clients: new Set<WebSocket>() } as unknown as WebSocketServer;
  const messageRouter = new MessageRouter(
    roomService,
    playerService,
    tokenService,
    mapService,
    diceService,
    characterService,
    propService,
    selectionService,
    authService,
    fakeNodeServer,
    new Map<string, WebSocket>(),
    () => new Set<WebSocket>(),
  );

  const rateLimiter = new RateLimiter({ maxMessages: 100, windowMs: 1000 });
  vi.spyOn(rateLimiter, "check").mockReturnValue(true);

  // Tight per-IP auth budget so the throttle test can exhaust it in a few
  // messages. Successful auths refund their token, so the ordinary tests
  // (which authenticate with the right password) never feel it.
  const authWorkLimiter = new TokenBucketLimiter({ capacity: 5, refillPerSecond: 0.001 });

  const uidToWs = new Map<string, WebSocket>();
  const authenticatedUids = new Set<string>();
  const authenticatedSessions = new Map<string, { roomId: string; authedAt: number }>();

  const getAuthenticatedClients = () => {
    const clients = new Set<WebSocket>();
    for (const uid of authenticatedUids) {
      const ws = uidToWs.get(uid);
      if (ws && ws.readyState === 1) {
        clients.add(ws);
      }
    }
    return clients;
  };

  const container: Partial<Container> = {
    roomService,
    playerService,
    tokenService,
    mapService,
    diceService,
    characterService,
    selectionService,
    authService,
    messageRouter,
    rateLimiter,
    authWorkLimiter,
    uidToWs,
    authenticatedUids,
    authenticatedSessions,
    getAuthenticatedClients,
    // Room-aware surface: this harness is single-room, so every resolver
    // points at the one RoomService/router above.
    roomIdForUid: (uid: string) => authenticatedSessions.get(uid)?.roomId ?? "default",
    touchRoomActivity: () => {},
    getRoomServiceForRoom: () => roomService,
    getRouterForRoom: () => messageRouter,
    routerForUid: () => messageRouter,
    getAuthenticatedClientsForRoom: () => getAuthenticatedClients(),
    roomRegistry: {
      listRooms: () => ["default"],
      get: () => roomService,
    } as unknown as Container["roomRegistry"],
  };

  return container as Container;
};

describe("ConnectionHandler", () => {
  let wss: FakeWebSocketServer;
  let container: Container;
  let handler: ConnectionHandler;
  let deselectSpy: MockInstance;
  let broadcastSpy: MockInstance;

  /**
   * Drain the microtask queue so a fire-and-forget authenticate() (async
   * since S1) runs to completion before assertions. Timer-free, so it works
   * under the fake timers this suite runs with.
   */
  const flushAuth = async () => {
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    wss = new FakeWebSocketServer();
    container = setupContainer();
    broadcastSpy = vi.spyOn(container.roomService, "broadcast").mockImplementation(() => {});
    deselectSpy = vi.spyOn(container.selectionService, "deselect");
    handler = new ConnectionHandler(container, wss as unknown as WebSocketServer);
    handler.attach();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("registers new connections and spawns player/token state", async () => {
    const socket = new FakeWebSocket();
    wss.emitConnection(socket, { url: "/?uid=user-1" });

    // Authenticate the connection
    const authMessage: ClientMessage = { t: "authenticate", secret: "Fun1" };
    socket.emit("message", Buffer.from(JSON.stringify(authMessage)));
    await flushAuth();

    const state = container.roomService.getState();
    expect(state.users).toContain("user-1");
    expect(state.players).toHaveLength(1);
    expect(state.tokens).toHaveLength(1);
    expect(container.uidToWs.get("user-1")).toBe(socket);
    expect(container.roomService.broadcast).toHaveBeenCalled();

    vi.advanceTimersByTime(25_000);
    expect(socket.ping).toHaveBeenCalled();
  });

  it("updates heartbeat and respects rate limits", async () => {
    const socket = new FakeWebSocket();
    wss.emitConnection(socket, { url: "/?uid=user-2" });

    // Authenticate the connection
    const authMessage: ClientMessage = { t: "authenticate", secret: "Fun1" };
    socket.emit("message", Buffer.from(JSON.stringify(authMessage)));
    await flushAuth();

    const state = container.roomService.getState();
    const player = state.players[0]!;

    const message: ClientMessage = { t: "heartbeat" };
    socket.emit("message", Buffer.from(JSON.stringify(message)));
    expect(player.lastHeartbeat).toBeGreaterThan(0);

    const checkSpy = vi.spyOn(container.rateLimiter, "check").mockReturnValue(false);
    const routeSpy = vi.spyOn(container.messageRouter, "route");
    socket.emit(
      "message",
      Buffer.from(
        JSON.stringify({
          t: "draw",
          drawing: { id: "d", type: "freehand", points: [], color: "#fff", width: 1, opacity: 1 },
        }),
      ),
    );
    expect(routeSpy).not.toHaveBeenCalled();
    expect(checkSpy).toHaveBeenCalled();
  });

  it("refreshes lastHeartbeat immediately on re-authentication", async () => {
    const socket = new FakeWebSocket();
    wss.emitConnection(socket, { url: "/?uid=user-reconnect" });

    const authMessage: ClientMessage = { t: "authenticate", secret: "Fun1" };
    socket.emit("message", Buffer.from(JSON.stringify(authMessage)));
    await flushAuth();

    const state = container.roomService.getState();
    const player = state.players.find((p) => p.uid === "user-reconnect");
    expect(player).toBeDefined();
    if (!player) {
      throw new Error("Expected player to exist after authentication");
    }

    player.lastHeartbeat = Date.now() - 10 * 60 * 1000;

    vi.setSystemTime(new Date("2024-01-01T00:10:00.000Z"));
    const expectedHeartbeat = Date.now();

    socket.emit("message", Buffer.from(JSON.stringify(authMessage)));

    expect(player.lastHeartbeat).toBe(expectedHeartbeat);
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ t: "auth-ok" }));
  });

  it("retains existing session room and updates authedAt on re-authentication", async () => {
    const socket = new FakeWebSocket();
    wss.emitConnection(socket, { url: "/?uid=session-user" });

    const authMessage: ClientMessage = { t: "authenticate", secret: "Fun1" };
    socket.emit("message", Buffer.from(JSON.stringify(authMessage)));
    await flushAuth();

    const existingSession = container.authenticatedSessions.get("session-user");
    expect(existingSession).toBeDefined();
    if (!existingSession) {
      throw new Error("Expected authenticated session to exist after authentication");
    }

    container.authenticatedSessions.set("session-user", {
      roomId: "custom-room-id",
      authedAt: Date.now() - 60_000,
    });

    vi.setSystemTime(new Date("2024-01-01T00:05:00.000Z"));
    const expectedAuthedAt = Date.now();

    socket.emit("message", Buffer.from(JSON.stringify(authMessage)));

    const refreshedSession = container.authenticatedSessions.get("session-user");
    expect(refreshedSession).toEqual({ roomId: "custom-room-id", authedAt: expectedAuthedAt });
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ t: "auth-ok" }));
  });

  it("cleans up on disconnect", async () => {
    const socket = new FakeWebSocket();
    wss.emitConnection(socket, { url: "/?uid=user-3" });

    // Authenticate the connection
    const authMessage: ClientMessage = { t: "authenticate", secret: "Fun1" };
    socket.emit("message", Buffer.from(JSON.stringify(authMessage)));
    await flushAuth();

    socket.emit("close");

    const state = container.roomService.getState();
    expect(state.users).not.toContain("user-3");
    expect(container.uidToWs.has("user-3")).toBe(false);
    expect(broadcastSpy).toHaveBeenCalledTimes(2);
    expect(deselectSpy).toHaveBeenCalledWith(state, "user-3");
  });

  it("deselects timed-out players during heartbeat cleanup", async () => {
    const socket = new FakeWebSocket();
    wss.emitConnection(socket, { url: "/?uid=user-4" });

    const authMessage: ClientMessage = { t: "authenticate", secret: "Fun1" };
    socket.emit("message", Buffer.from(JSON.stringify(authMessage)));
    await flushAuth();

    const state = container.roomService.getState();
    state.selectionState.set("user-4", { mode: "single", objectId: "token:user-4" });
    const player = state.players.find((p) => p.uid === "user-4");
    expect(player).toBeDefined();
    if (player) {
      // Set lastHeartbeat to 6 minutes ago (beyond 5 minute timeout)
      player.lastHeartbeat = Date.now() - 6 * 60 * 1000;
    }

    deselectSpy.mockClear();
    broadcastSpy.mockClear();

    vi.advanceTimersByTime(30_000);

    expect(state.users).not.toContain("user-4");
    expect(container.uidToWs.has("user-4")).toBe(false);
    expect(deselectSpy).toHaveBeenCalledWith(state, "user-4");
    expect(broadcastSpy).toHaveBeenCalled();
  });

  it("keeps the player entity and tokens when a connected player times out", async () => {
    // D6: a 5-minute lid close used to delete the player's tokens (and, for a
    // DM, every NPC token their uid owned). A timeout is now exactly a
    // disconnection: roster and auth are cleared, game state survives.
    const socket = new FakeWebSocket();
    wss.emitConnection(socket, { url: "/?uid=user-5" });
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({ t: "authenticate", secret: "Fun1" } satisfies ClientMessage)),
    );
    await flushAuth();

    const state = container.roomService.getState();
    const player = state.players.find((p) => p.uid === "user-5");
    expect(player).toBeDefined();
    if (!player) throw new Error("Expected player after authentication");
    player.lastHeartbeat = Date.now() - 6 * 60 * 1000;

    broadcastSpy.mockClear();
    vi.advanceTimersByTime(30_000);

    // Disconnected: socket closed, roster and connection map cleared...
    expect(socket.close).toHaveBeenCalled();
    expect(state.users).not.toContain("user-5");
    expect(container.uidToWs.has("user-5")).toBe(false);
    expect(broadcastSpy).toHaveBeenCalled();

    // ...but the player entity and their tokens are still there to reconnect to.
    expect(state.players.some((p) => p.uid === "user-5")).toBe(true);
    expect(state.tokens.some((t) => t.owner === "user-5")).toBe(true);

    // Swept exactly once — a later sweep must not re-clean (and re-broadcast)
    // the same already-disconnected player every 30 seconds forever.
    broadcastSpy.mockClear();
    vi.advanceTimersByTime(30_000);
    expect(broadcastSpy).not.toHaveBeenCalled();
  });

  it("throttles a bad-password loop per IP, before any password check runs", async () => {
    // D7: rate limiting used to key on the client-supplied uid, so one host
    // could rotate uids and stream scrypt-priced guesses forever. The budget
    // is now per connection IP (these fake sockets all share the "unknown"
    // bucket) and is spent BEFORE verify().
    const verifySpy = vi.mocked(container.authService.verify);
    verifySpy.mockClear();

    // 5 wrong guesses spend the whole capacity — rotating uids doesn't help.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const socket = new FakeWebSocket();
      wss.emitConnection(socket, { url: `/?uid=rotating-${attempt}` });
      socket.emit(
        "message",
        Buffer.from(JSON.stringify({ t: "authenticate", secret: "wrong-password" })),
      );
      await flushAuth();
    }
    expect(verifySpy).toHaveBeenCalledTimes(5);

    // The sixth guess is refused up front: no scrypt, a throttle reply.
    const throttledSocket = new FakeWebSocket();
    wss.emitConnection(throttledSocket, { url: "/?uid=rotating-final" });
    throttledSocket.emit(
      "message",
      Buffer.from(JSON.stringify({ t: "authenticate", secret: "wrong-password" })),
    );
    await flushAuth();

    expect(verifySpy).toHaveBeenCalledTimes(5);
    const frames = throttledSocket.send.mock.calls.map(
      ([p]) => JSON.parse(p as string) as { t?: string; reason?: string },
    );
    expect(frames[0]).toMatchObject({ t: "auth-failed" });
    expect(frames[0].reason).toMatch(/too many attempts/i);
  });

  it("never sweeps players restored from disk who have not connected", () => {
    // On boot every player loaded from disk carries a stale lastHeartbeat, so
    // the old sweep wiped every restored token 30 seconds after a restart.
    const state = container.roomService.getState();
    state.players.push({
      uid: "offline-player",
      name: "Restored From Disk",
      isDM: false,
      statusEffects: [],
      lastHeartbeat: Date.now() - 60 * 60 * 1000,
    });
    state.tokens.push({
      id: "offline-token",
      owner: "offline-player",
      x: 3,
      y: 4,
      color: "#00ff00",
      size: "medium",
    });

    broadcastSpy.mockClear();
    vi.advanceTimersByTime(30_000);

    expect(state.players.some((p) => p.uid === "offline-player")).toBe(true);
    expect(state.tokens.some((t) => t.owner === "offline-player")).toBe(true);
    expect(broadcastSpy).not.toHaveBeenCalled();
  });
});
