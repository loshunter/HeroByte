import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fs", () => ({
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(false),
}));

import type { Container } from "../../container.js";
import { ConnectionHandler } from "../connectionHandler.js";
import { RoomService } from "../../domains/room/service.js";
import { PlayerService } from "../../domains/player/service.js";
import { TokenService } from "../../domains/token/service.js";
import { MapService } from "../../domains/map/service.js";
import { DiceService } from "../../domains/dice/service.js";
import { CharacterService } from "../../domains/character/service.js";
import { MessageRouter } from "../messageRouter.js";
import { RateLimiter } from "../../middleware/rateLimit.js";
import type { ClientMessage } from "@shared";
import type { WebSocket, WebSocketServer } from "ws";

type WebSocketEvent = "message" | "close";

class FakeWebSocket {
  public readyState = 1;
  public send = vi.fn<(data: string | Buffer) => void>();
  public ping = vi.fn();
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
  const fakeNodeServer = { clients: new Set<WebSocket>() } as unknown as WebSocketServer;
  const messageRouter = new MessageRouter(
    roomService,
    playerService,
    tokenService,
    mapService,
    diceService,
    characterService,
    fakeNodeServer,
    new Map<string, WebSocket>(),
    () => new Set<WebSocket>(),
  );

  const rateLimiter = new RateLimiter({ maxMessages: 100, windowMs: 1000 });
  vi.spyOn(rateLimiter, "check").mockReturnValue(true);

  const uidToWs = new Map<string, WebSocket>();
  const authenticatedUids = new Set<string>();
  const authenticatedSessions = new Map<string, { roomId: string; authedAt: number }>();

  const container: Partial<Container> = {
    roomService,
    playerService,
    tokenService,
    mapService,
    diceService,
    characterService,
    messageRouter,
    rateLimiter,
    uidToWs,
    authenticatedUids,
    authenticatedSessions,
    getAuthenticatedClients: () => {
      const clients = new Set<WebSocket>();
      for (const uid of authenticatedUids) {
        const ws = uidToWs.get(uid);
        if (ws && ws.readyState === 1) {
          clients.add(ws);
        }
      }
      return clients;
    },
  };

  return container as Container;
};

describe("ConnectionHandler", () => {
  let wss: FakeWebSocketServer;
  let container: Container;
  let handler: ConnectionHandler;

  beforeEach(() => {
    vi.useFakeTimers();
    wss = new FakeWebSocketServer();
    container = setupContainer();
    vi.spyOn(container.roomService, "broadcast").mockImplementation(() => {});
    handler = new ConnectionHandler(container, wss as unknown as WebSocketServer);
    handler.attach();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("registers new connections and spawns player/token state", () => {
    const socket = new FakeWebSocket();
    wss.emitConnection(socket, { url: "/?uid=user-1" });

    // Authenticate the connection
    const authMessage: ClientMessage = { t: "authenticate", secret: "Fun1" };
    socket.emit("message", Buffer.from(JSON.stringify(authMessage)));

    const state = container.roomService.getState();
    expect(state.users).toContain("user-1");
    expect(state.players).toHaveLength(1);
    expect(state.tokens).toHaveLength(1);
    expect(container.uidToWs.get("user-1")).toBe(socket);
    expect(container.roomService.broadcast).toHaveBeenCalled();

    vi.advanceTimersByTime(25_000);
    expect(socket.ping).toHaveBeenCalled();
  });

  it("updates heartbeat and respects rate limits", () => {
    const socket = new FakeWebSocket();
    wss.emitConnection(socket, { url: "/?uid=user-2" });

    // Authenticate the connection
    const authMessage: ClientMessage = { t: "authenticate", secret: "Fun1" };
    socket.emit("message", Buffer.from(JSON.stringify(authMessage)));

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

  it("cleans up on disconnect", () => {
    const socket = new FakeWebSocket();
    wss.emitConnection(socket, { url: "/?uid=user-3" });

    // Authenticate the connection
    const authMessage: ClientMessage = { t: "authenticate", secret: "Fun1" };
    socket.emit("message", Buffer.from(JSON.stringify(authMessage)));

    socket.emit("close");

    const state = container.roomService.getState();
    expect(state.users).not.toContain("user-3");
    expect(container.uidToWs.has("user-3")).toBe(false);
    expect(container.roomService.broadcast).toHaveBeenCalledTimes(2);
  });
});
