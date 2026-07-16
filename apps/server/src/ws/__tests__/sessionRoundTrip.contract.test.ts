// ============================================================================
// SESSION ROUND TRIP — export from one server, restore onto a WIPED one
// ============================================================================
// This is the contract that makes session files a real workaround rather than a
// comforting button. The deployed server has an ephemeral filesystem
// (DEPLOYMENT.md): a restart or a 15-minute idle spin-down loses room state,
// map documents and room secrets together. A session file is how a DM carries a
// table across that gap.
//
// So the test restores onto a genuinely FRESH set of services, not the same
// room. That distinction is the whole point: loadSnapshot applies its merge with
// Object.assign, so a field the merge omits keeps whatever the room already had.
// In-process that reads as "preserved" and every test passes. Onto a wiped
// server it means "preserved nothing" — which is exactly how the map came back
// without its scenery and nobody noticed.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WebSocket, WebSocketServer } from "ws";
import type { ClientMessage, MapDocument, ServerMessage } from "@herobyte/shared";
import { MessageRouter } from "../messageRouter.js";
import { MapStudioService } from "../../domains/mapStudio/service.js";
import { RoomService } from "../../domains/room/service.js";
import { TokenService } from "../../domains/token/service.js";
import { PlayerService } from "../../domains/player/service.js";
import { MapService } from "../../domains/map/service.js";
import { DiceService } from "../../domains/dice/service.js";
import { CharacterService } from "../../domains/character/service.js";
import { PropService } from "../../domains/prop/service.js";
import { SelectionService } from "../../domains/selection/service.js";
import { AuthService } from "../../domains/auth/service.js";
import { validateLoadSessionMessage } from "../../middleware/validators/roomValidators.js";
import { validateLoadSessionEnvelope } from "../../middleware/validators/sessionValidators.js";

const DM = "dm-player";

interface FakeSocket {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
}

function fakeSocket(): FakeSocket {
  return { readyState: 1, send: vi.fn() };
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

/** One complete server: fresh services, fresh router, one DM socket. */
function bootServer() {
  const roomService = new RoomService();
  roomService.setState({
    players: [player(DM, true)],
    tokens: [],
    pointers: [],
    sceneObjects: [],
    gridSize: 50,
    fogEnabled: false,
  });

  const dmWs = fakeSocket();
  const uidToWs = new Map<string, WebSocket>([[DM, dmWs as unknown as WebSocket]]);
  const clients = new Set<WebSocket>(uidToWs.values());
  const mapStudioService = new MapStudioService();

  const router = new MessageRouter(
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
    mapStudioService,
  );

  return {
    roomService,
    mapStudioService,
    dmWs,
    route: (message: ClientMessage, uid = DM) => router.route(message, uid),
  };
}

function framesOf(socket: FakeSocket, type: string): (ServerMessage & { t?: string })[] {
  return socket.send.mock.calls
    .map(([payload]) => JSON.parse(payload as string) as ServerMessage & { t?: string })
    .filter((message) => message.t === type);
}

/** Author a live-bound map with a wall and a tile on it, as a DM would. */
function authorLiveMap(server: ReturnType<typeof bootServer>) {
  server.route({ t: "map-studio-create", document: { id: "live", name: "live" } });
  server.route({ t: "map-studio-set-live", documentId: "live" });
  const document = server.mapStudioService.get("default", "live");
  const walls = document.layers.find((layer) => layer.kind === "walls");
  const objects = document.layers.find((layer) => layer.kind === "objects");
  server.route({
    t: "map-studio-command",
    command: {
      type: "add-element",
      commandId: "cmd-wall",
      documentId: "live",
      baseRevision: document.revision,
      element: {
        id: "wall-1",
        layerId: walls!.id,
        type: "wall",
        locked: false,
        hidden: false,
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        data: {
          points: [
            { x: 0, y: 0 },
            { x: 200, y: 0 },
          ],
          blocksMovement: true,
          blocksVision: true,
        },
      },
    },
  });
  server.route({
    t: "map-studio-command",
    command: {
      type: "add-element",
      commandId: "cmd-tile",
      documentId: "live",
      baseRevision: server.mapStudioService.get("default", "live").revision,
      element: {
        id: "tile-1",
        layerId: objects!.id,
        type: "tile",
        locked: false,
        hidden: false,
        transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0 },
        data: { assetId: "tile:crate", columns: 1, rows: 1 },
      },
    },
  });
}

