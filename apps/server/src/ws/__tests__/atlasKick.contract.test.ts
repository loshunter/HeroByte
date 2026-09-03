// ============================================================================
// ATLAS KICK CONTRACT TESTS — one message, the whole kicked-in door
// ============================================================================
// Through the REAL MessageRouter (the §4.6 fixture): the kick must adopt or
// resolve the origin, mint the child under it, cash it, pin BOTH doors, and
// travel — atomically, replay-safe, with every cap checked before anything
// moves, and with nothing a player must not learn on any player frame during
// the whole dance.
//
// Sentinel discipline (plan §4.2): ≥9-digit seeds and high-entropy names, so
// a hit is evidence and a miss is not a uuid collision.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ATLAS_LIMITS,
  getTerrainCell,
  type AtlasNode,
  type ClientMessage,
  type PlayerStagingZone,
} from "@herobyte/shared";
import { MAX_SESSION_DOCUMENTS } from "../../middleware/validators/sessionValidators.js";
import { ATLAS_DM_REQUIRED } from "../handlers/AtlasMessageHandler.js";
import { entranceAnchor } from "../handlers/atlasKick.js";
import { sentinelHits } from "./leakSentinels.js";
import {
  createRouterHarness,
  flush,
  latestSnapshot,
  messagesOf,
  snapshotsOf,
  type FakeSocket,
  type RouterHarness,
} from "./routerHarness.js";

const DM = "dm-player";
const PLAYER = "watcher";
const SENTINEL_SEED = 987654321987;
const SENTINEL_HIDDEN_NAME = "ZQXJVKWPYB-veiled-fastness-771239948821";

type KickMessage = Extract<ClientMessage, { t: "atlas-kick" }>;

function kickMessage(overrides: Partial<KickMessage> = {}): KickMessage {
  return {
    t: "atlas-kick",
    commandId: "kick-cmd-1",
    nodeId: "kick-child",
    originNodeId: "kick-origin",
    linkId: "kick-out",
    returnLinkId: "kick-back",
    name: "  Cellar of Teeth  ",
    seed: SENTINEL_SEED,
    recipe: { recipeId: "dungeon", theme: "stone", density: "medium", size: "small" },
    ...overrides,
  };
}

/** The arrival rect's cell extent (the zone convention: x/y is the CENTER cell). */
function rectOf(zone: PlayerStagingZone) {
  return {
    left: zone.x - (zone.width - 1) / 2,
    right: zone.x + (zone.width - 1) / 2,
    top: zone.y - (zone.height - 1) / 2,
    bottom: zone.y + (zone.height - 1) / 2,
  };
}

