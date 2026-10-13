import path from "node:path";
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
import { SessionTokenService, SESSION_TOKEN_GRACE_MS } from "../auth/SessionTokenService.js";

// Scratch state file: a bare `new RoomService({ stateFile: TEST_STATE_FILE })` writes the REAL
// apps/server/herobyte-state.json, which parallel workers and the dev
// server then fight over (observed: a torn file, quarantined as .corrupt).
const TEST_STATE_FILE = path.join(process.cwd(), ".tmp", "connectionHandler-state.json");

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

/**
 * `req` carries socket/headers because ConnectionHandler reads the remote
 * address off them for the per-IP auth budget. Without those fields every
 * fake socket resolved to the shared "unknown" bucket, so the socket→IP
 * recording line could be deleted outright and every test still passed.
 */
type FakeConnectionRequest = {
  url: string;
  socket?: { remoteAddress?: string };
  headers?: Record<string, string | string[] | undefined>;
};

class FakeWebSocketServer {
  public clients = new Set<FakeWebSocket>();
  private handlers: Partial<
    Record<"connection", (ws: FakeWebSocket, req: FakeConnectionRequest) => void>
  > = {};

  on(event: "connection", handler: (ws: FakeWebSocket, req: FakeConnectionRequest) => void) {
    this.handlers[event] = handler;
  }

  emitConnection(ws: FakeWebSocket, req: FakeConnectionRequest) {
    this.clients.add(ws);
    this.handlers["connection"]?.(ws, req);
  }
}