describe("session round trip", () => {
  let origin: ReturnType<typeof bootServer>;

  beforeEach(() => {
    origin = bootServer();
    authorLiveMap(origin);
  });

  function exportSession() {
    origin.dmWs.send.mockClear();
    origin.route({ t: "session-export" });
    const frames = framesOf(origin.dmWs, "session-file") as unknown as Array<{
      file: {
        snapshot: Record<string, unknown>;
        mapDocuments: MapDocument[];
        liveMapDocumentId?: string;
      };
    }>;
    // Through JSON, always. The first version of this helper handed the live
    // object straight back to the restore, which is not a round trip: it skipped
    // the serialize the real path performs and hid a file that no loader on
    // earth could read.
    return JSON.parse(JSON.stringify(frames[0]!.file)) as (typeof frames)[0]["file"];
  }

  // --------------------------------------------------------------------------
  // THE EXHAUSTIVE CHECK
  // --------------------------------------------------------------------------
  // Every other test here names the fields it cares about, which means a field
  // added later is covered by nobody and nothing says so — exactly how
  // mapElements went missing. This one enumerates RoomState's OWN key list at
  // runtime, so a new field fails it by default until someone classifies it.

  /**
   * Fields deliberately NOT carried by a session file, and why. Anything not in
   * here and not round-tripped is a bug — see the sweep test below.
   */
  const NOT_PERSISTED: Record<string, string> = {
    users: "live socket list; the restoring server has its own",
    pointers: "transient per-connection cursors, cleared on load by design",
    selectionState: "per-connection UI state, keyed by uids that no longer exist",
    drawingUndoStacks: "per-player undo history; not table state",
    drawingRedoStacks: "per-player redo history; not table state",
    stateVersion: "a monotonic counter the restoring server owns (it max()es)",
    players: "connection metadata; mergeSnapshot merges live players over the file",
    characters: "merged, not replaced — connected players keep their own",
    tokens: "merged, not replaced — connected players keep their own",
  };

  it("carries every RoomState field, or documents why not", () => {
    // Paint terrain so mapTerrain is actually populated — deriveMapTerrain
    // returns undefined for an unpainted document, which would make this test
    // pass while proving nothing about the terrain channel.
    origin.route({
      t: "map-studio-command",
      command: {
        type: "paint-terrain",
        commandId: "cmd-paint",
        documentId: "live",
        baseRevision: origin.mapStudioService.get("default", "live").revision,
        cells: [
          { x: 0, y: 0, assetId: "terrain:stone-floor" },
          { x: 1, y: 0, assetId: "terrain:stone-floor" },
        ],
      },
    });

    // Populate EVERY remaining field with a distinctive value.
    origin.roomService.setState({
      mapBackground: "https://i.imgur.com/roundtrip.png",
      gridSize: 70,
      gridSquareSize: 10,
      combatActive: true,
      fogEnabled: true,
      playerStagingZone: { x: 1, y: 2, width: 3, height: 4, rotation: 0 },
      characters: [
        { id: "char-1", name: "Hero", type: "pc", hp: 5, maxHp: 5, initiative: 12 } as never,
      ],
      currentTurnCharacterId: "char-1",
      props: [
        {
          id: "prop-1",
          x: 5,
          y: 6,
          assetId: "prop:barrel",
          owner: null,
          scale: 1,
          rotation: 0,
        } as never,
      ],
      drawings: [
        {
          id: "d-1",
          type: "freehand",
          points: [{ x: 0, y: 0 }],
          color: "#fff",
          width: 2,
          opacity: 1,
        } as never,
      ],
      diceRolls: [{ id: "r-1", uid: DM, formula: "1d20", total: 17 } as never],
    });

    const before = origin.roomService.getState();
    const file = exportSession();
    const restored = bootServer();
    restored.route({
      t: "load-session",
      snapshot: file.snapshot as never,
      mapDocuments: file.mapDocuments,
      liveMapDocumentId: file.liveMapDocumentId,
    });
    const after = restored.roomService.getState();

    // THE SWEEP. Compare ORIGIN to RESTORED — not "restored is defined", which
    // passes vacuously for any field the fixture forgot to populate. A field
    // that had a value before and has none after is LOST, and a new RoomState
    // field lands here automatically until someone classifies it.
    const lost: string[] = [];
    for (const key of Object.keys(before)) {
      if (key in NOT_PERSISTED) continue;
      const originValue = (before as unknown as Record<string, unknown>)[key];
      const restoredValue = (after as unknown as Record<string, unknown>)[key];
      const hadValue = originValue !== undefined && originValue !== null;
      const keptValue = restoredValue !== undefined && restoredValue !== null;
      if (hadValue && !keptValue) lost.push(key);
    }
    expect({ lost }).toEqual({ lost: [] });

    // Guard the guard: if the fixture stops populating a field, the sweep above
    // silently stops checking it. Assert we actually exercised the map channels.
    expect(before.mapTerrain).toBeDefined();
    expect(before.currentTurnCharacterId).toBe("char-1");

    // ...and spot-check the values themselves, since "defined" is a low bar.
    expect(after.mapBackground).toBe("https://i.imgur.com/roundtrip.png");
    expect(after.gridSize).toBe(70);
    expect(after.gridSquareSize).toBe(10);
    expect(after.combatActive).toBe(true);
    expect(after.fogEnabled).toBe(true);
    expect(after.playerStagingZone).toEqual({ x: 1, y: 2, width: 3, height: 4, rotation: 0 });
    expect(after.props).toHaveLength(1);
    expect(after.drawings).toHaveLength(1);
    expect(after.diceRolls).toHaveLength(1);
    expect(after.mapElements).toBeDefined();
    expect(after.compiledScene?.walls.length).toBeGreaterThan(0);
    expect(after.mapTerrain).toBeDefined();
    expect(after.liveMapDocumentId).toBe("live");
  });

  it("writes a file the loaders can actually read", () => {
    // THE REGRESSION GUARD, and the bug that made every saved file unloadable:
    // toSnapshot diverts drawings and mapBackground into assets/assetRefs and
    // emits NO `drawings` key — while both the client parser and the server's own
    // load validator require one (`players`, `tokens`, and drawings-as-array-or-
    // assetRef). A room with zero drawings emitted neither, so the file was
    // rejected by the server too. The export flattens for exactly this reason.
    const file = exportSession();

    expect(Array.isArray(file.snapshot.drawings)).toBe(true);
    // ...and the wire-only indirection does not belong in a file.
    expect(file.snapshot.assets).toBeUndefined();
    expect(file.snapshot.assetRefs).toBeUndefined();
    // The server's real load validator must accept what the real export wrote.
    expect(validateLoadSessionMessage({ t: "load-session", snapshot: file.snapshot }).valid).toBe(
      true,
    );
  });

  it("keeps a map background in the file as a plain value", () => {
    // It rides assetRefs on the wire; a file must be self-contained.
    origin.roomService.setState({ mapBackground: "https://i.imgur.com/abc.png" });

    const file = exportSession();

    expect(file.snapshot.mapBackground).toBe("https://i.imgur.com/abc.png");
  });

  it("exports the authored map document, not just the derived map", () => {
    // The snapshot alone carries compiledScene/mapTerrain/mapElements — output —
    // plus a pointer. Without the document the restore is read-only.
    const file = exportSession();

    expect(file.mapDocuments.map((doc) => doc.id)).toEqual(["live"]);
    expect(file.liveMapDocumentId).toBe("live");
    expect(file.mapDocuments[0]?.elements.map((el) => el.id).sort()).toEqual(["tile-1", "wall-1"]);
  });

  it("rejects a terrain run the import path would reject", () => {
    // Two doors onto the same sanitizer must have the same lock. This envelope
    // briefly validated documents as {id} + passthrough, on the theory that
    // importMapDocument sanitizes anyway — but sanitizing is where the cost is
    // paid: decodeTerrainChunk pushes `count` entries before checking length, so
    // a ~30-byte run of 999999999 allocates ~1e9 slots. A heap OOM aborts the
    // process rather than throwing, so the restore's try/catch cannot contain
    // it, and one process serves every room.
    const hostile = {
      mapDocuments: [
        {
          schemaVersion: 1,
          id: "evil",
          name: "evil",
          width: 100,
          height: 100,
          grid: {
            type: "square",
            size: 50,
            squareSize: 5,
            offsetX: 0,
            offsetY: 0,
            visible: true,
            snap: true,
          },
          layers: [
            {
              id: "l",
              name: "l",
              kind: "walls",
              visible: true,
              locked: false,
              opacity: 1,
              zIndex: 0,
            },
          ],
          elements: [],
          terrain: {
            schemaVersion: 1,
            palette: ["terrain:stone-floor"],
            chunks: { "0,0": [999999999, 1] },
          },
          revision: 1,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    };

    expect(validateLoadSessionEnvelope(hostile).valid).toBe(false);
  });

  it("refuses to export for a non-DM", () => {
    // The file is built from the DM's view: secret doors, hidden NPCs, GM notes.
    origin.dmWs.send.mockClear();
    origin.route({ t: "session-export" }, "some-player");

    expect(framesOf(origin.dmWs, "session-file")).toHaveLength(0);
  });

  it("restores the whole table onto a WIPED server", () => {
    const file = exportSession();

    // The wipe: everything gone — room state and every map document.
    const restored = bootServer();
    expect(restored.roomService.getState().mapElements).toBeUndefined();

    restored.route({
      t: "load-session",
      snapshot: file.snapshot as never,
      mapDocuments: file.mapDocuments,
      liveMapDocumentId: file.liveMapDocumentId,
    });

    const state = restored.roomService.getState();
    // The players' view is back: walls block, floor renders, scenery shows.
    expect(state.compiledScene?.walls.length).toBeGreaterThan(0);
    expect(state.mapElements).toBeDefined();
    // ...and the DM can still EDIT it, which is what the document buys.
    expect(state.liveMapDocumentId).toBe("live");
    expect(
      restored.mapStudioService
        .get("default", "live")
        .elements.map((el) => el.id)
        .sort(),
    ).toEqual(["tile-1", "wall-1"]);
  });

  it("keeps the restored map editable — a further edit still lands", () => {
    // The real proof that the binding is live rather than merely set: the
    // restored document has a usable revision and accepts a command.
    const file = exportSession();
    const restored = bootServer();
    restored.route({
      t: "load-session",
      snapshot: file.snapshot as never,
      mapDocuments: file.mapDocuments,
      liveMapDocumentId: file.liveMapDocumentId,
    });

    const document = restored.mapStudioService.get("default", "live");
    restored.route({
      t: "map-studio-command",
      command: {
        type: "remove-element",
        commandId: "cmd-after-restore",
        documentId: "live",
        baseRevision: document.revision,
        elementId: "tile-1",
      },
    });

    expect(restored.mapStudioService.get("default", "live").elements.map((el) => el.id)).toEqual([
      "wall-1",
    ]);
  });

  it("clears the binding rather than dangling it when a file carries no documents", () => {
    // A legacy save file (a bare snapshot). A binding to a document we do not
    // have is not inert: the DM's client auto-opens it, map-studio-get throws,
    // nothing replies, and they watch a spinner for 12 seconds.
    const file = exportSession();
    const restored = bootServer();

    restored.route({
      t: "load-session",
      snapshot: file.snapshot as never,
      mapDocuments: [],
      liveMapDocumentId: undefined,
    });

    expect(restored.roomService.getState().liveMapDocumentId).toBeUndefined();
    // The table still renders — the derived map came along in the snapshot.
    expect(restored.roomService.getState().compiledScene?.walls.length).toBeGreaterThan(0);
  });

  it("survives one unreadable document without losing the rest of the table", () => {
    const file = exportSession();
    const restored = bootServer();

    restored.route({
      t: "load-session",
      snapshot: file.snapshot as never,
      // A future/corrupt schema version — what a hand-edited or newer file looks
      // like. `as unknown as` because the literal 999 is genuinely not a valid
      // MapDocument, which is the point.
      mapDocuments: [{ ...file.mapDocuments[0]!, schemaVersion: 999 } as unknown as MapDocument],
      liveMapDocumentId: "live",
    });

    // The bad document is skipped, so the binding clears — but the room loaded.
    expect(restored.roomService.getState().liveMapDocumentId).toBeUndefined();
    expect(restored.roomService.getState().compiledScene?.walls.length).toBeGreaterThan(0);
  });
});
