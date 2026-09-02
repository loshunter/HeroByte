// ============================================================================
// ATLAS GRAPH CONTRACT TESTS
// ============================================================================
// The campaign graph's CRUD through the REAL MessageRouter and real fake
// sockets — a directly-constructed handler stays green when route() never
// reaches it (the unhandled-message-acks-success failure), so every type is
// proven reachable here via route().
//
// Sentinel discipline (plan §4.2): atlas frames are uuid-dense and can carry
// base64, so sentinels are ≥9-digit numbers outside any coordinate range and
// high-entropy name strings — a 4-digit sentinel WILL collide with a random
// uuid eventually (CI #828's clock collision, inverted).

import path from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WebSocket, WebSocketServer } from "ws";
import {
  ATLAS_LIMITS,
  type AtlasNode,
  type ClientMessage,
  type RoomSnapshot,
  type SceneState,
  type ServerMessage,
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
import { SNAPSHOT_LIMITS } from "../../middleware/validators/sessionValidators.js";
import { AtlasMessageHandler, ATLAS_DM_REQUIRED } from "../handlers/AtlasMessageHandler.js";
import { sentinelHits } from "./leakSentinels.js";

const TEST_STATE_FILE = path.join(process.cwd(), ".tmp", "atlasGraph-state.json");

const DM = "dm-player";
const PLAYER = "watcher";

// ≥9 digits, far outside any coordinate/id range; names carry entropy no
// uuid or base64 run will reproduce.
const SENTINEL_SEED = 987654321987;
const SENTINEL_HIDDEN_NAME = "ZQXJVKWPYB-veiled-fastness-771239948821";
const SENTINEL_SCENE_NAME = "QWZXKJVYPB-suspended-cellar-663881247792";

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

function sentinelScene(mapDocumentId: string): SceneState {
  return {
    mapDocumentId,
    suspendedAt: 1,
    tokens: [{ id: "suspended-token", owner: "npc-owner", x: 3, y: 4, color: "#f00" } as never],
    props: [],
    drawings: [],
    sceneObjects: [],
    characterLinks: {},
    doorStates: {},
    combatActive: false,
    initiatives: {},
    fogEnabled: true,
    defaultVisionRadius: null,
    mapBackground: SENTINEL_SCENE_NAME,
  };
}

describe("atlas graph contracts", () => {
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

  function route(message: ClientMessage, senderUid: string): void {
    router.route(message, senderUid);
  }

  function createNode(id: string, name = `name-${id}`, parentId?: string): void {
    route({ t: "atlas-create-node", node: { id, kind: "dungeon", name, parentId } }, DM);
  }

  function nodes(): AtlasNode[] {
    return roomService.getState().atlasNodes;
  }

  it("mirrors ATLAS_LIMITS in SNAPSHOT_LIMITS so the wire caps cannot drift from the handler caps", () => {
    expect(SNAPSHOT_LIMITS.atlasNodes).toBe(ATLAS_LIMITS.nodes);
    expect(SNAPSHOT_LIMITS.atlasLinks).toBe(ATLAS_LIMITS.links);
  });

  it("creates a node the DM sees whole while an all-undiscovered player gets NO atlas keys", async () => {
    createNode("n1");
    await flush();

    expect(nodes()).toHaveLength(1);
    const dmSnapshot = latestSnapshot(dmWs);
    expect(dmSnapshot?.atlasNodes?.[0]?.id).toBe("n1");
    expect(dmSnapshot?.atlasNodes?.[0]?.createdAt).toBeDefined();

    const playerSnapshot = latestSnapshot(playerWs);
    expect(playerSnapshot).toBeDefined();
    expect("atlasNodes" in playerSnapshot!).toBe(false);
    expect("atlasLinks" in playerSnapshot!).toBe(false);
    expect("currentAtlasNodeId" in playerSnapshot!).toBe(false);
  });

  it("acks a replayed create as a no-op instead of erroring (the retry layer resends same-payload)", async () => {
    // A swallowed THROW is invisible to frame counts here (no commandId → no
    // nack frame), so the observable is the routing-error log every routed
    // throw reaches (MessageLogger.logRoutingError → console.error). The first
    // version of this test was green with the handler throwing — sabotage
    // caught it.
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      createNode("n1");
      createNode("n1");
      route({ t: "atlas-delete-node", nodeId: "ghost-never-existed" }, DM);
      route({ t: "atlas-delete-link", linkId: "ghost-link" }, DM);
      await flush();

      expect(nodes()).toHaveLength(1);
      expect(messagesOf(dmWs, "atlas-error")).toHaveLength(0);
      expect(errorLog).not.toHaveBeenCalled();
    } finally {
      errorLog.mockRestore();
    }
  });

  it("rejects every atlas message from a non-DM without touching state, and never explains why in detail", async () => {
    createNode("n1");
    await flush();
    const before = JSON.stringify(nodes());
    playerWs.send.mockClear();

    route({ t: "atlas-create-node", node: { id: "evil", kind: "dungeon", name: "x" } }, PLAYER);
    route({ t: "atlas-update-node", nodeId: "n1", patch: { discovered: true } }, PLAYER);
    route({ t: "atlas-delete-node", nodeId: "n1" }, PLAYER);
    await flush();

    expect(JSON.stringify(nodes())).toBe(before);
    // The attacker's socket: no atlas-error (that channel is the acting DM's),
    // and no snapshot gained atlas keys.
    expect(messagesOf(playerWs, "atlas-error")).toHaveLength(0);
    for (const snapshot of snapshotsOf(playerWs)) {
      expect("atlasNodes" in snapshot).toBe(false);
    }
  });

  it("gates BEFORE any lookup: a non-DM probing a missing node learns only the constant reason", () => {
    // Direct-construction is legal HERE because the pin is the thrown STRING
    // and its ordering, not reachability (the tests above prove reachability
    // through route()). A pre-gate lookup would throw "no longer exists" and
    // turn the nack channel into a node-status oracle.
    const handler = new AtlasMessageHandler(
      () => roomService.getState(),
      () => {},
      mapStudioService,
    );
    expect(() =>
      handler.handle({ t: "atlas-delete-node", nodeId: "ghost" }, PLAYER, "default", false),
    ).toThrow(ATLAS_DM_REQUIRED);
    expect(() =>
      handler.handle(
        { t: "atlas-update-node", nodeId: "ghost", patch: {} },
        PLAYER,
        "default",
        false,
      ),
    ).toThrow(ATLAS_DM_REQUIRED);
  });

  it("flips a node into a player's world on discover, with the exact whitelist key set", async () => {
    createNode("n1");
    route(
      {
        t: "atlas-create-node",
        node: { id: "child", kind: "building", name: "inn", parentId: "n1" },
      },
      DM,
    );
    route({ t: "atlas-update-node", nodeId: "child", patch: { discovered: true } }, DM);
    await flush();

    const snapshot = latestSnapshot(playerWs);
    expect(snapshot?.atlasNodes).toHaveLength(1);
    // Parent undiscovered → no parentId key at all.
    expect(Object.keys(snapshot!.atlasNodes![0]!).sort()).toEqual([
      "discovered",
      "id",
      "kind",
      "name",
    ]);

    route({ t: "atlas-update-node", nodeId: "n1", patch: { discovered: true } }, DM);
    await flush();
    const next = latestSnapshot(playerWs);
    expect(next?.atlasNodes).toHaveLength(2);
    const child = next?.atlasNodes?.find((entry) => entry.id === "child");
    expect(child?.parentId).toBe("n1");
  });

  it("leaks NOTHING undiscovered or suspended to a player's wire — structural sentinel walk over every frame", async () => {
    // A discovered node whose provenance carries the sentinel seed, an
    // undiscovered node with the sentinel name, and a suspended scene with a
    // sentinel background — planted directly in state (provenance/scenes are
    // A3/A4 products; the projection must already be airtight).
    const state = roomService.getState();
    state.atlasNodes.push(
      {
        id: "shown",
        kind: "dungeon",
        name: "The Shown Vault",
        discovered: true,
        recipe: { recipeId: "dungeon", seed: SENTINEL_SEED, theme: "stone", density: "high" },
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "hidden",
        kind: "settlement",
        name: SENTINEL_HIDDEN_NAME,
        discovered: false,
        createdAt: 1,
        updatedAt: 1,
      },
    );
    state.sceneStates["doc-x"] = sentinelScene("doc-x");

    // Drive real traffic so frames actually flow.
    route({ t: "atlas-update-node", nodeId: "shown", patch: { name: "The Shown Vault" } }, DM);
    createNode("n-extra");
    route({ t: "atlas-update-node", nodeId: "n-extra", patch: { discovered: true } }, DM);
    await flush();

    expect(sentinelHits(playerWs, SENTINEL_SEED)).toEqual([]);
    expect(sentinelHits(playerWs, SENTINEL_HIDDEN_NAME)).toEqual([]);
    expect(sentinelHits(playerWs, SENTINEL_SCENE_NAME)).toEqual([]);
    // Suspended scenes serialize to NO recipient — the DM included.
    expect(sentinelHits(dmWs, SENTINEL_SCENE_NAME)).toEqual([]);
    // Controls: the DM legitimately sees BOTH the hidden node's name and the
    // discovered node's recipe seed (their graph is whole) — proving the walk
    // CAN find each sentinel, so the zeros above are evidence, not vacuity.
    expect(sentinelHits(dmWs, SENTINEL_HIDDEN_NAME).length).toBeGreaterThan(0);
    expect(sentinelHits(dmWs, SENTINEL_SEED).length).toBeGreaterThan(0);
  });

  it("deleting a document degrades its node to a promise and drops its suspended scene", async () => {
    // The id-reuse bomb, disarmed at RUNTIME, not just at session load:
    // map-studio-import round-trips ids, so a scene keyed to a deleted
    // document would silently re-attach to whatever reuses the id, and a
    // still-"mapped" node would open onto a 12s timeout.
    route({ t: "map-studio-create", document: { id: "doc-a", name: "Doc A" } }, DM);
    createNode("n1");
    route({ t: "atlas-link-map", nodeId: "n1", documentId: "doc-a" }, DM);
    roomService.getState().sceneStates["doc-a"] = sentinelScene("doc-a");

    route({ t: "map-studio-delete", documentId: "doc-a" }, DM);
    await flush();

    const state = roomService.getState();
    expect(state.sceneStates["doc-a"]).toBeUndefined();
    expect(state.atlasNodes.find((entry) => entry.id === "n1")?.mapDocumentId).toBeUndefined();
    // ...and the degrade reached the DM's wire (the broadcast fired).
    const dmSnapshot = latestSnapshot(dmWs);
    expect(
      dmSnapshot?.atlasNodes?.find((entry) => entry.id === "n1")?.mapDocumentId,
    ).toBeUndefined();
  });

  it("links an existing document 1:1 — replays no-op, second claimants are refused", async () => {
    route({ t: "map-studio-create", document: { id: "doc-a", name: "Doc A" } }, DM);
    createNode("n1");
    createNode("n2");

    route({ t: "atlas-link-map", nodeId: "n1", documentId: "doc-a" }, DM);
    await flush();
    expect(nodes().find((entry) => entry.id === "n1")?.mapDocumentId).toBe("doc-a");

    dmWs.send.mockClear();
    route({ t: "atlas-link-map", nodeId: "n1", documentId: "doc-a" }, DM); // replay
    route({ t: "atlas-link-map", nodeId: "n2", documentId: "doc-a" }, DM); // second claimant
    route({ t: "atlas-link-map", nodeId: "n2", documentId: "ghost-doc" }, DM); // missing doc
    await flush();

    expect(nodes().find((entry) => entry.id === "n2")?.mapDocumentId).toBeUndefined();
    const errors = messagesOf(dmWs, "atlas-error") as { code?: string }[];
    expect(errors.map((entry) => entry.code).sort()).toEqual(["not-found", "rejected"]);
    // The error channel is the acting DM's alone.
    expect(messagesOf(playerWs, "atlas-error")).toHaveLength(0);
  });

  it("clamps a link's anchor into the origin document and refuses links from promises", async () => {
    route(
      { t: "map-studio-create", document: { id: "doc-a", name: "Doc A", width: 500, height: 400 } },
      DM,
    );
    createNode("mapped");
    createNode("promise");
    route({ t: "atlas-link-map", nodeId: "mapped", documentId: "doc-a" }, DM);

    route(
      {
        t: "atlas-create-link",
        link: {
          id: "l1",
          fromNodeId: "mapped",
          toNodeId: "promise",
          anchor: { x: 900, y: -50 },
          linkType: "stair",
          visibleToPlayers: true,
        },
      },
      DM,
    );
    route(
      {
        t: "atlas-create-link",
        link: {
          id: "l2",
          fromNodeId: "promise",
          toNodeId: "mapped",
          anchor: { x: 1, y: 1 },
          linkType: "door",
          visibleToPlayers: true,
        },
      },
      DM,
    );
    await flush();

    const state = roomService.getState();
    expect(state.atlasLinks).toHaveLength(1);
    expect(state.atlasLinks[0]?.anchor).toEqual({ x: 500, y: 0 });
    const errors = messagesOf(dmWs, "atlas-error") as { code?: string }[];
    expect(errors.some((entry) => entry.code === "rejected")).toBe(true);
  });

  it("deleting a node reparents its children and removes its links — and a replayed delete no-ops", async () => {
    createNode("root");
    createNode("mid", "mid-name", "root");
    createNode("leaf", "leaf-name", "mid");
    route({ t: "map-studio-create", document: { id: "doc-a", name: "Doc A" } }, DM);
    route({ t: "atlas-link-map", nodeId: "root", documentId: "doc-a" }, DM);
    route(
      {
        t: "atlas-create-link",
        link: {
          id: "l1",
          fromNodeId: "root",
          toNodeId: "mid",
          anchor: { x: 0, y: 0 },
          linkType: "door",
          visibleToPlayers: false,
        },
      },
      DM,
    );

    route({ t: "atlas-delete-node", nodeId: "mid" }, DM);
    route({ t: "atlas-delete-node", nodeId: "mid" }, DM); // replay
    await flush();

    const state = roomService.getState();
    expect(state.atlasNodes.map((entry) => entry.id).sort()).toEqual(["leaf", "root"]);
    expect(state.atlasNodes.find((entry) => entry.id === "leaf")?.parentId).toBe("root");
    expect(state.atlasLinks).toHaveLength(0);
    expect(messagesOf(dmWs, "atlas-error")).toHaveLength(0);
  });

  it("refuses a reparent that would mint a cycle", async () => {
    createNode("a");
    createNode("b", "b-name", "a");
    route({ t: "atlas-update-node", nodeId: "a", patch: { parentId: "b" } }, DM);
    await flush();

    expect(nodes().find((entry) => entry.id === "a")?.parentId).toBeUndefined();
    const errors = messagesOf(dmWs, "atlas-error") as { code?: string }[];
    expect(errors.some((entry) => entry.code === "rejected")).toBe(true);
  });

  function generateMessage(nodeId: string, commandId: string, seed = SENTINEL_SEED): ClientMessage {
    return {
      t: "atlas-generate-node",
      nodeId,
      commandId,
      seed,
      params: { theme: "stone", density: "medium", size: "small" },
    };
  }

  it("cashes a promise: document minted at preset size, node mapped with provenance, seed never on a player's wire", async () => {
    createNode("promise-1");
    route({ t: "atlas-update-node", nodeId: "promise-1", patch: { discovered: true } }, DM);

    route(generateMessage("promise-1", "gen-1"), DM);
    await flush();

    const node = nodes().find((entry) => entry.id === "promise-1");
    expect(node?.mapDocumentId).toBeDefined();
    expect(node?.recipe).toEqual({
      recipeId: "dungeon",
      seed: SENTINEL_SEED,
      theme: "stone",
      density: "medium",
    });
    const document = mapStudioService.get("default", node!.mapDocumentId!);
    expect({ width: document.width, height: document.height }).toEqual({
      width: 24 * 50,
      height: 20 * 50,
    });
    expect(document.elements.length).toBeGreaterThan(0);
    // The DM's studio channel learned about the new document...
    expect(
      (messagesOf(dmWs, "map-studio-document") as { document?: { id?: string } }[]).some(
        (frame) => frame.document?.id === node!.mapDocumentId,
      ),
    ).toBe(true);
    // ...while the DISCOVERED node's provenance seed still never reaches the
    // player (the projection strips recipe even on visible nodes).
    expect(sentinelHits(playerWs, SENTINEL_SEED)).toEqual([]);
    expect(messagesOf(playerWs, "map-studio-document")).toHaveLength(0);
  });

  it("acks a replayed generate as a no-op — the node guard, not the dedupe cache, is the idempotency", async () => {
    createNode("promise-1");
    route(generateMessage("promise-1", "gen-1"), DM);
    const firstDocId = nodes().find((entry) => entry.id === "promise-1")?.mapDocumentId;

    route(generateMessage("promise-1", "gen-1"), DM);
    await flush();

    expect(nodes().find((entry) => entry.id === "promise-1")?.mapDocumentId).toBe(firstDocId);
    expect(mapStudioService.list("default")).toHaveLength(1);
    expect(messagesOf(dmWs, "atlas-error")).toHaveLength(0);
  });

  it("deletes the minted document when the apply fails — a failed generate persists NOTHING", async () => {
    createNode("promise-1");
    const applySpy = vi.spyOn(mapStudioService, "apply").mockImplementationOnce(() => {
      throw new Error("forced apply failure");
    });
    try {
      route(generateMessage("promise-1", "gen-fail"), DM);
      await flush();

      expect(mapStudioService.list("default")).toHaveLength(0);
      expect(nodes().find((entry) => entry.id === "promise-1")?.mapDocumentId).toBeUndefined();
      const errors = messagesOf(dmWs, "atlas-error") as { code?: string }[];
      expect(errors.some((entry) => entry.code === "rejected")).toBe(true);

      // ...and a RETRY after the transient failure succeeds with exactly one document.
      route(generateMessage("promise-1", "gen-retry"), DM);
      expect(mapStudioService.list("default")).toHaveLength(1);
      expect(nodes().find((entry) => entry.id === "promise-1")?.mapDocumentId).toBeDefined();
    } finally {
      applySpy.mockRestore();
    }
  });

  it("refuses to mint past MAX_SESSION_DOCUMENTS on BOTH create paths — the export must stay re-importable", async () => {
    for (let index = 0; index < 64; index += 1) {
      mapStudioService.create("default", { id: `doc-${index}`, name: `doc ${index}` });
    }
    createNode("promise-1");

    route(generateMessage("promise-1", "gen-cap"), DM);
    await flush();
    expect(mapStudioService.list("default")).toHaveLength(64);
    const errors = messagesOf(dmWs, "atlas-error") as { code?: string }[];
    expect(errors.some((entry) => entry.code === "at-cap")).toBe(true);

    // The map-studio-create path refuses too (thrown → routed error log)…
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      route({ t: "map-studio-create", document: { id: "doc-65", name: "one too many" } }, DM);
      expect(mapStudioService.list("default")).toHaveLength(64);
      expect(errorLog).toHaveBeenCalled();

      // …and so does map-studio-import, the third mint path the arc's final
      // review found outside the ceiling (a fresh id per import, so every
      // success adds a document).
      errorLog.mockClear();
      const template = JSON.parse(JSON.stringify(mapStudioService.get("default", "doc-0")));
      route({ t: "map-studio-import", document: { ...template, id: "doc-import-65" } }, DM);
      expect(mapStudioService.list("default")).toHaveLength(64);
      expect(errorLog).toHaveBeenCalled();
    } finally {
      errorLog.mockRestore();
    }
  });

  it("map-studio-delete drops the links ANCHORED on the dead map, and keeps the ones pointing at its node", async () => {
    // A link's anchor is document px on its from-node's map; with the map
    // gone it would resurface at a meaningless spot on the node's next map.
    mapStudioService.create("default", { id: "doc-x", name: "X" });
    mapStudioService.create("default", { id: "doc-y", name: "Y" });
    createNode("nx");
    createNode("ny");
    route({ t: "atlas-link-map", nodeId: "nx", documentId: "doc-x" }, DM);
    route({ t: "atlas-link-map", nodeId: "ny", documentId: "doc-y" }, DM);
    const link = (id: string, from: string, to: string) => ({
      id,
      fromNodeId: from,
      toNodeId: to,
      anchor: { x: 10, y: 10 },
      linkType: "door" as const,
      visibleToPlayers: true,
    });
    route({ t: "atlas-create-link", link: link("from-x", "nx", "ny") }, DM);
    route({ t: "atlas-create-link", link: link("to-x", "ny", "nx") }, DM);
    await flush();

    route({ t: "map-studio-delete", documentId: "doc-x" }, DM);
    await flush();
    const state = roomService.getState();
    expect(state.atlasNodes.find((node) => node.id === "nx")?.mapDocumentId).toBeUndefined();
    expect(state.atlasLinks.map((entry) => entry.id)).toEqual(["to-x"]);
  });

  it("generates identical geometry from identical seed+params — provenance is reproducible", async () => {
    createNode("a-node");
    createNode("b-node");
    route(generateMessage("a-node", "gen-a", 424242), DM);
    route(generateMessage("b-node", "gen-b", 424242), DM);

    const docA = mapStudioService.get(
      "default",
      nodes().find((entry) => entry.id === "a-node")!.mapDocumentId!,
    );
    const docB = mapStudioService.get(
      "default",
      nodes().find((entry) => entry.id === "b-node")!.mapDocumentId!,
    );
    const geometryOf = (doc: typeof docA) => doc.elements.map(({ id: _id, ...rest }) => rest);
    expect(geometryOf(docA)).toEqual(geometryOf(docB));
    expect(docA.terrain).toEqual(docB.terrain);
  });

  it("refuses the 65th node with at-cap", async () => {
    const state = roomService.getState();
    for (let index = 0; index < ATLAS_LIMITS.nodes; index += 1) {
      state.atlasNodes.push({
        id: `seed-${index}`,
        kind: "region",
        name: `seed ${index}`,
        discovered: false,
        createdAt: 1,
        updatedAt: 1,
      });
    }
    createNode("one-too-many");
    await flush();

    expect(nodes()).toHaveLength(ATLAS_LIMITS.nodes);
    const errors = messagesOf(dmWs, "atlas-error") as { code?: string }[];
    expect(errors.some((entry) => entry.code === "at-cap")).toBe(true);
  });
});
