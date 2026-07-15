// ============================================================================
// GENERATION RAILS CONTRACT TESTS (map-studio-generate)
// ============================================================================
// A generate message runs a server-side recipe and applies its output to the
// target document as ONE place-room command — so undo, retry-dedupe, revision
// tracking, and (for the live-bound document) the recompile-and-broadcast all
// ride the existing rails. These tests drive the real MessageRouter with a
// real MapStudioService and fake sockets, mirroring liveMapBinding's setup.
//
// Room-snapshot broadcasts are debounced by 16ms (BroadcastService), so tests
// `await flush()` before reading snapshot frames.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WebSocket, WebSocketServer } from "ws";
import type { ClientMessage, RoomSnapshot, ServerMessage } from "@herobyte/shared";
import { MessageRouter } from "../messageRouter.js";
import { RoomService } from "../../domains/room/service.js";
import { TokenService } from "../../domains/token/service.js";
import { PlayerService } from "../../domains/player/service.js";
import { MapService } from "../../domains/map/service.js";
import { DiceService } from "../../domains/dice/service.js";
import { CharacterService } from "../../domains/character/service.js";
import { PropService } from "../../domains/prop/service.js";
import { SelectionService } from "../../domains/selection/service.js";
import { AuthService } from "../../domains/auth/service.js";

const DM = "dm-player";
const PLAYER = "watcher";

interface FakeSocket {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
}

function fakeSocket(): FakeSocket {
  return { readyState: 1, send: vi.fn() };
}

/** Flush the 16ms broadcast debounce so snapshot frames have been sent. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 25));
}

/** Room snapshots are broadcast as bare objects with no `t` field. */
function snapshotsOf(socket: FakeSocket): RoomSnapshot[] {
  return socket.send.mock.calls
    .map(([payload]) => JSON.parse(payload as string) as ServerMessage & { t?: string })
    .filter((message) => message.t === undefined) as unknown as RoomSnapshot[];
}

function latestSnapshot(socket: FakeSocket): RoomSnapshot | undefined {
  const all = snapshotsOf(socket);
  return all[all.length - 1];
}

function messagesOf(socket: FakeSocket, type: string): (ServerMessage & { t?: string })[] {
  return socket.send.mock.calls
    .map(([payload]) => JSON.parse(payload as string) as ServerMessage & { t?: string })
    .filter((message) => message.t === type);
}

function player(uid: string, isDM: boolean) {
  return {
    uid,
    name: uid,
    portrait: undefined,
    isDM,
    hp: 10,
    maxHp: 10,
    micLevel: 0,
    lastHeartbeat: Date.now(),
    statusEffects: [],
  };
}

function generateMessage(
  overrides: Partial<Extract<ClientMessage, { t: "map-studio-generate" }>> = {},
): ClientMessage {
  return {
    t: "map-studio-generate",
    documentId: "live",
    commandId: "gen-1",
    recipe: "dungeon",
    seed: 42,
    // Big enough to fit several rooms, so the corridors and doors a real
    // dungeon needs actually exist (a cramped region yields one room and
    // nothing to connect).
    bounds: { x: 2, y: 2, cols: 24, rows: 18 },
    params: { theme: "stone", density: "medium", secretDoorChance: 0.15 },
    ...overrides,
  };
}

