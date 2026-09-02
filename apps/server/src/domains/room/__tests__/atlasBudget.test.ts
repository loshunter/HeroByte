// ============================================================================
// ATLAS BUDGETS (A7) — the caps, weighed on the real wire
// ============================================================================
// Sibling to SnapshotSizeGuard.test.ts (same raw-utf8 philosophy, split file
// for the 350 guard): a campaign at BOTH atlas caps must ride the snapshot
// with room to spare, and a realistic pile of suspended scenes must never
// ride it at all — while its cost on the SYNCHRONOUS save path is measured
// and recorded (plan §2.2's store-extraction trigger, quantified).
//
// The atlas rows are built by the REAL AtlasMessageHandler — not literals —
// so what is weighed is what production writes (server timestamps, clamped
// anchors), and reaching both caps proves the handlers accept a full atlas.

import path from "node:path";
import { performance } from "node:perf_hooks";
import { describe, it, expect } from "vitest";
import { ATLAS_LIMITS, type SceneState } from "@herobyte/shared";
import { RoomService, SNAPSHOT_SIZE_LIMIT_BYTES } from "../service.js";
import { MapStudioService } from "../../mapStudio/service.js";
import { AtlasMessageHandler } from "../../../ws/handlers/AtlasMessageHandler.js";

const TEST_STATE_FILE = path.join(process.cwd(), ".tmp", "atlasBudget-state.json");
const ROOM = "budget-room";
const DM = "budget-dm";

/** Exactly what service.ts weighs before it warns. */
function wireBytes(payload: unknown): number {
  return Buffer.byteLength(JSON.stringify(payload), "utf8");
}

function uuidish(prefix: string, index: number): string {
  return `${prefix}0000-0000-4000-8000-${String(index).padStart(12, "0")}`.slice(-36);
}

function buildMaxedAtlas(service: RoomService) {
  const mapStudio = new MapStudioService();
  const document = mapStudio.create(ROOM, { id: "budget-doc", name: "Budget Vault" });
  const handler = new AtlasMessageHandler(
    () => service.getState(),
    () => {},
    mapStudio,
  );
  const send = (message: Parameters<AtlasMessageHandler["handle"]>[0]) =>
    handler.handle(message, DM, ROOM, true);

  for (let i = 0; i < ATLAS_LIMITS.nodes; i++) {
    send({
      t: "atlas-create-node",
      node: {
        id: uuidish("n", i),
        kind: "dungeon",
        // The validator's 64-char name cap — every node at the ceiling.
        name: `The Endless Stair of Perpetually Descending Doom, Landing #${String(i).padStart(3, "0")}`.slice(
          0,
          64,
        ),
        parentId: i > 0 ? uuidish("n", i - 1) : undefined,
      },
    });
  }
  // Links anchor on the from-node's map, so the hub node gets the real doc.
  send({ t: "atlas-link-map", nodeId: uuidish("n", 0), documentId: document.id });
  for (let i = 0; i < ATLAS_LIMITS.links; i++) {
    send({
      t: "atlas-create-link",
      link: {
        id: uuidish("l", i),
        fromNodeId: uuidish("n", 0),
        toNodeId: uuidish("n", (i % (ATLAS_LIMITS.nodes - 1)) + 1),
        anchor: { x: 1000.25 + i, y: 2000.75 + i },
        linkType: (["door", "stair", "signpost"] as const)[i % 3]!,
        visibleToPlayers: i % 2 === 0,
      },
    });
  }
}

