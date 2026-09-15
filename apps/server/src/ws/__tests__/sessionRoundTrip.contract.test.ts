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

import path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WebSocket, WebSocketServer } from "ws";
import {
  SESSION_MINT_CEILING_BYTES,
  WS_MAX_MESSAGE_BYTES,
  loadSessionFrame,
  loadSessionFrameBytes,
  type ClientMessage,
  type MapDocument,
  type SceneState,
  type ServerMessage,
} from "@herobyte/shared";
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
import {
  MAX_SESSION_DOCUMENTS,
  validateLoadSessionEnvelope,
  validateLoadSessionMessage,
} from "../../middleware/validators/sessionValidators.js";
import { sentinelHits } from "./leakSentinels.js";

// Scratch state file: a bare `new RoomService({ stateFile: TEST_STATE_FILE })` writes the REAL
// apps/server/herobyte-state.json, which parallel workers and the dev
// server then fight over (observed: a torn file, quarantined as .corrupt).
const TEST_STATE_FILE = path.join(process.cwd(), ".tmp", "sessionRoundTrip-state.json");
const PLAYER = "some-player";
// ≥9-digit, high-entropy (plan §4.2) — never a substring of uuid/epoch soup.
const HIDDEN_NODE_SENTINEL = "ZVQXJKWPYB-export-veiled-node-557731992847";

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
  const roomService = new RoomService({ stateFile: TEST_STATE_FILE });
  roomService.setState({
    players: [player(DM, true), player(PLAYER, false)],
    tokens: [],
    pointers: [],
    sceneObjects: [],
    gridSize: 50,
    fogEnabled: false,
  });

  const dmWs = fakeSocket();
  // The attacker's socket is REGISTERED: a non-DM export addresses the
  // SENDER, and DirectMessageService silently drops a send to a uid with no
  // socket — so the old fixture could never see the leak it claimed to guard.
  const playerWs = fakeSocket();
  const uidToWs = new Map<string, WebSocket>([
    [DM, dmWs as unknown as WebSocket],
    [PLAYER, playerWs as unknown as WebSocket],
  ]);
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
    playerWs,
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
        sceneStates?: SceneState[];
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
      monsterHpDisplay: "bloodied",
      // NOT the "5e" default on purpose: the sweep below only catches a field
      // that is LOST, so a loader that hardcoded the default would pass with a
      // default-valued fixture. (A sabotage proved exactly that.)
      diagonalRule: "pathfinder",
      // Non-null for the same reason, twice over: the sweep skips a null field
      // as "had no value", and 45 is none of the presets the UI can produce.
      defaultVisionRadius: 45,
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
      // POPULATED, not empty: the sweep below skips a field whose origin value
      // is empty-ish, so `atlasNodes: []` would prove nothing (its hadValue
      // check treats [] as a value, but the spot-checks would be vacuous).
      // One discovered node with provenance, one hidden, one link, and one
      // suspended scene keyed to the exported document.
      atlasNodes: [
        {
          id: "atlas-shown",
          kind: "dungeon",
          name: "The Sunken Vault",
          discovered: true,
          mapDocumentId: "live",
          recipe: { recipeId: "dungeon", seed: 424242, theme: "stone", density: "medium" },
          createdAt: 1,
          updatedAt: 2,
        },
        {
          id: "atlas-hidden",
          kind: "settlement",
          name: "Unrevealed Town",
          discovered: false,
          createdAt: 3,
          updatedAt: 4,
        },
        // Provenance WITH a size (the shown node's literal above deliberately
        // has none — that it still compiles is the proof size is optional).
        {
          id: "atlas-sized",
          kind: "dungeon",
          name: "The Sized Warren",
          discovered: false,
          recipe: {
            recipeId: "dungeon",
            seed: 515151,
            theme: "wood",
            density: "low",
            size: "large",
          },
          arrival: { x: 7, y: 8.5, width: 5, height: 4, rotation: 0 },
          createdAt: 5,
          updatedAt: 6,
        },
      ],
      atlasLinks: [
        {
          id: "atlas-link-1",
          fromNodeId: "atlas-shown",
          toNodeId: "atlas-hidden",
          anchor: { x: 50, y: 60 },
          linkType: "stair",
          visibleToPlayers: true,
        },
      ],
      sceneStates: {
        live: {
          mapDocumentId: "live",
          suspendedAt: 99,
          tokens: [],
          props: [],
          drawings: [],
          sceneObjects: [],
          characterLinks: {},
          doorStates: { "door-1": { state: "open", authored: "closed" } },
          combatActive: true,
          currentTurnCharacterId: "char-1",
          initiatives: { "char-1": { initiative: 12 } },
          fogEnabled: true,
          defaultVisionRadius: 30,
          mapBackground: "https://i.imgur.com/suspended.png",
        },
      },
    });

    const before = origin.roomService.getState();
    const file = exportSession();
    const restored = bootServer();
    // Load through the SAME shared frame that was weighed above.
    restored.route(loadSessionFrame(file as never));
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
    expect(after.monsterHpDisplay).toBe("bloodied");
    expect(after.diagonalRule).toBe("pathfinder");
    expect(after.defaultVisionRadius).toBe(45);
    expect(after.playerStagingZone).toEqual({ x: 1, y: 2, width: 3, height: 4, rotation: 0 });
    expect(after.props).toHaveLength(1);
    expect(after.drawings).toHaveLength(1);
    expect(after.diceRolls).toHaveLength(1);
    expect(after.mapElements).toBeDefined();
    expect(after.compiledScene?.walls.length).toBeGreaterThan(0);
    expect(after.mapTerrain).toBeDefined();
    expect(after.liveMapDocumentId).toBe("live");
    // The graph rides the SNAPSHOT half (DM view, provenance included)...
    expect(after.atlasNodes.map((node) => node.id).sort()).toEqual([
      "atlas-hidden",
      "atlas-shown",
      "atlas-sized",
    ]);
    expect(after.atlasNodes.find((node) => node.id === "atlas-shown")?.recipe?.seed).toBe(424242);
    // Nested provenance fields are invisible to the top-level sweep — pin them.
    expect(after.atlasNodes.find((node) => node.id === "atlas-sized")?.recipe?.size).toBe("large");
    expect(after.atlasNodes.find((node) => node.id === "atlas-sized")?.arrival).toEqual({
      x: 7,
      y: 8.5,
      width: 5,
      height: 4,
      rotation: 0,
    });
    expect(after.atlasLinks).toHaveLength(1);
    // ...and the suspended scenes ride the ENVELOPE half, exactly once.
    expect(file.snapshot.sceneStates).toBeUndefined();
    expect(file.sceneStates).toHaveLength(1);
    expect(after.sceneStates.live?.doorStates["door-1"]).toEqual({
      state: "open",
      authored: "closed",
    });
    expect(after.sceneStates.live?.mapBackground).toBe("https://i.imgur.com/suspended.png");
  });

  it("a realistically LARGE suspended campaign survives export→import inside the wire ceiling (A7)", () => {
    // Eight fought-over places suspended at once — far past any friendly
    // game, still legitimate. The bound that matters is the ws server's
    // maxPayload (1 MiB): the load-session message must carry the whole file
    // through one frame, so the FILE gets a 90% ceiling here and the margin
    // is the message envelope's.
    //
    // K6: one of the eight is a REAL GENERATED BUILDING, cashed through the
    // real generate path at the largest preset a kick can ask for. The other
    // seven documents are empty shells, so before this the ceiling was
    // measured against scene payloads alone and said nothing about the
    // document a kicked-in door actually mints — which is the biggest thing
    // in the file.
    //
    // ONE such document is what this test weighs, and one is all it proves.
    // It is NOT evidence that a real campaign's export fits: see the
    // characterization test below, which shows a room well inside every cap
    // minting a file that cannot be loaded back.
    const fatScene = (documentId: string): SceneState => ({
      mapDocumentId: documentId,
      suspendedAt: 7,
      tokens: Array.from({ length: 30 }, (_, i) => ({
        id: `${documentId}-token-${i}`,
        owner: `player-${i % 6}`,
        x: i * 2,
        y: i * 3,
        color: "#a0b1c2",
      })) as SceneState["tokens"],
      props: [],
      drawings: Array.from({ length: 20 }, (_, i) => ({
        id: `${documentId}-draw-${i}`,
        type: "freehand" as const,
        points: Array.from({ length: 50 }, (_, p) => ({ x: p * 3.5, y: p * 2.25 })),
        color: "#ffffff",
        width: 2,
        opacity: 1,
      })) as unknown as SceneState["drawings"],
      sceneObjects: [],
      characterLinks: Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [`char-${i}`, `${documentId}-token-${i}`]),
      ),
      doorStates: Object.fromEntries(
        Array.from({ length: 40 }, (_, i) => [
          `door-${i}`,
          { state: "open" as const, authored: "closed" as const },
        ]),
      ),
      combatActive: true,
      currentTurnCharacterId: "char-3",
      initiatives: Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [`char-${i}`, { initiative: 20 - i }]),
      ),
      fogEnabled: true,
      defaultVisionRadius: 30,
    });
    // The scenes must key REAL documents — the loader deliberately drops a
    // scene whose document is not in the file (the ghost-scene degrade).
    for (let i = 1; i < 8; i++) {
      origin.route({
        t: "map-studio-create",
        document: { id: `suspended-doc-${i}`, name: `Suspended ${i}` },
      });
    }
    origin.route({
      t: "atlas-create-node",
      node: { id: "the-warehouse", kind: "building", name: "The Salt Hound" },
    });
    origin.route({
      t: "atlas-generate-node",
      nodeId: "the-warehouse",
      commandId: "gen-warehouse",
      seed: 12345,
      recipe: { recipeId: "building", kind: "warehouse", size: "large" },
    });
    const buildingDocId = origin.roomService
      .getState()
      .atlasNodes.find((node) => node.id === "the-warehouse")!.mapDocumentId!;
    // Guard the guard: a generate that silently failed would leave an empty
    // shell here and the ceiling would pass while measuring nothing.
    expect(origin.mapStudioService.get("default", buildingDocId).elements.length).toBeGreaterThan(
      50,
    );

    const suspended = [
      buildingDocId,
      ...Array.from({ length: 7 }, (_, i) => `suspended-doc-${i + 1}`),
    ];
    origin.roomService.setState({
      sceneStates: Object.fromEntries(suspended.map((id) => [id, fatScene(id)])),
    });

    const file = exportSession();
    // Weigh the FRAME the client actually sends, not the file: `load-session`
    // must cross the socket in one message, and ws checks the declared frame
    // length. The SHARED builder is what `useSessionManagement.ts` sends and
    // what the mint ceiling weighs — one shape, three sites.
    const frameBytes = loadSessionFrameBytes(file as never);
    expect(file.sceneStates).toHaveLength(8);
    expect(frameBytes).toBeLessThan(WS_MAX_MESSAGE_BYTES * 0.9);

    const restored = bootServer();
    // Load through the SAME shared frame that was weighed above.
    restored.route(loadSessionFrame(file as never));
    const after = restored.roomService.getState();
    expect(Object.keys(after.sceneStates)).toHaveLength(8);
    // Deep content survives, not just the keys.
    expect(after.sceneStates["suspended-doc-3"]?.tokens).toHaveLength(30);
    expect(after.sceneStates["suspended-doc-3"]?.drawings[5]?.points).toHaveLength(50);
    expect(after.sceneStates["suspended-doc-7"]?.doorStates["door-39"]).toEqual({
      state: "open",
      authored: "closed",
    });
    expect(after.sceneStates[buildingDocId]?.initiatives["char-11"]).toEqual({
      initiative: 9,
    });
    // ...and the building came back as a building, not an empty shell.
    expect(restored.mapStudioService.get("default", buildingDocId).elements.length).toBeGreaterThan(
      50,
    );
  });

  it("the mint path refuses the building that would overflow — and a table at the ceiling exports a file that loads back onto a wiped server in one frame", () => {
    // Until 2026-09-14 this test CHARACTERIZED A KNOWN GAP: six `large`
    // buildings, well under the document COUNT cap (64), wrote a frame the
    // socket dropped with a 1009 close no handler ever saw — 1 MiB / 64 only
    // holds if the average document is under 16 KB, and a large building is
    // 207–235 KB. The mint path now weighs BYTES (the Weighed Campaign plan):
    // every mint is refused once the export it would write outweighs
    // SESSION_MINT_CEILING_BYTES. The count cap still holds beside it.
    const attempted = 6;
    for (let i = 0; i < attempted; i++) {
      origin.route({
        t: "atlas-create-node",
        node: { id: `n-${i}`, kind: "building", name: `Warehouse ${i}` },
      });
      origin.route({
        t: "atlas-generate-node",
        nodeId: `n-${i}`,
        commandId: `gen-${i}`,
        seed: 1000 + i,
        recipe: { recipeId: "building", kind: "warehouse", size: "large" },
      });
    }

    const documents = origin.mapStudioService.list("default");
    const buildings = documents.filter((entry) => entry.id !== "live");
    // Some minted, then refused — never all six, never none.
    expect(buildings.length).toBeGreaterThanOrEqual(2);
    expect(buildings.length).toBeLessThan(attempted);
    expect(documents.length).toBeLessThan(MAX_SESSION_DOCUMENTS);
    // Guard the guard: real maps, not empty shells.
    for (const document of buildings) {
      expect(document.elements.length).toBeGreaterThan(50);
    }
    const refusals = framesOf(origin.dmWs, "atlas-error") as unknown as {
      code: string;
      reason: string;
    }[];
    expect(refusals).toHaveLength(attempted - buildings.length);
    for (const refusal of refusals) {
      expect(refusal.code).toBe("at-cap");
      expect(refusal.reason).toMatch(/\d\.\d\d MB/);
    }
    // A refused node stays a promise: no document, no provenance.
    const mapped = origin.roomService.getState().atlasNodes.filter((node) => node.mapDocumentId);
    expect(mapped).toHaveLength(buildings.length);

    const file = exportSession();
    const frameBytes = loadSessionFrameBytes(file as never);
    // Under the wire limit — the promise — and at or about the ceiling (the
    // promise nodes created AFTER the last accepted mint add a few bytes).
    expect(frameBytes).toBeLessThan(WS_MAX_MESSAGE_BYTES);
    expect(frameBytes).toBeLessThan(SESSION_MINT_CEILING_BYTES + 4096);
    // The refusal's own number carries the SCENE the travel would install, not
    // the document alone: a large warehouse is 161–227 KB of document and
    // 104–147 KB of scene (seeds 1000–1005), so the reported weight sits
    // 250–400 KB above the export that was actually written — a weigh that
    // dropped the scene would sit under 230 KB above it.
    const reported = Number(/about (\d+\.\d\d) MB/.exec(refusals[0]!.reason)![1]) * 1024 * 1024;
    expect(reported - frameBytes).toBeGreaterThan(250_000);
    expect(reported - frameBytes).toBeLessThan(400_000);

    const restored = bootServer();
    restored.route(loadSessionFrame(file as never));
    expect(restored.mapStudioService.list("default")).toHaveLength(documents.length);
    for (const document of buildings) {
      expect(restored.mapStudioService.get("default", document.id).elements).toHaveLength(
        document.elements.length,
      );
    }
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
    // ...both halves of it: the envelope schema (documents + suspended scenes)
    // must accept the real export's shape too, or every atlas-era save is
    // rejected at re-upload.
    origin.roomService.getState().sceneStates.live = {
      mapDocumentId: "live",
      suspendedAt: 1,
      tokens: [],
      props: [],
      drawings: [],
      sceneObjects: [],
      characterLinks: {},
      doorStates: {},
      combatActive: false,
      initiatives: {},
      fogEnabled: false,
      defaultVisionRadius: null,
    };
    const withScenes = exportSession();
    expect(withScenes.sceneStates).toHaveLength(1);
    expect(
      validateLoadSessionEnvelope({
        mapDocuments: withScenes.mapDocuments,
        liveMapDocumentId: withScenes.liveMapDocumentId,
        sceneStates: withScenes.sceneStates,
      } as never).valid,
    ).toBe(true);
  });

  it("skips a malformed suspended scene at export instead of writing an unimportable file", () => {
    // The disk path is record-shallow while the reimport envelope is
    // zod-shaped: a poisoned scene in the state file would otherwise ride
    // into the export and make the DM's own backup fail its reimport.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const state = origin.roomService.getState();
      state.sceneStates.live = {
        mapDocumentId: "live",
        suspendedAt: 1,
        tokens: [],
        props: [],
        drawings: [],
        sceneObjects: [],
        characterLinks: {},
        doorStates: {},
        combatActive: false,
        initiatives: {},
        fogEnabled: false,
        defaultVisionRadius: null,
      };
      state.sceneStates.poisoned = { foo: 1 } as never;
      // The shape the first filter let through: a name, nothing else — the
      // reimport envelope requires every collection.
      state.sceneStates.half = { mapDocumentId: "live" } as never;

      const file = exportSession();
      expect(file.sceneStates?.map((scene) => scene.mapDocumentId)).toEqual(["live"]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("malformed suspended scene"));
      expect(validateLoadSessionEnvelope({ sceneStates: file.sceneStates } as never).valid).toBe(
        true,
      );
    } finally {
      warn.mockRestore();
    }
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

  it("refuses to export for a non-DM — asserted on the ATTACKER's socket, where the file would land", () => {
    // The file is the arc's largest secrecy payload: the DM-view snapshot with
    // the full atlas (seeds included) plus every suspended scene. The old
    // version of this test watched the DM's socket, which a gate-deleted
    // export never addresses — the arc's final review called it vacuous.
    origin.roomService.setState({
      atlasNodes: [
        {
          id: "veiled",
          kind: "dungeon",
          name: HIDDEN_NODE_SENTINEL,
          discovered: false,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    origin.dmWs.send.mockClear();
    origin.playerWs.send.mockClear();
    origin.route({ t: "session-export" }, PLAYER);

    expect(framesOf(origin.playerWs, "session-file")).toHaveLength(0);
    expect(sentinelHits(origin.playerWs, HIDDEN_NODE_SENTINEL)).toEqual([]);
    expect(framesOf(origin.dmWs, "session-file")).toHaveLength(0);
  });

  it("refuses a load that would leave the table past MAX_SESSION_DOCUMENTS — before anything mutates", () => {
    // The file's documents UPSERT into the room's; a disjoint backup onto a
    // busy table crossed the ceiling in one click and wrote an unloadable
    // export. Same throw-shaped refusal as map-studio-create's.
    const file = exportSession();
    const restored = bootServer();
    for (let index = 0; index < MAX_SESSION_DOCUMENTS; index += 1) {
      restored.mapStudioService.create("default", { id: `busy-${index}`, name: `busy ${index}` });
    }
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      restored.route({
        t: "load-session",
        snapshot: file.snapshot as never,
        mapDocuments: file.mapDocuments,
        liveMapDocumentId: file.liveMapDocumentId,
      });
      expect(errorLog).toHaveBeenCalled();
    } finally {
      errorLog.mockRestore();
    }
    // Nothing landed: no new document, no binding, no snapshot merge.
    expect(restored.mapStudioService.list("default")).toHaveLength(MAX_SESSION_DOCUMENTS);
    expect(restored.roomService.getState().liveMapDocumentId).toBeUndefined();
    expect(restored.roomService.getState().compiledScene).toBeUndefined();
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

  it("never writes whispers into the exported file", () => {
    // A session file exists to be handed to other people, and export builds it
    // with toSnapshot(state, true, senderUid) — a REAL recipient uid — so the
    // exporting DM's own whispers pass the per-recipient filter. The table
    // FORK path is safe by construction (createSnapshot(), no uid); export is
    // not, so it strips them explicitly.
    origin.roomService.getState().chatLog.push(
      { id: "c1", authorUid: DM, authorName: DM, text: "everyone hears this", timestamp: 1 },
      {
        id: "c2",
        authorUid: DM,
        authorName: DM,
        text: "PRIVATE-ASIDE",
        to: "player-1",
        timestamp: 2,
      },
      {
        id: "c3",
        authorUid: "player-1",
        authorName: "p1",
        text: "REPLY-ASIDE",
        to: DM,
        timestamp: 3,
      },
    );

    const file = exportSession();

    const texts = ((file.snapshot.chatLog ?? []) as Array<{ text: string }>).map((m) => m.text);
    expect(texts).toContain("everyone hears this");
    expect(texts).not.toContain("PRIVATE-ASIDE");
    expect(texts).not.toContain("REPLY-ASIDE");
    // And not anywhere else in the serialized file either.
    expect(JSON.stringify(file)).not.toContain("ASIDE");
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

  it("loads an atlas-FREE file as an EMPTY atlas, even over a room that had one", () => {
    // THE FILE IS AUTHORITATIVE (the mapElements lesson, applied forward):
    // "preserved" compiles, and the sweep can't see it — but it bleeds campaign
    // A's graph and, via document-id reuse, its suspended scenes into campaign B.
    const file = exportSession(); // pre-atlas-shaped: origin has no atlas here

    const restored = bootServer();
    restored.roomService.setState({
      atlasNodes: [
        {
          id: "stale",
          kind: "dungeon",
          name: "Should Not Survive",
          discovered: true,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      atlasLinks: [],
      sceneStates: {
        live: {
          mapDocumentId: "live",
          suspendedAt: 1,
          tokens: [],
          props: [],
          drawings: [],
          sceneObjects: [],
          characterLinks: {},
          doorStates: {},
          combatActive: false,
          initiatives: {},
          fogEnabled: false,
          defaultVisionRadius: null,
        },
      },
    });

    restored.route({
      t: "load-session",
      snapshot: file.snapshot as never,
      mapDocuments: file.mapDocuments,
      liveMapDocumentId: file.liveMapDocumentId,
    });

    const state = restored.roomService.getState();
    expect(state.atlasNodes).toEqual([]);
    expect(state.atlasLinks).toEqual([]);
    expect(state.sceneStates).toEqual({});
  });

  it("drops a suspended scene whose document did not restore, instead of arming an id-reuse bomb", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const file = exportSession();
      const restored = bootServer();
      restored.route({
        t: "load-session",
        snapshot: file.snapshot as never,
        mapDocuments: file.mapDocuments,
        liveMapDocumentId: file.liveMapDocumentId,
        sceneStates: [
          {
            mapDocumentId: "ghost-doc",
            suspendedAt: 1,
            tokens: [],
            props: [],
            drawings: [],
            sceneObjects: [],
            characterLinks: {},
            doorStates: {},
            combatActive: false,
            initiatives: {},
            fogEnabled: false,
            defaultVisionRadius: null,
          },
        ],
      });

      expect(restored.roomService.getState().sceneStates).toEqual({});
    } finally {
      warn.mockRestore();
    }
  });

  it("degrades a mapped node to a promise when the file carries no such document", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const file = exportSession();
      const snapshotWithGhostNode = {
        ...file.snapshot,
        atlasNodes: [
          {
            id: "ghost-mapped",
            kind: "dungeon",
            name: "Ghost Dungeon",
            discovered: false,
            mapDocumentId: "ghost-doc",
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      };

      const restored = bootServer();
      restored.route({
        t: "load-session",
        snapshot: snapshotWithGhostNode as never,
        mapDocuments: file.mapDocuments,
        liveMapDocumentId: file.liveMapDocumentId,
      });

      const node = restored.roomService.getState().atlasNodes[0];
      // The node SURVIVES (its name and place in the tree are real work) but
      // its map degrades back to a promise — the liveMapDocumentId precedent,
      // instead of a 12s open-timeout on the first travel.
      expect(node?.id).toBe("ghost-mapped");
      expect(node?.mapDocumentId).toBeUndefined();
    } finally {
      warn.mockRestore();
    }
  });
});