describe("map-studio-generate contracts", () => {
  let router: MessageRouter;
  let roomService: RoomService;
  let dmWs: FakeSocket;
  let playerWs: FakeSocket;

  beforeEach(() => {
    roomService = new RoomService();
    roomService.setState({
      players: [player(DM, true), player(PLAYER, false)],
      tokens: [],
      pointers: [],
      sceneObjects: [],
      gridSize: 50,
      fogEnabled: false,
    });

    dmWs = fakeSocket();
    playerWs = fakeSocket();
    const uidToWs = new Map<string, WebSocket>([
      [DM, dmWs as unknown as WebSocket],
      [PLAYER, playerWs as unknown as WebSocket],
    ]);
    const clients = new Set<WebSocket>(uidToWs.values());

    router = new MessageRouter(
      roomService,
      new PlayerService(),
      new TokenService(),
      new MapService(),
      new DiceService(),
      new CharacterService(),
      new PropService(),
      new SelectionService(),
      {} as unknown as AuthService,
      {} as unknown as WebSocketServer,
      uidToWs,
      () => clients,
    );
  });

  afterEach(flush);

  function route(message: ClientMessage, senderUid: string): void {
    router.route(message, senderUid);
  }

  function createLiveDoc(): void {
    route({ t: "map-studio-create", document: { id: "live", name: "live" } }, DM);
    route({ t: "map-studio-set-live", documentId: "live" }, DM);
  }

  function documentRevision(): number {
    let revision: number | undefined;
    for (const [payload] of dmWs.send.mock.calls) {
      const frame = JSON.parse(payload as string) as {
        t?: string;
        document?: { id: string; revision: number };
      };
      if (frame.t === "map-studio-document" && frame.document?.id === "live") {
        revision = frame.document.revision;
      }
    }
    return revision ?? -1;
  }

  it("lands generated floor and walls on the player's table with no publish", async () => {
    createLiveDoc();
    playerWs.send.mockClear();

    route(generateMessage(), DM);
    await flush();

    const snapshot = latestSnapshot(playerWs);
    // The recipe's floor rides the terrain channel and its walls compile into
    // server-enforced geometry — both reached the player through the command
    // path, with no publish message anywhere.
    expect(snapshot?.mapTerrain).toBeDefined();
    expect(snapshot?.compiledScene?.walls.length).toBeGreaterThan(4);
    expect(snapshot?.compiledScene?.doors.length).toBeGreaterThan(0);
  });

  it("advances the document revision by exactly one (one command = one undo)", () => {
    createLiveDoc();

    route(generateMessage(), DM);

    expect(documentRevision()).toBe(1);
  });

  it("echoes the message's commandId as appliedCommandId on the DM document frame", () => {
    createLiveDoc();

    route(generateMessage({ commandId: "gen-echo" }), DM);

    const frames = messagesOf(dmWs, "map-studio-document") as unknown as Array<{
      appliedCommandId?: string;
    }>;
    expect(frames.some((frame) => frame.appliedCommandId === "gen-echo")).toBe(true);
  });

  it("removes the whole dungeon (floor AND walls) with a single undo", async () => {
    createLiveDoc();
    route(generateMessage(), DM);

    route(
      {
        t: "map-studio-command",
        command: { type: "undo", commandId: "undo-1", documentId: "live", baseRevision: 1 },
      },
      DM,
    );
    await flush();

    const state = roomService.getState();
    expect(state.compiledScene?.walls).toEqual([]);
    expect(state.mapTerrain).toBeUndefined();
  });

  it("does not double-apply a replayed generate (same commandId hits the dedupe cache)", () => {
    createLiveDoc();

    route(generateMessage(), DM);
    route(generateMessage(), DM);

    expect(documentRevision()).toBe(1);
  });

  it("acks a replayed generate from the cache even after the document changed underneath", () => {
    createLiveDoc();
    route(generateMessage(), DM);

    // The DM locks the walls layer AFTER the generate landed. A reconnect
    // re-send of the same commandId must still ack (the dungeon is already on
    // the map) — re-validating it would reject a command that succeeded.
    route(
      {
        t: "map-studio-command",
        command: {
          type: "update-layer",
          commandId: "lock-walls",
          documentId: "live",
          baseRevision: 1,
          layerId: "walls",
          update: { locked: true },
        },
      },
      DM,
    );
    dmWs.send.mockClear();

    route(generateMessage(), DM);

    expect(messagesOf(dmWs, "map-studio-error")).toHaveLength(0);
    const acks = messagesOf(dmWs, "map-studio-document") as unknown as Array<{
      appliedCommandId?: string;
    }>;
    expect(acks.some((frame) => frame.appliedCommandId === "gen-1")).toBe(true);
  });

  it("refuses to generate on a non-square grid instead of misaligning the room", () => {
    route({ t: "map-studio-create", document: { id: "hex", name: "hex" } }, DM);
    route(
      {
        t: "map-studio-command",
        command: {
          type: "update-grid",
          commandId: "to-hex",
          documentId: "hex",
          baseRevision: 0,
          update: { type: "hex-row" },
        },
      },
      DM,
    );

    route(generateMessage({ documentId: "hex", commandId: "gen-hex" }), DM);

    const errors = messagesOf(dmWs, "map-studio-error") as unknown as Array<{
      commandId: string;
      reason: string;
    }>;
    expect(
      errors.some((e) => e.commandId === "gen-hex" && /square grids only/.test(e.reason)),
    ).toBe(true);
  });

  it("rejects a non-DM generate without touching the document", async () => {
    createLiveDoc();
    playerWs.send.mockClear();

    route(generateMessage(), PLAYER);
    await flush();

    expect(documentRevision()).toBe(0);
    expect(roomService.getState().compiledScene?.walls).toEqual([]);
  });

  it("answers an unknown documentId with a map-studio-error and no crash", () => {
    route(generateMessage({ documentId: "ghost", commandId: "gen-ghost" }), DM);

    const errors = messagesOf(dmWs, "map-studio-error") as unknown as Array<{
      commandId: string;
      documentId: string;
      code: string;
    }>;
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      commandId: "gen-ghost",
      documentId: "ghost",
      code: "command-rejected",
    });
  });

  it("surfaces a resolver failure (locked walls layer) as a command-rejected error", () => {
    createLiveDoc();
    route(
      {
        t: "map-studio-command",
        command: {
          type: "update-layer",
          commandId: "lock-walls",
          documentId: "live",
          baseRevision: 0,
          layerId: "walls",
          update: { locked: true },
        },
      },
      DM,
    );

    route(generateMessage({ commandId: "gen-locked" }), DM);

    const errors = messagesOf(dmWs, "map-studio-error") as unknown as Array<{
      commandId: string;
      reason: string;
    }>;
    expect(errors.some((e) => e.commandId === "gen-locked" && /locked/.test(e.reason))).toBe(true);
  });

  it("applies to a non-live document without broadcasting the table", async () => {
    route({ t: "map-studio-create", document: { id: "prep", name: "prep" } }, DM);
    playerWs.send.mockClear();

    route(generateMessage({ documentId: "prep" }), DM);
    await flush();

    expect(snapshotsOf(playerWs)).toHaveLength(0);
    expect(roomService.getState().compiledScene).toBeUndefined();
  });

  it("generates deterministic element ids from the commandId prefix", () => {
    createLiveDoc();

    route(generateMessage({ commandId: "gen-ids" }), DM);

    const frames = messagesOf(dmWs, "map-studio-document") as unknown as Array<{
      document?: { elements: Array<{ id: string }> };
    }>;
    const last = frames[frames.length - 1];
    const ids = last?.document?.elements.map((e) => e.id) ?? [];

    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toEqual(ids.map((_, index) => `gen-ids:e${index}`));
  });

  it("disguises every generated secret door as an anonymous wall for players", async () => {
    createLiveDoc();
    playerWs.send.mockClear();

    // chance 1: every generated door is secret, so the player payload must
    // contain NO doors at all — only #-suffixed wall segments they cannot tell
    // apart from real walls.
    route(
      generateMessage({
        commandId: "gen-secret",
        params: { theme: "stone", density: "medium", secretDoorChance: 1 },
      }),
      DM,
    );
    await flush();

    const dmScene = latestSnapshot(dmWs)?.compiledScene;
    const playerScene = latestSnapshot(playerWs)?.compiledScene;
    expect(dmScene?.doors.length).toBeGreaterThan(0);
    expect(playerScene?.doors).toEqual([]);

    // Each secret door reappears in the player's walls under a #0 id, sharing
    // the exact id shape of a real compiled wall segment.
    for (const door of dmScene!.doors) {
      expect(playerScene?.walls.map((wall) => wall.id)).toContain(`${door.id}#0`);
    }
    for (const wall of playerScene?.walls ?? []) {
      expect(wall.id).toMatch(/^gen-secret:e\d+#\d+$/);
    }
  });
});
