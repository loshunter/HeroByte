// ============================================================================
// SESSION IDENTITY CONTRACT TESTS — who may hold a uid's session
// ============================================================================
// A uid is client-supplied and every uid is published in the roster, so on its
// own it proves nothing. These tests drive the REAL ConnectionHandler over a
// REAL Container with fake sockets and pin the one rule that makes the uid
// safe to key on: adopting a uid's authenticated session — its socket, its
// auth flag, above all its `isDM` — requires proving that session's token.
// Holding the room password is NOT enough: the password is shared by the
// whole table and cannot tell dave from someone dave's host also invited.

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

import type { WebSocket, WebSocketServer } from "ws";
import type { RoomSnapshot } from "@herobyte/shared";
import { Container } from "../../container.js";
import { RoomRegistry } from "../../domains/room/RoomRegistry.js";
import { ConnectionHandler } from "../connectionHandler.js";
import type { AuthService } from "../../domains/auth/service.js";
import { SESSION_TOKEN_GRACE_MS } from "../auth/SessionTokenService.js";

const ROOM_PASSWORD = "Fun1";

type SocketEvent = "message" | "close";

/** A zombie by default: readyState stays OPEN until something closes it. */
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

  /** Every frame parsed, snapshots included (they have no `t`). */
  frames(): Array<Record<string, unknown> & { t?: string }> {
    return this.send.mock.calls.map(
      ([p]) => JSON.parse(p) as Record<string, unknown> & { t?: string },
    );
  }

  authOk(): Array<{ sessionToken?: string }> {
    return this.frames().filter((f) => f.t === "auth-ok") as Array<{ sessionToken?: string }>;
  }

  latestSnapshot(): RoomSnapshot | undefined {
    const snapshots = this.frames().filter((f) => f.t === undefined) as unknown as RoomSnapshot[];
    return snapshots[snapshots.length - 1];
  }

  /** The raw bytes this socket was sent — the strongest form of "never saw it". */
  rawBytes(): string {
    return this.send.mock.calls.map(([p]) => String(p)).join("\n");
  }
}

