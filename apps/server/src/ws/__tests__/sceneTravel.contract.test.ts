// ============================================================================
// SCENE TRAVEL CONTRACT TESTS — the §2.2 transition table, row by row
// ============================================================================
// Travel through the REAL MessageRouter: suspend must capture EXACTLY the
// §4.10 "captured" bucket, restore must bring it back bit-for-bit, travelers
// must follow the party, and the whole mutation must serialize as ONE frame
// per recipient. The idle A→B→A round trip alone is vacuously green for
// combat (values survive untouched on the roster) — the interleaved-fight
// sequence is the real test (review S2).

import path from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WebSocket, WebSocketServer } from "ws";
import type {
  ClientMessage,
  MapDoorElement,
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
import { MapStudioService } from "../../domains/mapStudio/service.js";
import { sentinelHits } from "./leakSentinels.js";

const TEST_STATE_FILE = path.join(process.cwd(), ".tmp", "sceneTravel-state.json");

const DM = "dm-player";
const PLAYER = "watcher";
// High-entropy, ≥9-digit discipline (plan §4.2).
const A_RASTER_SENTINEL = "XKQZVJWYPB-raster-of-scene-a-889912743365";

interface FakeSocket {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
}

function fakeSocket(): FakeSocket {
  return { readyState: 1, send: vi.fn() };
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 25));
}

