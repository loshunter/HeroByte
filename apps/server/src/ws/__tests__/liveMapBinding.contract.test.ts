// ============================================================================
// LIVE-BOUND DOCUMENT CONTRACT TESTS
// ============================================================================
// A room can bind one map document as "live": every command applied to that
// document recompiles the scene (preserving door runtime states) and broadcasts
// a fresh per-recipient room snapshot — the same channel publish uses, but with
// no publish message. These tests drive the real MessageRouter with a real
// MapStudioService and fake sockets, then inspect every frame each recipient
// received.
//
// Room-snapshot broadcasts are debounced by 16ms (BroadcastService), so tests
// `await flush()` before reading snapshot frames. Command results that mutate
// server state are asserted synchronously off roomService.getState().

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WebSocket, WebSocketServer } from "ws";
import type {
  ClientMessage,
  MapDoorElement,
  MapDoorState,
  MapElement,
  MapTextElement,
  MapTileElement,
  MapWallElement,
  RoomSnapshot,
  ServerMessage,
} from "@herobyte/shared";
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

function wallElement(id: string): MapWallElement {
  return {
    id,
    layerId: "walls",
    type: "wall",
    locked: false,
    hidden: false,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: {
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      blocksMovement: true,
      blocksVision: true,
    },
  };
}