describe("atlas kick contracts", () => {
  let h: RouterHarness;
  let dmWs: FakeSocket;
  let playerWs: FakeSocket;

  beforeEach(() => {
    h = createRouterHarness("atlasKick-state.json", [
      { uid: DM, isDM: true },
      { uid: PLAYER, isDM: false },
    ]);
    dmWs = h.sockets[DM]!;
    playerWs = h.sockets[PLAYER]!;
  });

  afterEach(flush);

  const route = (message: ClientMessage, senderUid = DM) => h.route(message, senderUid);
  const state = () => h.roomService.getState();
  const nodes = () => state().atlasNodes;
  const links = () => state().atlasLinks;
  const child = () => nodes().find((node) => node.id === "kick-child");

  /** A document on the table with NO node — the unadopted origin. */
  function bindDocument(id = "doc-a", name = "Doc A"): void {
    route({ t: "map-studio-create", document: { id, name } });
    route({ t: "map-studio-set-live", documentId: id });
  }

  /** The `:656` adopt flow: a bound table whose document already has a node. */
  function bindAdoptedOrigin(): void {
    bindDocument();
    route({ t: "atlas-create-node", node: { id: "nA", kind: "region", name: "Node A" } });
    route({ t: "atlas-link-map", nodeId: "nA", documentId: "doc-a" });
    route({ t: "atlas-travel", nodeId: "nA" });
  }

  /** Two player-owned tokens at (4,4) and (6,6): centroid (5,5) → (275, 275) on grid 50. */
  function seedParty(): void {
    state().tokens.push(
      { id: "pc-1", owner: PLAYER, x: 4, y: 4, color: "#0f0" } as never,
      { id: "pc-2", owner: PLAYER, x: 6, y: 6, color: "#0f0" } as never,
    );
  }

  function fingerprint(): string {
    const s = state();
    return JSON.stringify({
      nodes: s.atlasNodes,
      links: s.atlasLinks,
      documents: h.mapStudioService.list("default").map((document) => document.id),
      live: s.liveMapDocumentId,
      scene: s.compiledScene?.sourceDocumentId,
      tokens: s.tokens,
      zone: s.playerStagingZone,
      fog: s.fogEnabled,
    });
  }

  it("the happy path on an ADOPTED origin: child under it, cashed and sized, two doors, the party inside the entrance, one frame each", async () => {
    bindAdoptedOrigin();
    seedParty();
    state().atlasNodes.push({
      id: "hidden",
      kind: "settlement",
      name: SENTINEL_HIDDEN_NAME,
      discovered: false,
      createdAt: 1,
      updatedAt: 1,
    });
    await flush();
    dmWs.send.mockClear();
    playerWs.send.mockClear();

    route(kickMessage());
    await flush();

    // The child: under the origin, named trimmed, cashed with sized provenance.
    const node = child()!;
    expect(node).toMatchObject({
      kind: "dungeon",
      name: "Cellar of Teeth",
      parentId: "nA",
      discovered: true,
      recipe: {
        recipeId: "dungeon",
        theme: "stone",
        density: "medium",
        size: "small",
        seed: SENTINEL_SEED,
      },
    });
    const document = h.mapStudioService.get("default", node.mapDocumentId!);
    expect({ width: document.width, height: document.height }).toEqual({
      width: 24 * 50,
      height: 20 * 50,
    });
    expect(document.name).toBe("Cellar of Teeth");

    // The arrival: inside the document, every cell of its rect a floor cell.
    const arrival = node.arrival!;
    const rect = rectOf(arrival);
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.right).toBeLessThan(24);
    expect(rect.bottom).toBeLessThan(20);
    expect(document.terrain).toBeDefined();
    for (let x = rect.left; x <= rect.right; x += 1) {
      for (let y = rect.top; y <= rect.bottom; y += 1) {
        expect(
          getTerrainCell(document.terrain!, x, y),
          `cell ${x},${y} of the arrival is painted floor`,
        ).not.toBeNull();
      }
    }

    // Two doors: OUT at the party's centroid in doc px, BACK at the entrance's edge.
    const out = links().find((link) => link.id === "kick-out")!;
    const back = links().find((link) => link.id === "kick-back")!;
    expect(out).toMatchObject({
      fromNodeId: "nA",
      toNodeId: "kick-child",
      anchor: { x: 275, y: 275 },
      linkType: "door",
      visibleToPlayers: true,
    });
    expect(back).toMatchObject({ fromNodeId: "kick-child", toNodeId: "nA", linkType: "door" });
    expect(back.anchor).toEqual(entranceAnchor(arrival, document));
    // On the rect's boundary ring, never its center (the tokens stand there).
    const pxLeft = rect.left * 50;
    const pxRight = (rect.right + 1) * 50;
    const pxTop = rect.top * 50;
    const pxBottom = (rect.bottom + 1) * 50;
    expect(back.anchor.x).toBeGreaterThanOrEqual(pxLeft);
    expect(back.anchor.x).toBeLessThanOrEqual(pxRight);
    expect(back.anchor.y).toBeGreaterThanOrEqual(pxTop);
    expect(back.anchor.y).toBeLessThanOrEqual(pxBottom);
    const ringDistance = Math.min(
      back.anchor.x - pxLeft,
      pxRight - back.anchor.x,
      back.anchor.y - pxTop,
      pxBottom - back.anchor.y,
    );
    expect(ringDistance).toBeLessThanOrEqual(50);
    expect(back.anchor).not.toEqual({ x: (arrival.x + 0.5) * 50, y: (arrival.y + 0.5) * 50 });

    // The party ARRIVED inside the entrance (cells are fractional: half a cell
    // of tolerance on each side is the zone convention itself).
    const s = state();
    expect(s.compiledScene?.sourceDocumentId).toBe(node.mapDocumentId);
    expect(s.liveMapDocumentId).toBe(node.mapDocumentId);
    expect(s.fogEnabled).toBe(true);
    expect(s.playerStagingZone).toEqual(arrival);
    const party = s.tokens.filter((token) => token.owner === PLAYER);
    expect(party).toHaveLength(2);
    for (const token of party) {
      expect(token.x).toBeGreaterThanOrEqual(rect.left - 0.5);
      expect(token.x).toBeLessThanOrEqual(rect.right + 0.5);
      expect(token.y).toBeGreaterThanOrEqual(rect.top - 0.5);
      expect(token.y).toBeLessThanOrEqual(rect.bottom + 0.5);
    }

    // ONE synchronous mutation → exactly one snapshot per recipient, plus the
    // DM's studio frame for the new document.
    expect(snapshotsOf(dmWs)).toHaveLength(1);
    expect(snapshotsOf(playerWs)).toHaveLength(1);
    const studio = messagesOf(dmWs, "map-studio-document") as { document?: { id?: string } }[];
    expect(studio.map((frame) => frame.document?.id)).toEqual([node.mapDocumentId]);
    expect(messagesOf(dmWs, "atlas-error")).toHaveLength(0);

    // The DM stands on the child; the discovered child is the player's "here"
    // too, and the player's frame carries the accepted render of the entrance.
    expect(latestSnapshot(dmWs)?.currentAtlasNodeId).toBe("kick-child");
    const playerSnapshot = latestSnapshot(playerWs)!;
    expect(playerSnapshot.currentAtlasNodeId).toBe("kick-child");
    expect(playerSnapshot.playerStagingZone).toEqual(arrival);
    expect(playerSnapshot.sceneObjects?.some((object) => object.id === "staging-zone")).toBe(true);
    expect(playerSnapshot.atlasLinks?.map((link) => link.id).sort()).toEqual([
      "kick-back",
      "kick-out",
    ]);

    // SECRECY, the whole dance: the seed, the hidden sibling's name, and the
    // `arrival`/`recipe`/`sceneStates` KEYS reach no player frame — with the
    // DM as the positive control for each.
    expect(sentinelHits(playerWs, SENTINEL_SEED)).toEqual([]);
    expect(sentinelHits(playerWs, SENTINEL_HIDDEN_NAME)).toEqual([]);
    for (const snapshot of snapshotsOf(playerWs)) {
      expect("sceneStates" in snapshot).toBe(false);
      for (const entry of snapshot.atlasNodes ?? []) {
        expect("arrival" in entry).toBe(false);
        expect("recipe" in entry).toBe(false);
      }
    }
    expect(sentinelHits(dmWs, SENTINEL_SEED).length).toBeGreaterThan(0);
    expect(sentinelHits(dmWs, SENTINEL_HIDDEN_NAME).length).toBeGreaterThan(0);
    const dmChild = latestSnapshot(dmWs)?.atlasNodes?.find((entry) => entry.id === "kick-child");
    expect(dmChild?.arrival).toEqual(arrival);
    expect(dmChild?.recipe?.size).toBe("small");
  });

  it("an UNADOPTED origin (a bound document with no node) is adopted: minted `region`, named after the map, discovered, both doors pinned", () => {
    bindDocument("doc-a", "The Broken Tower");
    seedParty();

    route(kickMessage());

    const origin = nodes().find((node) => node.id === "kick-origin")!;
    expect(origin).toMatchObject({
      kind: "region",
      name: "The Broken Tower",
      mapDocumentId: "doc-a",
      discovered: true,
    });
    expect(origin.parentId).toBeUndefined();
    expect(child()?.parentId).toBe("kick-origin");
    expect(links().find((link) => link.id === "kick-out")).toMatchObject({
      fromNodeId: "kick-origin",
      toNodeId: "kick-child",
      anchor: { x: 275, y: 275 },
    });
    expect(links().find((link) => link.id === "kick-back")).toMatchObject({
      fromNodeId: "kick-child",
      toNodeId: "kick-origin",
    });
    expect(state().compiledScene?.sourceDocumentId).toBe(child()?.mapDocumentId);
  });

  it("REPLAY: the same message ×3 lands once — one document, one adopted origin, two links, one travel, NO_OP on 2 and 3", async () => {
    bindDocument();
    seedParty();
    route(kickMessage());
    await flush();
    const after = fingerprint();

    for (const attempt of [2, 3]) {
      dmWs.send.mockClear();
      playerWs.send.mockClear();
      route(kickMessage());
      await flush();
      expect(fingerprint(), `attempt ${attempt} mutated nothing`).toBe(after);
      expect(snapshotsOf(dmWs), `attempt ${attempt} broadcast nothing`).toHaveLength(0);
      expect(snapshotsOf(playerWs)).toHaveLength(0);
      // The generate idiom: a replay re-broadcasts the document to DMs so a
      // lost first ack still leaves the studio list fresh.
      expect(messagesOf(dmWs, "map-studio-document")).toHaveLength(1);
      expect(messagesOf(dmWs, "atlas-error")).toHaveLength(0);
    }
    expect(h.mapStudioService.list("default")).toHaveLength(2);
    expect(nodes()).toHaveLength(2);
    expect(links()).toHaveLength(2);
  });

  describe("PRE-FLIGHT — every cap refuses with the child's nodeId and a fingerprint-identical state", () => {
    function promise(id: string): AtlasNode {
      return { id, kind: "dungeon", name: id, discovered: false, createdAt: 1, updatedAt: 1 };
    }

    async function expectRefusal(code: string): Promise<void> {
      const before = fingerprint();
      await flush();
      dmWs.send.mockClear();
      route(kickMessage());
      await flush();
      expect(fingerprint()).toBe(before);
      const errors = messagesOf(dmWs, "atlas-error") as { code?: string; nodeId?: string }[];
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({ code, nodeId: "kick-child" });
      expect(snapshotsOf(dmWs)).toHaveLength(0);
    }

    it("nodes at the cap on an adopted origin", async () => {
      bindAdoptedOrigin();
      while (nodes().length < ATLAS_LIMITS.nodes) nodes().push(promise(`p-${nodes().length}`));
      await expectRefusal("at-cap");
    });

    it("nodes one under the cap when the origin must ALSO be minted", async () => {
      bindDocument();
      while (nodes().length < ATLAS_LIMITS.nodes - 1) nodes().push(promise(`p-${nodes().length}`));
      await expectRefusal("at-cap");
    });

    it("links one under the cap (two doors are needed)", async () => {
      bindAdoptedOrigin();
      while (links().length < ATLAS_LIMITS.links - 1) {
        links().push({
          id: `l-${links().length}`,
          fromNodeId: "nA",
          toNodeId: "nA",
          anchor: { x: 1, y: 1 },
          linkType: "door",
          visibleToPlayers: false,
        });
      }
      await expectRefusal("at-cap");
    });

    it("documents at the cap", async () => {
      bindAdoptedOrigin();
      for (
        let index = h.mapStudioService.list("default").length;
        index < MAX_SESSION_DOCUMENTS;
        index += 1
      ) {
        route({ t: "map-studio-create", document: { id: `filler-${index}`, name: `F${index}` } });
      }
      await expectRefusal("at-cap");
    });

    it("the origin's document missing from the store (a boot-time desync)", async () => {
      bindAdoptedOrigin();
      h.mapStudioService.delete("default", "doc-a");
      await expectRefusal("not-found");
    });

    it("a recipe the registry refuses persists NOTHING — no node, no links, no document", async () => {
      bindAdoptedOrigin();
      seedParty();
      const before = fingerprint();
      await flush();
      dmWs.send.mockClear();
      route(
        kickMessage({
          recipe: {
            recipeId: "dungeon",
            theme: "granite",
            density: "medium",
            size: "small",
          } as never,
        }),
      );
      await flush();
      expect(fingerprint()).toBe(before);
      expect(h.mapStudioService.list("default")).toHaveLength(1);
      const errors = messagesOf(dmWs, "atlas-error") as { code?: string; reason?: string }[];
      expect(errors[0]).toMatchObject({ code: "rejected", nodeId: "kick-child" });
      expect(errors[0]?.reason).toMatch(/theme/);
    });
  });

  it("TRUE LIMBO (nothing compiled, nothing bound) refuses — there is no document to suspend", async () => {
    seedParty();
    const before = fingerprint();
    route(kickMessage());
    await flush();
    expect(fingerprint()).toBe(before);
    expect(nodes()).toHaveLength(0);
    const errors = messagesOf(dmWs, "atlas-error") as { code?: string; reason?: string }[];
    expect(errors[0]).toMatchObject({ code: "rejected", nodeId: "kick-child" });
    expect(errors[0]?.reason).toMatch(/live map/i);
  });

  it("a BINDING with nothing compiled is limbo too — the kick refuses, and the table's stayers are not swept away", async () => {
    // Reachable through the load paths (a state file with a binding and no
    // compiled scene); the projection calls the same state "nothing on the
    // table", and the kick must agree with it.
    route({ t: "map-studio-create", document: { id: "doc-a", name: "Doc A" } });
    state().liveMapDocumentId = "doc-a";
    state().compiledScene = undefined;
    state().tokens.push({ id: "stayer", owner: DM, x: 3, y: 3, color: "#f00" } as never);
    state().drawings.push({ id: "d-1", type: "freehand", points: [], color: "#fff" } as never);
    const before = fingerprint();
    await flush();
    dmWs.send.mockClear();

    route(kickMessage());
    await flush();
    expect(fingerprint()).toBe(before);
    const errors = messagesOf(dmWs, "atlas-error") as { code?: string; reason?: string }[];
    expect(errors[0]).toMatchObject({ code: "rejected", nodeId: "kick-child" });
    expect(errors[0]?.reason).toMatch(/live map/i);
  });

  it("the UNBOUND interlude: after an unbind the origin is the SCENE's node, and its scene is captured under its own id", () => {
    bindAdoptedOrigin();
    seedParty();
    route({ t: "map-studio-set-live", documentId: null });
    state().drawings.push({
      id: "d-interlude",
      type: "freehand",
      points: [],
      color: "#fff",
    } as never);
    expect(state().liveMapDocumentId).toBeUndefined();

    route(kickMessage());

    expect(child()?.parentId).toBe("nA");
    expect(links().find((link) => link.id === "kick-out")?.fromNodeId).toBe("nA");
    expect(nodes().some((node) => node.id === "kick-origin")).toBe(false); // nothing adopted
    const saved = state().sceneStates["doc-a"];
    expect(saved?.drawings.some((drawing) => drawing.id === "d-interlude")).toBe(true);
    expect(state().liveMapDocumentId).toBe(child()?.mapDocumentId);
  });

  it("after a PUBLISH of another map the origin is the SCENE on the table, not the binding", () => {
    bindAdoptedOrigin();
    seedParty();
    route({ t: "map-studio-create", document: { id: "doc-b", name: "Doc B" } });
    route({ t: "atlas-create-node", node: { id: "nB", kind: "region", name: "Node B" } });
    route({ t: "atlas-link-map", nodeId: "nB", documentId: "doc-b" });
    route({
      t: "map-studio-publish",
      documentId: "doc-b",
      background: "data:image/png;base64,QUJD",
    });
    expect(state().liveMapDocumentId).toBe("doc-a"); // the binding did not move
    expect(state().compiledScene?.sourceDocumentId).toBe("doc-b"); // the party did

    route(kickMessage());

    expect(child()?.parentId).toBe("nB");
    expect(links().find((link) => link.id === "kick-out")?.fromNodeId).toBe("nB");
    // Nothing was adopted: B already had its node.
    expect(nodes().some((node) => node.id === "kick-origin")).toBe(false);
  });

  it("the PUBLISH-BURN row: a publish captures the child's scene zone-less, and the next travel to it installs the entrance again", () => {
    bindAdoptedOrigin();
    seedParty();
    route({ t: "map-studio-create", document: { id: "doc-b", name: "Doc B" } });
    route({ t: "atlas-create-node", node: { id: "nB", kind: "region", name: "Node B" } });
    route({ t: "atlas-link-map", nodeId: "nB", documentId: "doc-b" });
    route(kickMessage());
    const arrival = child()!.arrival!;
    const childDocumentId = child()!.mapDocumentId!;
    expect(state().playerStagingZone).toEqual(arrival);

    // Away (the child's scene is captured WITH its zone), then the burn: a
    // publish compiles the child's map onto the table outside travel, and the
    // next departure captures THAT — zone-less — under the child's id.
    route({ t: "atlas-travel", nodeId: "nA" });
    route({
      t: "map-studio-publish",
      documentId: childDocumentId,
      background: "data:image/png;base64,QUJD",
    });
    expect(state().compiledScene?.sourceDocumentId).toBe(childDocumentId);
    route({ t: "atlas-travel", nodeId: "nB" });
    expect(state().sceneStates[childDocumentId]?.playerStagingZone).toBeUndefined();

    route({ t: "atlas-travel", nodeId: "kick-child" });
    expect(state().playerStagingZone).toEqual(arrival);
    const rect = rectOf(arrival);
    for (const token of state().tokens.filter((entry) => entry.owner === PLAYER)) {
      expect(token.x).toBeGreaterThanOrEqual(rect.left - 0.5);
      expect(token.x).toBeLessThanOrEqual(rect.right + 0.5);
    }
  });

  it("a DM-MOVED zone wins: captured with the scene, restored, never re-installed over", () => {
    bindAdoptedOrigin();
    seedParty();
    route(kickMessage());
    const moved = { x: 2, y: 2, width: 1, height: 1, rotation: 0 };
    route({ t: "set-player-staging-zone", zone: moved });

    route({ t: "atlas-travel", nodeId: "nA" });
    route({ t: "atlas-travel", nodeId: "kick-child" });
    expect(state().playerStagingZone).toEqual(moved);
    for (const token of state().tokens.filter((entry) => entry.owner === PLAYER)) {
      expect(Math.abs(token.x - 2)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(token.y - 2)).toBeLessThanOrEqual(0.5);
    }
  });

  it("ZERO travelers: the out-door sits at the scene's center — a solo prep is normal, never a refusal", () => {
    bindAdoptedOrigin();
    route(kickMessage());
    expect(links().find((link) => link.id === "kick-out")?.anchor).toEqual({ x: 1024, y: 1024 });
    expect(child()).toBeDefined();
  });

  it("a RASTER map with a moved transform: the anchor goes through the inverse transform", () => {
    bindAdoptedOrigin();
    seedParty();
    state().sceneObjects.push({
      id: "map",
      type: "map",
      locked: true,
      zIndex: -100,
      transform: { x: 100, y: 50, scaleX: 2, scaleY: 2, rotation: 0 },
      data: { imageUrl: "raster" },
    } as never);

    route(kickMessage());
    // World (275, 275) → document ((275 − 100) / 2, (275 − 50) / 2).
    expect(links().find((link) => link.id === "kick-out")?.anchor).toEqual({ x: 87.5, y: 112.5 });
  });

  it("a NON-DM kick is refused at the family gate: the constant reason, state untouched, no atlas key on the attacker's wire", async () => {
    bindAdoptedOrigin();
    seedParty();
    await flush();
    const before = fingerprint();
    playerWs.send.mockClear();
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    let gateThrowLogged = false;
    try {
      route(kickMessage(), PLAYER);
      await flush();
    } finally {
      // Read BEFORE restoring: mockRestore clears the recorded calls.
      gateThrowLogged = errorLog.mock.calls.some((call) =>
        call.some((arg) => arg instanceof Error && arg.message === ATLAS_DM_REQUIRED),
      );
      errorLog.mockRestore();
    }
    expect(fingerprint()).toBe(before);
    expect(gateThrowLogged).toBe(true);
    expect(messagesOf(playerWs, "atlas-error")).toHaveLength(0);
    for (const frame of messagesOf(playerWs, "nack") as { reason?: string }[]) {
      expect(frame.reason).toBe(ATLAS_DM_REQUIRED);
    }
    for (const snapshot of snapshotsOf(playerWs)) {
      expect("atlasNodes" in snapshot).toBe(false);
    }
  });

  it("the already-there row cannot swallow a kick: a replayed kick never re-travels, and a fresh one always lands on a NEW document", () => {
    bindAdoptedOrigin();
    route(kickMessage());
    const first = child()!.mapDocumentId;
    route({ t: "atlas-travel", nodeId: "nA" });
    route(
      kickMessage({ nodeId: "kick-child-2", linkId: "o2", returnLinkId: "b2", commandId: "c2" }),
    );
    const second = nodes().find((node) => node.id === "kick-child-2")!;
    expect(second.mapDocumentId).not.toBe(first);
    expect(state().liveMapDocumentId).toBe(second.mapDocumentId);
  });
});