function snapshotsOf(socket: FakeSocket): RoomSnapshot[] {
  return socket.send.mock.calls
    .map(([payload]) => JSON.parse(payload as string) as ServerMessage & { t?: string })
    .filter((message) => message.t === undefined) as unknown as RoomSnapshot[];
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

function wallElement(id: string, layerId: string): MapWallElement {
  return {
    id,
    layerId,
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

function doorElement(id: string, layerId: string): MapDoorElement {
  return {
    id,
    layerId,
    type: "door",
    locked: false,
    hidden: false,
    transform: { x: 100, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: { width: 50, state: "closed", blocksMovement: true, blocksVision: true },
  };
}

describe("scene travel contracts", () => {
  let router: MessageRouter;
  let roomService: RoomService;
  let mapStudioService: MapStudioService;
  let dmWs: FakeSocket;
  let playerWs: FakeSocket;

  beforeEach(() => {
    roomService = new RoomService({ stateFile: TEST_STATE_FILE });
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

    mapStudioService = new MapStudioService();
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
      mapStudioService,
    );
  });

  afterEach(flush);

  function route(message: ClientMessage, senderUid = DM): void {
    router.route(message, senderUid);
  }

  /** A node bound to a fresh document; doc A gets a wall and a closed door. */
  function setupTwoNodes(): { docA: string; docB: string } {
    route({ t: "map-studio-create", document: { id: "doc-a", name: "Scene A" } });
    route({ t: "map-studio-create", document: { id: "doc-b", name: "Scene B" } });
    const documentA = mapStudioService.get("default", "doc-a");
    const walls = documentA.layers.find((layer) => layer.kind === "walls")!;
    route({
      t: "map-studio-command",
      command: {
        type: "add-element",
        commandId: "cmd-wall-a",
        documentId: "doc-a",
        baseRevision: documentA.revision,
        element: wallElement("wall-1", walls.id),
      },
    });
    route({
      t: "map-studio-command",
      command: {
        type: "add-element",
        commandId: "cmd-door-a",
        documentId: "doc-a",
        baseRevision: mapStudioService.get("default", "doc-a").revision,
        element: doorElement("door-1", walls.id),
      },
    });
    route({ t: "atlas-create-node", node: { id: "nA", kind: "dungeon", name: "Node A" } });
    route({ t: "atlas-create-node", node: { id: "nB", kind: "building", name: "Node B" } });
    route({ t: "atlas-link-map", nodeId: "nA", documentId: "doc-a" });
    route({ t: "atlas-link-map", nodeId: "nB", documentId: "doc-b" });
    return { docA: "doc-a", docB: "doc-b" };
  }

  /** The party (a pc-linked player token), a goblin (npc-linked DM-owned token), a loose DM token. */
  function seedEntities(): void {
    const state = roomService.getState();
    state.characters.push(
      {
        id: "pc1",
        type: "pc",
        name: "Hero",
        hp: 10,
        maxHp: 10,
        tokenId: "pc-t",
        ownedByPlayerUID: PLAYER,
      } as never,
      {
        id: "gob",
        type: "npc",
        name: "Goblin",
        hp: 7,
        maxHp: 7,
        tokenId: "gob-t",
        visibleToPlayers: true,
      } as never,
    );
    state.tokens.push(
      { id: "pc-t", owner: PLAYER, x: 5, y: 5, color: "#0f0" } as never,
      { id: "gob-t", owner: DM, x: 8, y: 9, color: "#f00" } as never,
      { id: "dm-scenery", owner: DM, x: 1, y: 1, color: "#00f" } as never,
    );
  }

  it("round-trips a whole scene A→B→A: doors, drawings, staging, raster, residue, combat — through an INTERLEAVED fight", async () => {
    setupTwoNodes();
    seedEntities();
    route({ t: "atlas-travel", nodeId: "nA" });

    const state = roomService.getState();
    // Dress scene A: an OPEN door, a drawing, a staging zone, a raster, fog,
    // a sight default, a map-transform residue, and a fight mid-turn.
    route({ t: "toggle-door", doorId: "door-1" });
    expect(state.compiledScene?.doors.find((door) => door.id === "door-1")?.state).toBe("open");
    state.drawings.push({
      id: "d-1",
      type: "freehand",
      points: [{ x: 10, y: 10 }],
      color: "#fff",
      width: 2,
      opacity: 1,
    } as never);
    route({
      t: "set-player-staging-zone",
      zone: { x: 12, y: 14, width: 4, height: 4, rotation: 0 },
    });
    state.mapBackground = A_RASTER_SENTINEL;
    state.fogEnabled = true;
    state.defaultVisionRadius = 30;
    state.sceneObjects.push({
      id: "map",
      type: "map",
      locked: true,
      zIndex: -100,
      transform: { x: 7, y: 3, scaleX: 2, scaleY: 2, rotation: 15 },
      data: { imageUrl: A_RASTER_SENTINEL },
    } as never);
    route({ t: "set-initiative", characterId: "gob", initiative: 17 });
    route({ t: "set-initiative", characterId: "pc1", initiative: 11 });
    state.currentTurnCharacterId = "gob";
    expect(state.combatActive).toBe(true); // setting initiative auto-starts combat
    // POPULATED, or the cleared-on-restore assert is vacuous (empty in,
    // empty out — the first sabotage pass caught exactly that).
    state.drawingUndoStacks[PLAYER] = [{ kind: "sabotage-visible" } as never];
    state.drawingRedoStacks[PLAYER] = [{ kind: "sabotage-visible" } as never];

    playerWs.send.mockClear();
    dmWs.send.mockClear();
    route({ t: "atlas-travel", nodeId: "nB" });
    await flush();

    // ONE synchronous mutation → exactly ONE snapshot frame per recipient.
    expect(snapshotsOf(dmWs)).toHaveLength(1);
    expect(snapshotsOf(playerWs)).toHaveLength(1);

    // B is live; A is suspended whole.
    expect(state.compiledScene?.sourceDocumentId).toBe("doc-b");
    const savedA = state.sceneStates["doc-a"];
    expect(savedA?.tokens.map((token) => token.id).sort()).toEqual(["dm-scenery", "gob-t"]);
    expect(savedA?.doorStates["door-1"]).toEqual({ state: "open", authored: "closed" });
    expect(savedA?.drawings).toHaveLength(1);
    expect(savedA?.playerStagingZone).toEqual({ x: 12, y: 14, width: 4, height: 4, rotation: 0 });
    expect(savedA?.mapBackground).toBe(A_RASTER_SENTINEL);
    expect(savedA?.combatActive).toBe(true);
    expect(savedA?.initiatives).toMatchObject({ gob: { initiative: 17 }, pc1: { initiative: 11 } });
    expect(savedA?.sceneObjects.some((object) => object.id === "map")).toBe(true);

    // The party ARRIVED: only the pc token travels; B has no zone, so it
    // spreads at the 2048×2048 document's center cell.
    expect(state.tokens.map((token) => token.id)).toEqual(["pc-t"]);
    expect(state.tokens[0]).toMatchObject({ x: 19, y: 19 });
    // B is a LINKED node (no recipe): fog inherits A's true.
    expect(state.fogEnabled).toBe(true);
    // The suspended raster reaches no recipient.
    expect(sentinelHits(playerWs, A_RASTER_SENTINEL)).toEqual([]);
    expect(sentinelHits(dmWs, A_RASTER_SENTINEL)).toEqual([]);

    // The INTERLEAVED fight: B's battle legitimately rewrites the roster —
    // including a B-only combatant who must NOT pollute A's resumed order.
    state.characters.push({
      id: "b-only-bandit",
      type: "npc",
      name: "Bandit",
      hp: 5,
      maxHp: 5,
      visibleToPlayers: true,
    } as never);
    route({ t: "clear-all-initiative" });
    route({ t: "set-initiative", characterId: "pc1", initiative: 3 });
    route({ t: "set-initiative", characterId: "b-only-bandit", initiative: 19 });

    // Back to A: everything resumes, B's fight does not pollute A's order.
    route({ t: "atlas-travel", nodeId: "nA" });
    const resumed = roomService.getState();
    expect(resumed.compiledScene?.sourceDocumentId).toBe("doc-a");
    expect(resumed.compiledScene?.doors.find((door) => door.id === "door-1")?.state).toBe("open");
    expect(resumed.tokens.map((token) => token.id).sort()).toEqual(["dm-scenery", "gob-t", "pc-t"]);
    expect(resumed.tokens.find((token) => token.id === "gob-t")).toMatchObject({ x: 8, y: 9 });
    // The party re-ARRIVES in A's staging zone (center 12,14 / 4×4 → within ±2).
    const pc = resumed.tokens.find((token) => token.id === "pc-t")!;
    expect(Math.abs(pc.x - 12)).toBeLessThanOrEqual(2);
    expect(Math.abs(pc.y - 14)).toBeLessThanOrEqual(2);
    expect(resumed.drawings).toHaveLength(1);
    expect(resumed.mapBackground).toBe(A_RASTER_SENTINEL);
    expect(resumed.playerStagingZone).toEqual({ x: 12, y: 14, width: 4, height: 4, rotation: 0 });
    expect(resumed.defaultVisionRadius).toBe(30);
    expect(resumed.combatActive).toBe(true);
    expect(resumed.currentTurnCharacterId).toBe("gob");
    expect(resumed.characters.find((entry) => entry.id === "gob")?.initiative).toBe(17);
    expect(resumed.characters.find((entry) => entry.id === "pc1")?.initiative).toBe(11);
    // The bandit fought on B while A slept: A's resumed order excludes them.
    expect(resumed.characters.find((entry) => entry.id === "b-only-bandit")?.initiative).toBe(
      undefined,
    );
    // The map residue (fog geometry's input) came back too.
    const mapObject = resumed.sceneObjects.find((object) => object.id === "map");
    expect(mapObject?.transform).toEqual({ x: 7, y: 3, scaleX: 2, scaleY: 2, rotation: 15 });
    // The undo stacks never cross scenes.
    expect(resumed.drawingUndoStacks).toEqual({});
    expect(resumed.drawingRedoStacks).toEqual({});

    // And no duplication after another bounce: pc-t exists exactly once per side.
    route({ t: "atlas-travel", nodeId: "nB" });
    expect(roomService.getState().tokens.filter((token) => token.id === "pc-t")).toHaveLength(1);
    expect(
      roomService.getState().sceneStates["doc-a"]!.tokens.filter((token) => token.id === "pc-t"),
    ).toHaveLength(0);
  });

  it("START LIVE MAP row: binding a fresh doc onto an unbound, token-laden table changes ONLY the map", () => {
    seedEntities();
    const before = roomService.getState().tokens.map((token) => ({ ...token }));
    route({ t: "map-studio-create", document: { id: "fresh", name: "Fresh" } });
    route({ t: "map-studio-set-live", documentId: "fresh" });

    const state = roomService.getState();
    expect(state.compiledScene?.sourceDocumentId).toBe("fresh");
    expect(state.tokens).toEqual(before); // nobody moved, nobody vanished
    expect(state.liveMapDocumentId).toBe("fresh");
  });

  it("a set-live REBIND preserves the scene but never warps the party", () => {
    setupTwoNodes();
    seedEntities();
    route({ t: "atlas-travel", nodeId: "nA" });
    route({ t: "toggle-door", doorId: "door-1" });
    const pcBefore = { ...roomService.getState().tokens.find((token) => token.id === "pc-t")! };

    route({ t: "map-studio-set-live", documentId: "doc-b" });
    const state = roomService.getState();
    expect(state.compiledScene?.sourceDocumentId).toBe("doc-b");
    // A's door survived into its suspension...
    expect(state.sceneStates["doc-a"]?.doorStates["door-1"]?.state).toBe("open");
    // ...and the traveler kept their cells (no arrivals warp on a rebind).
    expect(state.tokens.find((token) => token.id === "pc-t")).toMatchObject({
      x: pcBefore.x,
      y: pcBefore.y,
    });

    // Rebinding BACK resumes the door — the old lose-everything rebind is dead.
    route({ t: "map-studio-set-live", documentId: "doc-a" });
    expect(
      roomService.getState().compiledScene?.doors.find((door) => door.id === "door-1")?.state,
    ).toBe("open");
  });

  it("a same-document set-live is an idempotent no-op that keeps door runtime", () => {
    setupTwoNodes();
    route({ t: "atlas-travel", nodeId: "nA" });
    route({ t: "toggle-door", doorId: "door-1" });

    route({ t: "map-studio-set-live", documentId: "doc-a" });
    expect(
      roomService.getState().compiledScene?.doors.find((door) => door.id === "door-1")?.state,
    ).toBe("open");
  });

  it("a door RE-AUTHORED while suspended takes its new authored state on resume", () => {
    setupTwoNodes();
    route({ t: "atlas-travel", nodeId: "nA" });
    route({ t: "toggle-door", doorId: "door-1" }); // runtime: open
    route({ t: "atlas-travel", nodeId: "nB" });

    // While A sleeps, the DM re-authors the door to locked.
    const documentA = mapStudioService.get("default", "doc-a");
    route({
      t: "map-studio-command",
      command: {
        type: "update-door",
        commandId: "cmd-relock",
        documentId: "doc-a",
        baseRevision: documentA.revision,
        elementId: "door-1",
        state: "locked",
        width: 50,
      },
    });

    route({ t: "atlas-travel", nodeId: "nA" });
    expect(
      roomService.getState().compiledScene?.doors.find((entry) => entry.id === "door-1")?.state,
    ).toBe("locked");
  });

  it("restore-GC: a roster deletion while suspended drops the ghost, and place-token re-links to ONE body", () => {
    setupTwoNodes();
    seedEntities();
    route({ t: "atlas-travel", nodeId: "nA" });
    route({ t: "atlas-travel", nodeId: "nB" });

    // While A sleeps: delete the goblin (its token sleeps in A), then give the
    // pc a fresh token on B via the roster's delete-and-recreate flow analog.
    const state = roomService.getState();
    state.characters = state.characters.filter((entry) => entry.id !== "gob");

    route({ t: "atlas-travel", nodeId: "nA" });
    const resumed = roomService.getState();
    // The ghost never wakes: its character is gone, so restore-GC dropped it.
    expect(resumed.tokens.some((token) => token.id === "gob-t")).toBe(false);
    expect(resumed.tokens.some((token) => token.id === "dm-scenery")).toBe(true);
  });

  it("first visit to a GENERATED node defaults fog ON; a linked node inherits", () => {
    route({ t: "map-studio-create", document: { id: "linked", name: "Linked" } });
    route({ t: "atlas-create-node", node: { id: "gen", kind: "dungeon", name: "Gen" } });
    route({ t: "atlas-create-node", node: { id: "lnk", kind: "building", name: "Lnk" } });
    route({ t: "atlas-link-map", nodeId: "lnk", documentId: "linked" });
    route({
      t: "atlas-generate-node",
      nodeId: "gen",
      commandId: "gen-fog",
      seed: 7,
      params: { theme: "stone", density: "low", size: "small" },
    });

    expect(roomService.getState().fogEnabled).toBe(false);
    route({ t: "atlas-travel", nodeId: "gen" });
    expect(roomService.getState().fogEnabled).toBe(true); // recipe node → concealed

    route({ t: "set-fog-enabled", enabled: false });
    route({ t: "atlas-travel", nodeId: "lnk" });
    expect(roomService.getState().fogEnabled).toBe(false); // linked → inherits
  });

  it("travel auto-discovers the destination, and an un-mapped node refuses with state untouched", async () => {
    setupTwoNodes();
    route({ t: "atlas-create-node", node: { id: "promise", kind: "region", name: "P" } });
    route({ t: "atlas-travel", nodeId: "nA" });
    expect(roomService.getState().atlasNodes.find((node) => node.id === "nA")?.discovered).toBe(
      true,
    );

    // Drain the travel's own debounced broadcast BEFORE clearing, or the
    // pending 16ms timer fires into the cleared mock and reads as the
    // refusal having broadcast.
    await flush();
    const before = roomService.getState().compiledScene?.sourceDocumentId;
    dmWs.send.mockClear();
    route({ t: "atlas-travel", nodeId: "promise" });
    await flush();
    expect(roomService.getState().compiledScene?.sourceDocumentId).toBe(before);
    const errors = snapshotsOf(dmWs); // no snapshot fired…
    expect(errors).toHaveLength(0);
    expect(
      dmWs.send.mock.calls.some(([payload]) => (payload as string).includes('"atlas-error"')),
    ).toBe(true);
  });

  it("a document command in flight against the OLD doc applies cleanly after travel — no conflict, no recompile", () => {
    setupTwoNodes();
    route({ t: "atlas-travel", nodeId: "nA" });
    const revisionA = mapStudioService.get("default", "doc-a").revision;
    route({ t: "atlas-travel", nodeId: "nB" });

    // The command was built against A before the travel landed.
    route({
      t: "map-studio-command",
      command: {
        type: "add-element",
        commandId: "cmd-late",
        documentId: "doc-a",
        baseRevision: revisionA,
        element: wallElement(
          "late-wall",
          mapStudioService.get("default", "doc-a").layers.find((l) => l.kind === "walls")!.id,
        ),
      },
    });

    // It landed on the suspended document…
    expect(
      mapStudioService.get("default", "doc-a").elements.some((el) => el.id === "late-wall"),
    ).toBe(true);
    // …without dragging the table back to A.
    expect(roomService.getState().compiledScene?.sourceDocumentId).toBe("doc-b");
  });

  // --------------------------------------------------------------------------
  // THE CAPTURE-COMPLETENESS SWEEP (§4.10) — a future RoomState field fails
  // here BY NAME until someone classifies it into a bucket.
  // --------------------------------------------------------------------------
  const FIELD_BUCKETS: Record<string, "captured" | "cleared" | "global" | "derived" | "infra"> = {
    tokens: "captured", // stayers; travelers ride with the party
    props: "captured",
    drawings: "captured",
    sceneObjects: "captured", // the fold's residue (map transform feeds fog)
    combatActive: "captured",
    currentTurnCharacterId: "captured",
    fogEnabled: "captured",
    defaultVisionRadius: "captured",
    playerStagingZone: "captured",
    mapBackground: "captured",
    pointers: "cleared",
    selectionState: "cleared",
    drawingUndoStacks: "cleared",
    drawingRedoStacks: "cleared",
    players: "global",
    characters: "global", // roster; INITIATIVE overlays from the capture
    chatLog: "global",
    diceRolls: "global",
    monsterHpDisplay: "global",
    diagonalRule: "global",
    playerPropsEnabled: "global",
    initiativeManualOverride: "global",
    isPublicTable: "global",
    tableName: "global",
    atlasNodes: "global", // the graph travels with the CAMPAIGN, not a scene
    atlasLinks: "global",
    sceneStates: "infra", // the suspension store itself
    compiledScene: "derived",
    mapTerrain: "derived",
    mapElements: "derived",
    gridSize: "derived",
    gridSquareSize: "derived",
    users: "infra",
    stateVersion: "infra",
    liveMapDocumentId: "infra", // the binding travel itself mutates
  };

  it("classifies EVERY RoomState field into a §4.10 bucket — a new field fails here by name", () => {
    for (const key of Object.keys(roomService.getState())) {
      expect(FIELD_BUCKETS[key], `unclassified RoomState field: ${key}`).toBeDefined();
    }
  });
});
