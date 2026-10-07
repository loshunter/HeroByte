// ============================================================================
// VOICE PRESENCE CONTRACT TESTS — no ghost in the call
// ============================================================================
// `voice` and `micLevel` are cleared when a socket closes, but a socket that
// is REPLACED closes stale: its close handler skips cleanup, because the uid
// already belongs to the newcomer. These tests drive the REAL ConnectionHandler
// over a REAL Container with fake sockets through every replacement path —
// a token takeover, a dead occupant replaced at connect, a move to another
// table — and pin that each ends with the player out of the call and silent.
// The client re-sends its voice-state on every authentication, so a real
// reconnect re-enters the call by saying so.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("fs", () => ({
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(false),
  renameSync: vi.fn(),
  mkdirSync: vi.fn(),
}));
vi.mock("fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

import type { WebSocketServer } from "ws";
import { Container } from "../../container.js";
import { RoomRegistry } from "../../domains/room/RoomRegistry.js";
import { ConnectionHandler } from "../connectionHandler.js";
import type { AuthService } from "../../domains/auth/service.js";

const ROOM_PASSWORD = "Fun1";

type SocketEvent = "message" | "close";

/** Reads OPEN until something closes it. */
class FakeSocket {
  public readyState = 1;
  public send = vi.fn<(data: string) => void>();
  public ping = vi.fn();
  public close = vi.fn<(code?: number, reason?: string) => void>(() => {
    this.readyState = 3;
    this.emit("close");
  });
  private handlers: Partial<Record<SocketEvent, (data?: unknown) => void>> = {};

  on(event: SocketEvent, handler: (data?: unknown) => void) {
    this.handlers[event] = handler;
  }

  emit(event: SocketEvent, data?: unknown) {
    this.handlers[event]?.(data);
  }

  token(): string {
    const authOk = this.send.mock.calls
      .map(([p]) => JSON.parse(p) as { t?: string; sessionToken?: string })
      .find((f) => f.t === "auth-ok");
    if (!authOk?.sessionToken) throw new Error("auth-ok carried no token");
    return authOk.sessionToken;
  }
}

class FakeServer {
  private onConnection?: (ws: FakeSocket, req: unknown) => void;
  on(_event: "connection", handler: (ws: FakeSocket, req: unknown) => void) {
    this.onConnection = handler;
  }
  connect(uid: string): FakeSocket {
    const ws = new FakeSocket();
    const req = { url: `/?uid=${uid}`, socket: { remoteAddress: "198.51.100.10" }, headers: {} };
    this.onConnection?.(ws, req);
    return ws;
  }
}

const authServiceStub = {
  verify: async (secret: string) => secret === ROOM_PASSWORD,
  verifyDMPassword: async () => false,
  hasDMPassword: () => false,
  getSummary: () => ({ source: "fallback", updatedAt: 0 }),
} as unknown as AuthService;

/** Let a fire-and-forget authenticate() settle without advancing the clock. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

describe("voice presence survives no replaced socket", () => {
  let container: Container;
  let server: FakeServer;

  function send(ws: FakeSocket, frame: Record<string, unknown>): void {
    ws.emit("message", Buffer.from(JSON.stringify(frame)));
  }

  async function authenticate(ws: FakeSocket, token?: string, roomId?: string): Promise<void> {
    send(ws, { t: "authenticate", secret: ROOM_PASSWORD, token, roomId });
    await settle();
  }

  function eve(roomId = "default") {
    const state = container.getRoomServiceForRoom(roomId).getState();
    return state.players.find((p) => p.uid === "eve");
  }

  /** eve joins the default table, enters the call and is speaking. */
  async function joinTalking(): Promise<FakeSocket> {
    const ws = server.connect("eve");
    await authenticate(ws);
    send(ws, { t: "voice-state", state: "live" });
    send(ws, { t: "mic-level", level: 0.8 });
    expect(eve()).toMatchObject({ voice: "live", micLevel: 0.8 });
    return ws;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T12:00:00.000Z"));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    container = new Container(
      {} as unknown as WebSocketServer,
      authServiceStub,
      new RoomRegistry({ defaultRoomId: "default" }),
    );
    server = new FakeServer();
    new ConnectionHandler(container, server as unknown as WebSocketServer).attach();
  });

  afterEach(() => {
    container.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("a token takeover (a reload over a live socket) leaves the call until the newcomer rejoins", async () => {
    const old = await joinTalking();
    const fresh = server.connect("eve");

    await authenticate(fresh, old.token());

    expect(old.close).toHaveBeenCalledWith(4002, "Replaced by new connection");
    expect(eve()).not.toHaveProperty("voice");
    expect(eve()?.micLevel).toBe(0);
    // The newcomer re-enters by saying so, as the client does on every auth.
    send(fresh, { t: "voice-state", state: "live" });
    expect(eve()?.voice).toBe("live");
  });

  it("a DEAD occupant replaced at connect leaves the call before any authenticate", async () => {
    const dead = await joinTalking();
    dead.readyState = 3; // closed on the wire, close event not yet delivered

    server.connect("eve");

    expect(dead.close).toHaveBeenCalledWith(4002, "Replaced by new connection");
    expect(eve()).not.toHaveProperty("voice");
    expect(eve()?.micLevel).toBe(0);
  });

  /** The players array of every snapshot frame this socket received, oldest first. */
  function snapshots(ws: FakeSocket): Array<Array<{ uid: string; voice?: string }>> {
    return ws.send.mock.calls
      .map(([p]) => JSON.parse(p) as { t?: string; players?: Array<{ uid: string }> })
      .filter((f) => f.t === undefined && Array.isArray(f.players))
      .map((f) => f.players as Array<{ uid: string; voice?: string }>);
  }

  it("a DEAD occupant replaced at connect is broadcast, so the others stop seeing a ghost", async () => {
    const adam = server.connect("adam");
    await authenticate(adam);
    const dead = await joinTalking();
    vi.advanceTimersByTime(100); // the debounced voice-state broadcast goes out
    // adam sees eve in the call before the replacement.
    const before = snapshots(adam);
    expect(before[before.length - 1]?.find((p) => p.uid === "eve")?.voice).toBe("live");
    dead.readyState = 3;
    adam.send.mockClear();

    server.connect("eve");

    const frames = snapshots(adam);
    expect(frames).toHaveLength(1);
    const eveSeen = frames[0]?.find((p) => p.uid === "eve") as {
      voice?: string;
      micLevel?: number;
    };
    expect(eveSeen).toBeDefined();
    expect(eveSeen).not.toHaveProperty("voice");
    expect(eveSeen.micLevel).toBe(0);
  });

  it("a fresh connect that replaces no one broadcasts nothing", async () => {
    const adam = server.connect("adam");
    await authenticate(adam);
    adam.send.mockClear();

    server.connect("newcomer");

    expect(snapshots(adam)).toHaveLength(0);
  });

  it("moving to another table leaves the old table's call", async () => {
    const old = await joinTalking();
    const fresh = server.connect("eve");

    await authenticate(fresh, old.token(), "castle-3f9");

    expect(container.roomIdForUid("eve")).toBe("castle-3f9");
    expect(eve("default")).not.toHaveProperty("voice");
    expect(eve("default")?.micLevel).toBe(0);
    expect(eve("castle-3f9")).not.toHaveProperty("voice");
  });
});