/** A believable big suspended scene — a fought-over dungeon, mid-campaign. */
function fatScene(documentId: string): SceneState {
  return {
    mapDocumentId: documentId,
    suspendedAt: 1,
    tokens: Array.from({ length: 30 }, (_, i) => ({
      id: `${documentId}-token-${i}`,
      owner: `player-${i % 6}`,
      x: i * 2,
      y: i * 3,
      color: "#a0b1c2",
    })) as SceneState["tokens"],
    props: Array.from({ length: 10 }, (_, i) => ({
      id: `${documentId}-prop-${i}`,
      owner: `player-${i % 6}`,
      label: `Prop ${i}`,
      imageUrl: `https://example.invalid/prop-${i}.png`,
      x: i,
      y: i,
      size: 1,
    })) as unknown as SceneState["props"],
    drawings: Array.from({ length: 20 }, (_, i) => ({
      id: `${documentId}-draw-${i}`,
      type: "freehand" as const,
      points: Array.from({ length: 50 }, (_, p) => ({ x: p * 3.5, y: p * 2.25 })),
      color: "#ffffff",
      width: 2,
      opacity: 1,
    })) as unknown as SceneState["drawings"],
    sceneObjects: Array.from({ length: 40 }, (_, i) => ({
      id: `${documentId}-object-${i}`,
      type: "token" as const,
      transform: { x: i, y: i, scaleX: 1, scaleY: 1, rotation: 0 },
    })) as unknown as SceneState["sceneObjects"],
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
      Array.from({ length: 12 }, (_, i) => [
        `char-${i}`,
        { initiative: 20 - i, initiativeModifier: i % 5 },
      ]),
    ),
    fogEnabled: true,
    defaultVisionRadius: 30,
    playerStagingZone: { x: 4, y: 5, width: 6, height: 4, rotation: 0 },
    mapBackground: undefined,
  };
}

describe("Atlas budgets (A7)", () => {
  it("a campaign at BOTH caps — 64 max-name nodes, 256 links — rides the snapshot under the guard", () => {
    const service = new RoomService({ stateFile: TEST_STATE_FILE });
    buildMaxedAtlas(service);

    const state = service.getState();
    // The handlers really accepted a full atlas (a rejected create would
    // silently shrink the thing being weighed).
    expect(state.atlasNodes).toHaveLength(ATLAS_LIMITS.nodes);
    expect(state.atlasLinks).toHaveLength(ATLAS_LIMITS.links);

    const bytes = wireBytes(service.createSnapshot());
    expect(bytes).toBeLessThan(SNAPSHOT_SIZE_LIMIT_BYTES);
    // Room to spare: the atlas may not eat more than a third of the whole
    // budget, because it SHARES the frame with terrain and the scene.
    expect(bytes).toBeLessThan(SNAPSHOT_SIZE_LIMIT_BYTES / 3);
  });

  it("eight fat suspended scenes never ride the snapshot, and their save-path cost is recorded", () => {
    const service = new RoomService({ stateFile: TEST_STATE_FILE });
    buildMaxedAtlas(service);
    const sceneStates = Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [`suspended-doc-${i}`, fatScene(`suspended-doc-${i}`)]),
    );
    service.setState({ sceneStates });

    // Not one byte of a suspended scene reaches any snapshot.
    const raw = JSON.stringify(service.createSnapshot());
    expect(raw).not.toContain("sceneStates");
    expect(raw).not.toContain("suspended-doc-");

    // The store-extraction trigger, quantified: the whole-state serialization
    // the SYNCHRONOUS save path performs, with the scenes in it.
    const state = service.getState();
    const sceneBytes = wireBytes(sceneStates);
    const start = performance.now();
    const RUNS = 20;
    for (let i = 0; i < RUNS; i++) {
      JSON.stringify(state);
    }
    const msPerSave = (performance.now() - start) / RUNS;
    console.info(
      `[A7 budget] sceneStates: ${sceneBytes} bytes across 8 scenes; ` +
        `full-state JSON.stringify averages ${msPerSave.toFixed(2)}ms over ${RUNS} runs`,
    );
    // The deterministic half of the record: a realistic suspended campaign
    // stays comfortably inside the session file's 1MB ceiling.
    expect(sceneBytes).toBeLessThan(1_000_000);
  });
});