function doorElement(id: string, state: MapDoorState = "closed"): MapDoorElement {
  return {
    id,
    layerId: "walls",
    type: "door",
    locked: false,
    hidden: false,
    transform: { x: 10, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: { width: 40, state, blocksMovement: true, blocksVision: true },
  };
}

// A tile on the visible default "objects" layer (player-safe scenery).
function tileElement(id: string): MapTileElement {
  return {
    id,
    layerId: "objects",
    type: "tile",
    locked: false,
    hidden: false,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: { assetId: "tile:crate", columns: 2, rows: 2 },
  };
}

function textElement(
  id: string,
  text: string,
  visibleToPlayers: boolean,
  layerId = "objects",
): MapTextElement {
  return {
    id,
    layerId,
    type: "text",
    locked: false,
    hidden: false,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: { text, color: "#ffffff", fontSize: 24, visibleToPlayers },
  };
}

/** The raw string payloads sent to a socket — for grepping the wire for leaks. */
function rawFramesOf(socket: FakeSocket): string[] {
  return socket.send.mock.calls.map(([payload]) => payload as string);
}

describe("live-bound document contracts", () => {
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

  // Drain any pending 16ms broadcast timer into this test's (already-asserted)
  // sockets so it can't fire against the next test's fresh router.
  afterEach(flush);

  function route(message: ClientMessage, senderUid: string): void {
    router.route(message, senderUid);
  }

  function createDoc(id: string): void {
    route({ t: "map-studio-create", document: { id, name: id } }, DM);
  }

  function addElement(
    documentId: string,
    baseRevision: number,
    element: MapElement,
    commandId: string,
  ): void {
    route(
      {
        t: "map-studio-command",
        command: { type: "add-element", commandId, documentId, baseRevision, element },
      },
      DM,
    );
  }

  it("binds a document so players receive its compiled scene in the next snapshot", async () => {
    createDoc("live");
    route({ t: "map-studio-set-live", documentId: "live" }, DM);
    await flush();

    const snapshot = latestSnapshot(playerWs);
    expect(snapshot?.compiledScene).toBeDefined();
    expect(snapshot?.compiledScene?.walls).toEqual([]);
    // The binding id is DM-only chrome — players never learn which doc is live.
    expect(snapshot?.liveMapDocumentId).toBeUndefined();
    expect(latestSnapshot(dmWs)?.liveMapDocumentId).toBe("live");
  });

  it("attaches painted terrain to the player snapshot on a live paint command", async () => {
    createDoc("live");
    route({ t: "map-studio-set-live", documentId: "live" }, DM);
    playerWs.send.mockClear();

    route(
      {
        t: "map-studio-command",
        command: {
          type: "paint-terrain",
          commandId: "paint-1",
          documentId: "live",
          baseRevision: 0,
          cells: [{ x: 0, y: 0, assetId: "terrain:grass" }],
        },
      },
      DM,
    );
    await flush();

    expect(latestSnapshot(playerWs)?.mapTerrain).toBeDefined();
  });

  it("grows the player's compiled walls on an add-element command with no publish", async () => {
    createDoc("live");
    route({ t: "map-studio-set-live", documentId: "live" }, DM);
    playerWs.send.mockClear();

    addElement("live", 0, wallElement("wall-1"), "cmd-wall");
    await flush();

    // A 2-point wall compiles to one segment; it reached the player through the
    // command path — no publish message was ever sent.
    expect(latestSnapshot(playerWs)?.compiledScene?.walls).toHaveLength(1);
  });

  it("keeps a door opened at runtime open across an unrelated wall edit", async () => {
    createDoc("live");
    route({ t: "map-studio-set-live", documentId: "live" }, DM);
    addElement("live", 0, doorElement("door-1"), "cmd-door");

    // The DM opens the door at runtime (mutates the compiled door in place).
    route({ t: "toggle-door", doorId: "door-1" }, DM);
    expect(roomService.getState().compiledScene?.doors[0]?.state).toBe("open");

    // An unrelated wall edit recompiles the whole scene from the document,
    // whose authored door state is "closed" — the runtime "open" must survive.
    addElement("live", 1, wallElement("wall-1"), "cmd-wall");
    await flush();

    const door = roomService.getState().compiledScene?.doors.find((d) => d.id === "door-1");
    expect(door?.state).toBe("open");
    // ...and the DM's snapshot still shows it open.
    expect(latestSnapshot(dmWs)?.compiledScene?.doors[0]?.state).toBe("open");
  });

  it("disguises a live-authored secret door as an anonymous wall for players", async () => {
    createDoc("live");
    route({ t: "map-studio-set-live", documentId: "live" }, DM);
    playerWs.send.mockClear();

    addElement("live", 0, doorElement("secret-door", "secret"), "cmd-secret");
    await flush();

    const playerScene = latestSnapshot(playerWs)?.compiledScene;
    // No door leaks to the player; it reappears as a wall with a #index id so
    // it is indistinguishable from a compiled wall segment on the wire.
    expect(playerScene?.doors).toEqual([]);
    expect(playerScene?.walls.map((w) => w.id)).toContain("secret-door#0");
    // The DM still sees the real secret door.
    expect(latestSnapshot(dmWs)?.compiledScene?.doors.map((d) => d.id)).toEqual(["secret-door"]);
    // Server state is untouched by the per-recipient disguise.
    expect(roomService.getState().compiledScene?.doors).toHaveLength(1);
  });

  it("rejects map-studio-set-live from a non-DM without changing the binding", () => {
    createDoc("live");
    route({ t: "map-studio-set-live", documentId: "live" }, DM);
    expect(roomService.getState().liveMapDocumentId).toBe("live");

    // A player tries to unbind — the handler's DM gate throws and the router
    // swallows it; the binding is unchanged.
    route({ t: "map-studio-set-live", documentId: null }, PLAYER);

    expect(roomService.getState().liveMapDocumentId).toBe("live");
  });

  it("clears the binding when the DM sends set-live with null", () => {
    createDoc("live");
    route({ t: "map-studio-set-live", documentId: "live" }, DM);
    expect(roomService.getState().liveMapDocumentId).toBe("live");

    route({ t: "map-studio-set-live", documentId: null }, DM);

    expect(roomService.getState().liveMapDocumentId).toBeUndefined();
  });

  it("rejects binding a document that does not exist and leaves the room unbound", () => {
    route({ t: "map-studio-set-live", documentId: "ghost" }, DM);

    expect(roomService.getState().liveMapDocumentId).toBeUndefined();
    expect(messagesOf(dmWs, "map-studio-error")).toHaveLength(1);
  });

  it("leaves an unbound room untouched: commands do not broadcast the table", async () => {
    createDoc("unbound");
    playerWs.send.mockClear();

    addElement("unbound", 0, wallElement("wall-1"), "cmd-wall");
    await flush();

    // No live binding → no recompile, no room broadcast; the table never learns.
    expect(snapshotsOf(playerWs)).toHaveLength(0);
    expect(roomService.getState().compiledScene).toBeUndefined();
  });

  it("attaches live-authored scenery to the player snapshot with no publish", async () => {
    createDoc("live");
    route({ t: "map-studio-set-live", documentId: "live" }, DM);
    playerWs.send.mockClear();

    addElement("live", 0, tileElement("crate-1"), "cmd-tile");
    await flush();

    const elements = latestSnapshot(playerWs)?.mapElements;
    expect(elements).toBeDefined();
    const ids = elements!.layers.flatMap((layer) => layer.elements.map((e) => e.id));
    expect(ids).toContain("crate-1");
  });

  it("never leaks GM-only text to a player's frame or snapshot", async () => {
    createDoc("live");
    route({ t: "map-studio-set-live", documentId: "live" }, DM);
    playerWs.send.mockClear();

    // Three texts in one document: a player-private one (objects layer), a
    // GM note (notes layer, even though flagged visible), and a public one.
    addElement("live", 0, textElement("t-private", "VAULT-CODE-4271", false), "c1");
    addElement("live", 1, textElement("t-note", "AMBUSH-AT-DAWN", true, "notes"), "c2");
    addElement("live", 2, textElement("t-shown", "Welcome to the Keep", true), "c3");
    await flush();

    // The player's raw wire frames carry NO trace of the secret strings...
    const raw = rawFramesOf(playerWs).join("\n");
    expect(raw).not.toContain("VAULT-CODE-4271");
    expect(raw).not.toContain("AMBUSH-AT-DAWN");
    // ...but the public text did arrive.
    expect(raw).toContain("Welcome to the Keep");

    const ids = latestSnapshot(playerWs)?.mapElements?.layers.flatMap((layer) =>
      layer.elements.map((e) => e.id),
    );
    expect(ids).toEqual(["t-shown"]);
  });
});