class FakeServer {
  private onConnection?: (ws: FakeSocket, req: unknown) => void;
  on(_event: "connection", handler: (ws: FakeSocket, req: unknown) => void) {
    this.onConnection = handler;
  }
  connect(uid: string, ip = "198.51.100.10"): FakeSocket {
    const ws = new FakeSocket();
    this.onConnection?.(ws, { url: `/?uid=${uid}`, socket: { remoteAddress: ip }, headers: {} });
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

describe("session identity: who may hold a uid's session", () => {
  let container: Container;
  let server: FakeServer;

  function send(ws: FakeSocket, frame: Record<string, unknown>): void {
    ws.emit("message", Buffer.from(JSON.stringify(frame)));
  }

  async function authenticate(ws: FakeSocket, token?: string): Promise<void> {
    send(ws, { t: "authenticate", secret: ROOM_PASSWORD, token });
    await settle();
  }

  function dave() {
    return container.roomService.getState().players.find((p) => p.uid === "dave");
  }

  /** dave joins on a fresh socket, is made DM, and hands back socket + token. */
  async function joinAsDM(): Promise<{ ws: FakeSocket; token: string }> {
    const ws = server.connect("dave");
    await authenticate(ws);
    const token = ws.authOk()[0]?.sessionToken;
    if (!token) throw new Error("auth-ok carried no token");
    dave()!.isDM = true;
    return { ws, token };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-19T12:00:00.000Z"));
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

  describe("reclaiming a uid after its socket is gone (offline DM re-inherit, C)", () => {
    it("a reconnect that presents the session token resumes as DM", async () => {
      const { ws, token } = await joinAsDM();
      ws.close(1001, "browser going away"); // clean close → cleanup ran, token detached

      const back = server.connect("dave");
      await authenticate(back, token);

      expect(back.authOk()).toHaveLength(1);
      expect(dave()?.isDM).toBe(true);
      expect(container.authenticatedUids.has("dave")).toBe(true);
      // Rotated: the token that got in is not the token that was presented.
      expect(back.authOk()[0].sessionToken).not.toBe(token);
    });

    it("a reclaim with the room password but NO token gets dave's record as a non-DM", async () => {
      const { ws } = await joinAsDM();
      ws.close(1001, "browser going away");

      const impostor = server.connect("dave", "203.0.113.7");
      await authenticate(impostor);
      vi.advanceTimersByTime(50); // the auth-success broadcast is debounced

      // In, as dave — the password was right — but with the DM flag reset...
      expect(impostor.authOk()).toHaveLength(1);
      expect(dave()?.isDM).toBe(false);
      // ...and that is what the wire says too, not just the in-memory record.
      const roster = impostor.latestSnapshot()?.players ?? [];
      expect(roster.find((p) => p.uid === "dave")?.isDM).toBe(false);
    });

    it("a WRONG token is a tokenless reclaim", async () => {
      const { ws, token } = await joinAsDM();
      ws.close(1001, "browser going away");

      const impostor = server.connect("dave", "203.0.113.7");
      await authenticate(impostor, token.slice(0, -1) + (token.endsWith("A") ? "B" : "A"));

      expect(impostor.authOk()).toHaveLength(1);
      expect(dave()?.isDM).toBe(false);
    });

    it("a token that has sat detached past the grace window no longer restores DM", async () => {
      const { ws, token } = await joinAsDM();
      ws.close(1001, "browser going away");
      // Move the clock, not the timers: advancing six hours of fake timers
      // would also run the idle-room sweeps, which is not what is under test.
      vi.setSystemTime(Date.now() + SESSION_TOKEN_GRACE_MS + 1);

      const back = server.connect("dave");
      await authenticate(back, token);

      expect(back.authOk()).toHaveLength(1);
      expect(dave()?.isDM).toBe(false);
    });

    it("a token minted for another table does not carry DM into this one", async () => {
      // dave is DM in a private table; the same uid then joins the default
      // table waving the private table's token.
      const ws = server.connect("dave");
      send(ws, { t: "authenticate", secret: ROOM_PASSWORD, roomId: "castle-3f9" });
      await settle();
      const token = ws.authOk()[0]?.sessionToken;
      const privateState = container.getRoomServiceForRoom("castle-3f9").getState();
      privateState.players.find((p) => p.uid === "dave")!.isDM = true;
      ws.close(1001, "leaving");
      // Seed a DM record for dave in the default table too, as if left behind.
      container.roomService.getState().players.push({
        uid: "dave",
        name: "dave",
        isDM: true,
        statusEffects: [],
        lastHeartbeat: 0,
      });

      const back = server.connect("dave");
      await authenticate(back, token);

      expect(back.authOk()).toHaveLength(1);
      expect(dave()?.isDM).toBe(false);
    });
  });

  describe("the socket that already holds the session", () => {
    it("re-authenticating on the SAME socket without a token keeps DM — nothing new is granted", async () => {
      const { ws } = await joinAsDM();

      send(ws, { t: "authenticate", secret: ROOM_PASSWORD });
      await settle();

      expect(ws.authOk()).toHaveLength(2);
      expect(dave()?.isDM).toBe(true);
    });
  });

  // The proven exploit, step by step. Before this arc: step 2 closed dave's
  // socket, kept dave's auth flag for the newcomer, and step 3 ran a DM action
  // as dave — with nothing but the uid off the roster.
  describe("claiming a uid whose session is LIVE on another socket (online takeover, A + D)", () => {
    const ATTACKER_IP = "203.0.113.7";

    it("connecting as the DM's uid neither evicts the DM nor adopts the session", async () => {
      const { ws: daveWs } = await joinAsDM();

      const intruder = server.connect("dave", ATTACKER_IP);

      // D: the real DM is untouched — no close, still registered, still authenticated.
      expect(daveWs.close).not.toHaveBeenCalled();
      expect(daveWs.readyState).toBe(1);
      expect(container.uidToWs.get("dave")).toBe(daveWs as unknown as WebSocket);
      expect(container.authenticatedUids.has("dave")).toBe(true);
      // A: the intruder inherited nothing — not even a frame.
      expect(intruder.send).not.toHaveBeenCalled();
    });

    it("a DM action from the unproven socket is dropped, even though the uid IS authenticated", async () => {
      const { ws: daveWs } = await joinAsDM();
      const intruder = server.connect("dave", ATTACKER_IP);

      send(intruder, { t: "start-combat" });
      await settle();

      expect(container.roomService.getState().combatActive).not.toBe(true);
      // ...while the same action from dave's own socket goes through.
      send(daveWs, { t: "start-combat" });
      await settle();
      expect(container.roomService.getState().combatActive).toBe(true);
    });

    it("authenticate with the room password but no token is turned away with 4003; the DM is untouched", async () => {
      const { ws: daveWs } = await joinAsDM();
      const intruder = server.connect("dave", ATTACKER_IP);

      await authenticate(intruder);

      expect(intruder.close).toHaveBeenCalledWith(4003, "Session held by another connection");
      expect(intruder.authOk()).toHaveLength(0);
      expect(daveWs.close).not.toHaveBeenCalled();
      expect(container.uidToWs.get("dave")).toBe(daveWs as unknown as WebSocket);
      expect(container.authenticatedUids.has("dave")).toBe(true);
      expect(dave()?.isDM).toBe(true);
    });

    it("a WRONG token is turned away the same way", async () => {
      const { ws: daveWs, token } = await joinAsDM();
      const intruder = server.connect("dave", ATTACKER_IP);

      await authenticate(intruder, token.slice(0, -1) + (token.endsWith("A") ? "B" : "A"));

      expect(intruder.close).toHaveBeenCalledWith(4003, "Session held by another connection");
      expect(daveWs.close).not.toHaveBeenCalled();
      expect(container.uidToWs.get("dave")).toBe(daveWs as unknown as WebSocket);
    });

    it("a whisper to dave reaches only dave's real socket while an unproven one is pending", async () => {
      const { ws: daveWs } = await joinAsDM();
      const erin = server.connect("erin");
      await authenticate(erin);
      const intruder = server.connect("dave", ATTACKER_IP);

      send(erin, { t: "chat", text: "the vault code is on the altar", to: "dave" });
      vi.advanceTimersByTime(50); // debounced broadcast

      expect(daveWs.rawBytes()).toContain("the vault code is on the altar");
      expect(intruder.rawBytes()).not.toContain("vault code");
    });

    it("the session token takes over: the stale socket gets 4002, the newcomer is DM and can act", async () => {
      // A zombie incumbent: dave's laptop lid closed, the socket reads OPEN
      // for up to the 5-minute heartbeat window. The same browser reconnects.
      const { ws: staleWs, token } = await joinAsDM();
      const fresh = server.connect("dave");
      // The swap must register the newcomer BEFORE closing the stale socket:
      // a close handler that runs synchronously would otherwise run the
      // disconnect cleanup against the live session — dropping the DM's
      // selection is its one visible side effect here.
      const deselect = vi.spyOn(container.selectionService, "deselect");

      await authenticate(fresh, token);

      expect(deselect).not.toHaveBeenCalled();
      expect(staleWs.close).toHaveBeenCalledTimes(1);
      expect(staleWs.close).toHaveBeenCalledWith(4002, "Replaced by new connection");
      expect(container.uidToWs.get("dave")).toBe(fresh as unknown as WebSocket);
      expect(container.authenticatedUids.has("dave")).toBe(true);
      expect(fresh.authOk()).toHaveLength(1);
      expect(fresh.authOk()[0].sessionToken).not.toBe(token); // rotated
      expect(dave()?.isDM).toBe(true);
      // Registered once, not twice, in the roster.
      expect(container.roomService.getState().users.filter((u) => u === "dave")).toHaveLength(1);

      send(fresh, { t: "start-combat" });
      await settle();
      expect(container.roomService.getState().combatActive).toBe(true);
    });

    it("a token is enough to take over even into a different table (a second tab on another table)", async () => {
      const { ws: staleWs, token } = await joinAsDM(); // dave's session is in the default table
      const fresh = server.connect("dave");

      send(fresh, { t: "authenticate", secret: ROOM_PASSWORD, roomId: "castle-3f9", token });
      await settle();

      expect(staleWs.close).toHaveBeenCalledWith(4002, "Replaced by new connection");
      expect(fresh.authOk()).toHaveLength(1);
      expect(container.roomIdForUid("dave")).toBe("castle-3f9");
      // Left the old roster — a stale entry there would later make the
      // heartbeat sweep clean up the NEW room instead.
      expect(container.roomService.getState().users).not.toContain("dave");
      // DM is per table: the default-table elevation does not follow.
      const castle = container.getRoomServiceForRoom("castle-3f9").getState();
      expect(castle.players.find((p) => p.uid === "dave")?.isDM).toBe(false);
    });

    it("a DEAD incumbent is replaced at connect, but its auth is not inherited", async () => {
      const { ws: deadWs, token } = await joinAsDM();
      deadWs.readyState = 3; // closed on the wire, close event not yet delivered

      const fresh = server.connect("dave", ATTACKER_IP);

      // Replaced (this is the fast reconnect path)...
      expect(deadWs.close).toHaveBeenCalledWith(4002, "Replaced by new connection");
      expect(container.uidToWs.get("dave")).toBe(fresh as unknown as WebSocket);
      // ...but connect alone confers nothing: a DM action is dropped...
      expect(container.authenticatedUids.has("dave")).toBe(false);
      send(fresh, { t: "start-combat" });
      await settle();
      expect(container.roomService.getState().combatActive).not.toBe(true);
      // ...and a tokenless password auth comes back as a non-DM.
      await authenticate(fresh);
      expect(fresh.authOk()).toHaveLength(1);
      expect(dave()?.isDM).toBe(false);
      // The token would have kept it — proving the reset is the token's absence.
      void token;
    });

    it("a rejected takeover stays charged against the intruder's budget, a successful one is refunded", async () => {
      const { token } = await joinAsDM();
      const budget = container.authWorkLimiter;
      const takeSpy = vi.spyOn(budget, "take");
      const refundSpy = vi.spyOn(budget, "refund");

      const intruder = server.connect("dave", ATTACKER_IP);
      await authenticate(intruder);
      expect(takeSpy).toHaveBeenCalledWith(ATTACKER_IP);
      expect(refundSpy).not.toHaveBeenCalledWith(ATTACKER_IP);

      const fresh = server.connect("dave");
      await authenticate(fresh, token);
      expect(refundSpy).toHaveBeenCalledWith("198.51.100.10");
    });
  });
});