const setupContainer = () => {
  const roomService = new RoomService({ stateFile: TEST_STATE_FILE });
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
    liveSockets: new Map<string, Map<WebSocket, number>>(),
    authenticatedUids,
    authenticatedSessions,
    sessionTokens: new SessionTokenService(),
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

  /** Every auth-ok frame a socket was sent. Each carries a freshly minted session token. */
  const authOkFrames = (socket: FakeWebSocket) =>
    socket.send.mock.calls
      .map(([p]) => JSON.parse(p as string) as { t?: string; sessionToken?: string })
      .filter((frame) => frame.t === "auth-ok");

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

  it("rejects a connection with no uid and never registers or wires it", async () => {
    const socket = new FakeWebSocket();
    // No ?uid= in the URL. It used to be funnelled into the shared "anon"
    // identity where any two such clients were each other's incumbent.
    wss.emitConnection(socket, { url: "/" });

    expect(socket.close).toHaveBeenCalledWith(1008, "Missing or invalid session id");
    // Nothing was registered, and no message handler was attached: a frame
    // sent afterwards must not spawn a player or reach the router.
    expect(container.uidToWs.size).toBe(0);
    socket.emit("message", Buffer.from(JSON.stringify({ t: "authenticate", secret: "Fun1" })));
    await flushAuth();
    expect(container.roomService.getState().players).toHaveLength(0);
  });

  it("registers every open socket per uid — a held second one too — and forgets each on close", () => {
    // remove-player's connected gate reads Container.liveSockets: a second tab
    // on the password form is HELD (never in uidToWs) and outlives the first
    // tab's close, so it must be registered on connect and forgotten on close.
    const first = new FakeWebSocket();
    wss.emitConnection(first, { url: "/?uid=user-live" });
    const second = new FakeWebSocket(); // a live incumbent: this one is held
    wss.emitConnection(second, { url: "/?uid=user-live" });
    expect(container.uidToWs.get("user-live")).toBe(first);
    expect([...(container.liveSockets.get("user-live")?.keys() ?? [])]).toEqual([first, second]);
    for (const since of container.liveSockets.get("user-live")?.values() ?? []) {
      expect(typeof since).toBe("number");
    }

    first.emit("close");
    expect([...(container.liveSockets.get("user-live")?.keys() ?? [])]).toEqual([second]);
    second.emit("close");
    expect(container.liveSockets.has("user-live")).toBe(false);
  });

  it("a rejected connection (no usable uid) is never registered as a live socket", () => {
    wss.emitConnection(new FakeWebSocket(), { url: "/" });
    expect(container.liveSockets.size).toBe(0);
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

  it("re-tokens a DM's character on re-authentication even when they own NPC tokens (F4's review)", async () => {
    const socket = new FakeWebSocket();
    wss.emitConnection(socket, { url: "/?uid=user-dm" });
    const authMessage: ClientMessage = { t: "authenticate", secret: "Fun1" };
    socket.emit("message", Buffer.from(JSON.stringify(authMessage)));
    await flushAuth();

    const state = container.roomService.getState();
    const characters = container.characterService!;
    const tokens = container.tokenService!;
    const pc = characters.findCharacterByOwner(state, "user-dm");
    if (!pc?.tokenId) throw new Error("the join road links a token");
    // A goblin the DM placed carries the DM's uid; then the DM deletes their
    // own token. "Any token this uid owns" used to find the goblin and stop.
    const gob = characters.createCharacter(state, "Goblin", 7, undefined, "npc");
    characters.placeNPCToken(state, tokens, gob.id, "user-dm");
    const goblinToken = gob.tokenId as string;
    tokens.forceDeleteToken(state, pc.tokenId);
    expect(pc.tokenId).toBeFalsy();

    // A reconnect is a NEW socket with the same uid, the old one dead on the
    // wire (readyState CLOSED) but not yet cleaned up — the blip case. A LIVE
    // old socket would instead hold the newcomer until it proved the session
    // token (see sessionHijack.contract.test.ts); that is not this test. The
    // reconnect presents its session token, as a real client does — a tokenless
    // reclaim inside the grace window is refused now.
    const token = authOkFrames(socket)[0].sessionToken;
    socket.readyState = 3;
    const reconnected = new FakeWebSocket();
    wss.emitConnection(reconnected, { url: "/?uid=user-dm" });
    reconnected.emit("message", Buffer.from(JSON.stringify({ ...authMessage, token })));
    await flushAuth();

    expect(pc.tokenId).toBeTruthy();
    expect(pc.tokenId).not.toBe(goblinToken);
    expect(gob.tokenId).toBe(goblinToken);
    expect(state.tokens.map((t) => t.id).sort()).toEqual([goblinToken, pc.tokenId].sort());
    // The token is the DM's own, at the table's spawn — not a stranger's, not at 0,0.
    const spawned = state.tokens.find((t) => t.id === pc.tokenId);
    expect(spawned?.owner).toBe("user-dm");
    expect(spawned).toMatchObject(container.roomService.getPlayerSpawnPosition());
  });

  it("re-tokens EVERY PC a uid owns on reconnect — a second PC's dead link is repaired too", async () => {
    const socket = new FakeWebSocket();
    wss.emitConnection(socket, { url: "/?uid=user-two" });
    const authMessage: ClientMessage = { t: "authenticate", secret: "Fun1" };
    socket.emit("message", Buffer.from(JSON.stringify(authMessage)));
    await flushAuth();

    const state = container.roomService.getState();
    const characters = container.characterService!;
    const first = characters.findCharacterByOwner(state, "user-two");
    if (!first?.tokenId) throw new Error("the join road links a token");
    const second = characters.createCharacter(state, "Second", 30, undefined, "pc");
    characters.claimCharacter(state, second.id, "user-two");
    second.tokenId = "deleted-before-unlink-shipped";

    const token = authOkFrames(socket)[0].sessionToken;
    socket.readyState = 3; // the old socket is dead on the wire (see the test above)
    const reconnected = new FakeWebSocket();
    wss.emitConnection(reconnected, { url: "/?uid=user-two" });
    reconnected.emit("message", Buffer.from(JSON.stringify({ ...authMessage, token })));
    await flushAuth();

    expect(first.tokenId).toBeTruthy();
    expect(second.tokenId).toBeTruthy();
    expect(second.tokenId).not.toBe("deleted-before-unlink-shipped");
    expect(state.tokens.map((t) => t.id).sort()).toEqual([first.tokenId, second.tokenId].sort());
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
    expect(authOkFrames(socket)).toHaveLength(2);
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
    expect(authOkFrames(socket)).toHaveLength(2);
  });

  it("a password auth hands the client a session token, and each auth mints a fresh one", async () => {
    const socket = new FakeWebSocket();
    wss.emitConnection(socket, { url: "/?uid=user-token" });
    const authMessage: ClientMessage = { t: "authenticate", secret: "Fun1" };
    socket.emit("message", Buffer.from(JSON.stringify(authMessage)));
    await flushAuth();

    const [first] = authOkFrames(socket);
    expect(first.sessionToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // The server holds only the hash, but the raw token verifies against it.
    expect(container.sessionTokens.verify("user-token", "default", first.sessionToken)).toBe(true);

    // A re-auth on the same socket rotates: the old token stops verifying.
    socket.emit("message", Buffer.from(JSON.stringify(authMessage)));
    await flushAuth();
    const [, second] = authOkFrames(socket);
    expect(second.sessionToken).not.toBe(first.sessionToken);
    expect(container.sessionTokens.verify("user-token", "default", first.sessionToken)).toBe(false);
    expect(container.sessionTokens.verify("user-token", "default", second.sessionToken)).toBe(true);
  });

  it("a disconnect detaches the token but keeps it reclaimable inside the grace window", async () => {
    const socket = new FakeWebSocket();
    wss.emitConnection(socket, { url: "/?uid=user-away" });
    socket.emit("message", Buffer.from(JSON.stringify({ t: "authenticate", secret: "Fun1" })));
    await flushAuth();
    const [{ sessionToken }] = authOkFrames(socket);

    socket.emit("close");

    // Still good for a reload or a blip...
    expect(container.sessionTokens.verify("user-away", "default", sessionToken)).toBe(true);
    // ...and gone once the grace window closes. (An explicit clock rather than
    // advancing the fake timers six hours — that would fire the idle-room
    // sweep against this single-room harness.)
    const afterGrace = Date.now() + SESSION_TOKEN_GRACE_MS + 1;
    expect(container.sessionTokens.verify("user-away", "default", sessionToken, afterGrace)).toBe(
      false,
    );
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

  it("a heartbeat timeout detaches the session token exactly as a disconnect does", async () => {
    const socket = new FakeWebSocket();
    wss.emitConnection(socket, { url: "/?uid=user-idle" });
    socket.emit("message", Buffer.from(JSON.stringify({ t: "authenticate", secret: "Fun1" })));
    await flushAuth();
    const [{ sessionToken }] = authOkFrames(socket);
    const state = container.roomService.getState();
    state.players.find((p) => p.uid === "user-idle")!.lastHeartbeat = Date.now() - 6 * 60 * 1000;

    vi.advanceTimersByTime(30_000); // the sweep

    expect(socket.close).toHaveBeenCalled();
    expect(container.sessionTokens.verify("user-idle", "default", sessionToken)).toBe(true);
    const afterGrace = Date.now() + SESSION_TOKEN_GRACE_MS + 1;
    expect(container.sessionTokens.verify("user-idle", "default", sessionToken, afterGrace)).toBe(
      false,
    );
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

  /** Authenticate from a specific source address and settle the async work. */
  const attemptFrom = async (uid: string, ip: string, secret: string) => {
    const socket = new FakeWebSocket();
    wss.emitConnection(socket, { url: `/?uid=${uid}`, socket: { remoteAddress: ip } });
    socket.emit("message", Buffer.from(JSON.stringify({ t: "authenticate", secret })));
    await flushAuth();
    return socket;
  };

  it("throttles a bad-password loop per IP, before any password check runs", async () => {
    // D7: rate limiting used to key on the client-supplied uid, so one host
    // could rotate uids and stream scrypt-priced guesses forever. The budget
    // is now per connection IP and is spent BEFORE verify().
    const verifySpy = vi.mocked(container.authService.verify);
    verifySpy.mockClear();

    // 5 wrong guesses spend the whole capacity — rotating uids doesn't help.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await attemptFrom(`rotating-${attempt}`, "203.0.113.9", "wrong-password");
    }
    expect(verifySpy).toHaveBeenCalledTimes(5);

    // The sixth guess is refused up front: no scrypt, a throttle reply.
    const throttledSocket = await attemptFrom("rotating-final", "203.0.113.9", "wrong-password");

    expect(verifySpy).toHaveBeenCalledTimes(5);
    const frames = throttledSocket.send.mock.calls.map(
      ([p]) => JSON.parse(p as string) as { t?: string; reason?: string },
    );
    expect(frames[0]).toMatchObject({ t: "auth-failed" });
    expect(frames[0].reason).toMatch(/too many attempts/i);
  });

  it("one flooding network cannot lock another network out", async () => {
    // Pins the socket→IP wiring itself (ConnectionHandler recording
    // clientIpFor off req.socket/headers). Without it every socket lands in
    // the shared "unknown" bucket and the flooder takes the whole table
    // down with them — the exact S1 failure mode.
    const verifySpy = vi.mocked(container.authService.verify);

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await attemptFrom(`flooder-${attempt}`, "203.0.113.9", "wrong-password");
    }
    verifySpy.mockClear();

    // A bystander on a different network still gets their password checked...
    const bystander = await attemptFrom("bystander", "198.51.100.4", "Fun1");
    expect(verifySpy).toHaveBeenCalledTimes(1);
    expect(
      bystander.send.mock.calls.map(([p]) => JSON.parse(p as string) as { t?: string }),
    ).toContainEqual(expect.objectContaining({ t: "auth-ok" }));

    // ...and the flooder is still cut off.
    const stillFlooding = await attemptFrom("flooder-again", "203.0.113.9", "wrong-password");
    const frames = stillFlooding.send.mock.calls.map(
      ([p]) => JSON.parse(p as string) as { reason?: string },
    );
    expect(frames[0]?.reason).toMatch(/too many attempts/i);
  });

  it("a repeated in-flight attempt refunds its token instead of draining the network", async () => {
    // takeAuthWork runs before the pendingAuthWork gate, so a double-submit
    // used to spend a token, send nothing, and silently erode the budget —
    // enough ordinary double-clicks and a correct password gets refused.
    const verifySpy = vi.mocked(container.authService.verify);
    verifySpy.mockClear();

    const socket = new FakeWebSocket();
    wss.emitConnection(socket, { url: "/?uid=doubler", socket: { remoteAddress: "192.0.2.50" } });
    const authFrame = Buffer.from(JSON.stringify({ t: "authenticate", secret: "Fun1" }));
    // Two attempts in the SAME tick: the second finds the first in flight.
    socket.emit("message", authFrame);
    socket.emit("message", authFrame);
    await flushAuth();

    // Capacity is 5. Six more wrong guesses from this IP must still reach
    // verify (5 of them) rather than being short-changed by the leak.
    verifySpy.mockClear();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await attemptFrom(`after-${attempt}`, "192.0.2.50", "wrong-password");
    }
    expect(verifySpy).toHaveBeenCalledTimes(5);
  });

  it("a SECOND socket for one uid gets a REPLY, not silence, while the first's hash is in flight", async () => {
    // The in-flight guard keys on the SOCKET, not the uid. Before, a reload
    // mid-scrypt connected as the same uid (held), auto-authenticated, found
    // pendingAuthWork.has(uid) true, and was dropped with NO reply — the tab
    // hung on "Authenticating…" until a manual retry. Now the second socket
    // reaches the auth logic and is answered: it is turned away 4003 (a live
    // socket already holds the uid and it has no token to prove the session),
    // which the client surfaces as "Held in another window" with a retry — a
    // reply the user can act on, never a hang.
    const verifySpy = vi.mocked(container.authService.verify);
    let releaseFirst!: () => void;
    // The FIRST hash parks; every later call resolves immediately.
    verifySpy.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          releaseFirst = () => resolve(true);
        }),
    );

    const authFrame = Buffer.from(JSON.stringify({ t: "authenticate", secret: "Fun1" }));
    const first = new FakeWebSocket();
    wss.emitConnection(first, { url: "/?uid=dup", socket: { remoteAddress: "192.0.2.9" } });
    first.emit("message", authFrame); // first enters scrypt and parks there
    await flushAuth();
    expect(authOkFrames(first)).toHaveLength(0); // still hashing

    // A reload: a new socket, same uid, held behind the live first socket.
    const second = new FakeWebSocket();
    wss.emitConnection(second, { url: "/?uid=dup", socket: { remoteAddress: "192.0.2.9" } });
    second.emit("message", authFrame);
    await flushAuth();

    // The second login is answered (4003), not silently swallowed by the
    // in-flight guard, and it did not evict the live first socket.
    expect(second.close).toHaveBeenCalledWith(4003, "Session held by another connection");
    expect(container.uidToWs.get("dup")).not.toBe(second);

    // The first's parked hash now completes and authenticates its own socket.
    releaseFirst();
    await flushAuth();
    expect(authOkFrames(first)).toHaveLength(1);
    expect(container.uidToWs.get("dup")).toBe(first);
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
