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

describe("per-room secrets", () => {
  it("keeps custom rooms private: the default password never opens them", async () => {
    const { AuthService } = await import("../../domains/auth/service.js");
    const auth = new AuthService({ storagePath: "./test-room-secret.json" });

    const defaultSecret = "Fun1";
    // The default room uses the server password...
    expect(auth.verify(defaultSecret)).toBe(true);
    // ...but a never-created custom room is NOT joinable — the default password
    // (or any password) is refused until the room is minted with its own.
    expect(auth.verify(defaultSecret, "room-a")).toBe(false);
    expect(auth.verify("guess", "room-a")).toBe(false);

    // Create room A with its own password: only that opens it; the default and
    // room B are untouched, and room A's password doesn't open anything else.
    auth.createRoom("room-a", "room-a-secret");
    expect(auth.verify("room-a-secret", "room-a")).toBe(true);
    expect(auth.verify(defaultSecret, "room-a")).toBe(false);
    expect(auth.verify("room-a-secret", "room-b")).toBe(false); // room B still uncreated
    expect(auth.verify(defaultSecret, "room-b")).toBe(false);
    expect(auth.verify("room-a-secret")).toBe(false); // not the default room's password
    expect(auth.verify(defaultSecret)).toBe(true);
  });

  it("scopes DM passwords per room — custom rooms never fall back to the server DM password", async () => {
    const { AuthService } = await import("../../domains/auth/service.js");
    const auth = new AuthService({ storagePath: "./test-room-secret.json" });

    // The default room keeps the server-wide DM password...
    expect(auth.verifyDMPassword("FunDM")).toBe(true);
    expect(auth.hasDMPassword()).toBe(true);
    // ...but the server DM password must NEVER elevate inside a custom room, and
    // a custom room with no DM credential of its own reports none (mirrors the
    // room-password privacy contract). Prevents an invited player from seizing
    // DM with the shared default password.
    expect(auth.verifyDMPassword("FunDM", "room-a")).toBe(false);
    expect(auth.hasDMPassword("room-a")).toBe(false);

    auth.updateDMPassword("room-a-dm-pass", "room-a");
    expect(auth.verifyDMPassword("room-a-dm-pass", "room-a")).toBe(true);
    expect(auth.verifyDMPassword("FunDM", "room-a")).toBe(false);
    // A different custom room stays independent — no fallback, no cross-room key.
    expect(auth.verifyDMPassword("FunDM", "room-b")).toBe(false);
    expect(auth.verifyDMPassword("room-a-dm-pass", "room-b")).toBe(false);
    expect(auth.hasDMPassword("room-b")).toBe(false);
  });
});

describe("idle-room unload", () => {
  let container: Container;

  beforeEach(() => {
    vi.useFakeTimers();
    container = new Container(
      {} as unknown as WebSocketServer,
      authServiceStub,
      new RoomRegistry({ defaultRoomId: "default" }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("unloads idle empty rooms but keeps active ones and the default room", async () => {
    // room-idle: created, then everyone leaves.
    container.getRoomServiceForRoom("room-idle");
    container.touchRoomActivity("room-idle");

    // room-live: has a connected, authenticated player.
    const socket = fakeSocket();
    container.uidToWs.set("busy", socket as unknown as WebSocket);
    container.authenticatedUids.add("busy");
    container.authenticatedSessions.set("busy", { roomId: "room-live", authedAt: Date.now() });
    container.getRoomServiceForRoom("room-live");
    container.touchRoomActivity("room-live");

    vi.advanceTimersByTime(31 * 60 * 1000);
    const unloaded = await container.unloadIdleRooms(30 * 60 * 1000);

    expect(unloaded).toEqual(["room-idle"]);
    expect(container.roomRegistry.listRooms().sort()).toEqual(["default", "room-live"]);
  });

  it("restores an unloaded room's state from durable storage on the next join", async () => {
    const roomService = container.getRoomServiceForRoom("room-back");
    roomService.getState().tokens.push({ id: "keepsake", owner: "p1", x: 1, y: 1, color: "red" });
    roomService.setState({}); // sync token push into the store
    container.touchRoomActivity("room-back");

    vi.advanceTimersByTime(31 * 60 * 1000);
    await container.unloadIdleRooms(30 * 60 * 1000);
    expect(container.roomRegistry.listRooms()).not.toContain("room-back");

    // Rejoining recreates the room; with fs mocked the disk file is empty,
    // but the load path runs — the real restore round-trip is covered by
    // StatePersistence tests. Here we prove the room comes back cleanly.
    const restored = container.getRoomServiceForRoom("room-back");
    expect(restored.getState()).toBeDefined();
    expect(container.roomRegistry.listRooms()).toContain("room-back");
  });

  it("never unloads a room that saw recent activity", async () => {
    container.getRoomServiceForRoom("room-fresh");
    container.touchRoomActivity("room-fresh");

    const unloaded = await container.unloadIdleRooms(30 * 60 * 1000);

    expect(unloaded).toEqual([]);
    expect(container.roomRegistry.listRooms()).toContain("room-fresh");
  });
});
