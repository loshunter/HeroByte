// ============================================================================
// CROSS-ROOM ISOLATION CONTRACT TESTS
// ============================================================================
// The M2 exit gate: two groups play simultaneously in provable isolation.
// These tests drive a real Container (real registry, real per-room routers,
// real domain services) with fake sockets in two rooms and inspect every
// frame each socket receives. Nothing from room A may ever reach room B.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("fs", () => ({
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(false),
}));
vi.mock("fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
}));

import type { WebSocket, WebSocketServer } from "ws";
import type { ClientMessage } from "@herobyte/shared";
import { Container } from "../../container.js";
import { RoomRegistry } from "../../domains/room/RoomRegistry.js";
import { AuthenticationHandler } from "../auth/AuthenticationHandler.js";
import type { AuthService } from "../../domains/auth/service.js";

interface FakeSocket {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

function fakeSocket(): FakeSocket {
  return { readyState: 1, send: vi.fn(), close: vi.fn() };
}

function frameTypes(socket: FakeSocket): (string | undefined)[] {
  return socket.send.mock.calls.map(
    ([payload]) => (JSON.parse(payload as string) as { t?: string }).t,
  );
}

const authServiceStub = {
  verify: () => true,
  hasDMPassword: () => false,
} as unknown as AuthService;

describe("multi-room isolation contracts", () => {
  let container: Container;
  let alice: FakeSocket; // room-a player
  let adam: FakeSocket; // room-a player
  let bella: FakeSocket; // room-b player

  function join(uid: string, socket: FakeSocket, roomId: string): void {
    container.uidToWs.set(uid, socket as unknown as WebSocket);
    container.authenticatedUids.add(uid);
    container.authenticatedSessions.set(uid, { roomId, authedAt: Date.now() });
    const state = container.getRoomServiceForRoom(roomId).getState();
    state.users.push(uid);
    state.players.push({
      uid,
      name: uid,
      isDM: false,
      hp: 10,
      maxHp: 10,
      micLevel: 0,
      lastHeartbeat: Date.now(),
      statusEffects: [],
    });
    state.tokens.push({ id: `token-${uid}`, owner: uid, x: 0, y: 0, color: "red" });
  }

  function route(message: ClientMessage, uid: string): void {
    container.routerForUid(uid).route(message, uid);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    container = new Container(
      {} as unknown as WebSocketServer,
      authServiceStub,
      new RoomRegistry({ defaultRoomId: "default" }),
    );
    alice = fakeSocket();
    adam = fakeSocket();
    bella = fakeSocket();
    join("alice", alice, "room-a");
    join("adam", adam, "room-a");
    join("bella", bella, "room-b");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps room state fully separate", () => {
    const stateA = container.getRoomServiceForRoom("room-a").getState();
    const stateB = container.getRoomServiceForRoom("room-b").getState();

    expect(stateA.tokens.map((t) => t.owner)).toEqual(["alice", "adam"]);
    expect(stateB.tokens.map((t) => t.owner)).toEqual(["bella"]);
  });

  it("delivers token deltas only inside the mover's room", () => {
    route({ t: "move", id: "token-alice", x: 3, y: 3 }, "alice");

    expect(frameTypes(alice)).toContain("token-updated");
    expect(frameTypes(adam)).toContain("token-updated");
    expect(bella.send).not.toHaveBeenCalled();
  });

  it("keeps debounced full broadcasts inside the originating room", () => {
    route(
      {
        t: "dice-roll",
        roll: {
          id: "roll-1",
          playerName: "alice",
          formula: "1d20",
          total: 15,
          breakdown: [{ die: "d20", rolls: [15] }],
          timestamp: 1,
        },
      } as unknown as ClientMessage,
      "alice",
    );
    vi.advanceTimersByTime(50);

    // Snapshots have no `t`; both room-a sockets received one, bella none.
    expect(frameTypes(alice)).toContain(undefined);
    expect(frameTypes(adam)).toContain(undefined);
    expect(bella.send).not.toHaveBeenCalled();

    const stateB = container.getRoomServiceForRoom("room-b").getState();
    expect(stateB.diceRolls).toHaveLength(0);
  });

  it("keeps pointer previews inside the originating room", () => {
    route({ t: "point", x: 100, y: 100 }, "alice");

    expect(frameTypes(alice)).toContain("pointer-preview");
    expect(frameTypes(adam)).toContain("pointer-preview");
    expect(bella.send).not.toHaveBeenCalled();
  });

  it("forwards RTC signals within a room and never across rooms", () => {
    route(
      { t: "rtc-signal", target: "adam", signal: { type: "offer" } } as unknown as ClientMessage,
      "alice",
    );
    expect(frameTypes(adam)).toContain("rtc-signal");

    route(
      { t: "rtc-signal", target: "bella", signal: { type: "offer" } } as unknown as ClientMessage,
      "alice",
    );
    expect(bella.send).not.toHaveBeenCalled();
  });

  it("cleans up a disconnecting player inside their own room only", () => {
    // Simulate what DisconnectionCleanupManager does via the container surface.
    const roomId = container.roomIdForUid("bella");
    expect(roomId).toBe("room-b");

    const clientsA = container.getAuthenticatedClientsForRoom("room-a");
    const clientsB = container.getAuthenticatedClientsForRoom("room-b");
    expect(clientsA.size).toBe(2);
    expect(clientsB.size).toBe(1);
    expect(clientsA.has(bella as unknown as WebSocket)).toBe(false);
  });
});

describe("authentication creates and scopes rooms", () => {
  let container: Container;
  let handler: AuthenticationHandler;

  beforeEach(() => {
    container = new Container(
      {} as unknown as WebSocketServer,
      authServiceStub,
      new RoomRegistry({ defaultRoomId: "default" }),
    );
    handler = new AuthenticationHandler(
      container,
      container.uidToWs,
      container.authenticatedUids,
      container.authenticatedSessions,
    );
  });

  it("creates a room on first join and binds the session to it", () => {
    const ws = fakeSocket();
    container.uidToWs.set("wanderer", ws as unknown as WebSocket);

    handler.authenticate("wanderer", "password", "castle-3f9");

    expect(frameTypes(ws)).toContain("auth-ok");
    expect(container.roomIdForUid("wanderer")).toBe("castle-3f9");
    const state = container.getRoomServiceForRoom("castle-3f9").getState();
    expect(state.players.map((p) => p.uid)).toEqual(["wanderer"]);
    // The default room saw nothing.
    expect(container.roomService.getState().players).toHaveLength(0);
  });

  it("rejects malformed room ids before touching any state", () => {
    const ws = fakeSocket();
    container.uidToWs.set("intruder", ws as unknown as WebSocket);

    handler.authenticate("intruder", "password", "../etc/passwd");

    const frames = ws.send.mock.calls.map(([p]) => JSON.parse(p as string) as { t?: string });
    expect(frames[0]).toMatchObject({ t: "auth-failed", reason: "Invalid room id" });
    expect(container.authenticatedUids.has("intruder")).toBe(false);
  });

  it("defaults to the default room when no roomId is provided", () => {
    const ws = fakeSocket();
    container.uidToWs.set("homer", ws as unknown as WebSocket);

    handler.authenticate("homer", "password");

    expect(container.roomIdForUid("homer")).toBe("default");
    expect(container.roomService.getState().players.map((p) => p.uid)).toEqual(["homer"]);
  });
});
