// ============================================================================
// ATLAS STATE — load-path normalization tests
// ============================================================================
// One helper guards three load paths (disk, Redis hydrate, snapshot merge)
// against the poisoned-non-array class that kills the process inside the
// debounced broadcast timer. `?? []` is NOT equivalent — `{}` is truthy AND
// non-nullish, which is exactly how the chatLog crash recurred on restart.

import { describe, expect, it, vi } from "vitest";
import { presetFrame, type SceneState } from "@herobyte/shared";
import { normalizeAtlasState, sceneStatesFromEnvelope } from "../atlasState.js";

function scene(mapDocumentId: string): SceneState {
  return {
    mapDocumentId,
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
}

describe("normalizeAtlasState", () => {
  it("reads absent keys as empties (file-authoritative, never 'preserved')", () => {
    expect(normalizeAtlasState({})).toEqual({ atlasNodes: [], atlasLinks: [], sceneStates: {} });
  });

  it("disarms the poisoned shapes `?? []` would keep", () => {
    const result = normalizeAtlasState({
      atlasNodes: {}, // truthy, non-nullish, not an array — the chatLog crash shape
      atlasLinks: "poison",
      sceneStates: [], // an ARRAY is not a record here
    });
    expect(result).toEqual({ atlasNodes: [], atlasLinks: [], sceneStates: {} });
  });

  it("drops a link whose anchor cannot be dereferenced — the one inner field the broadcast path reads", () => {
    // projectAtlasFor builds `{ x: link.anchor.x, … }` for players; an
    // anchor-less link surviving normalize is a TypeError inside the debounced
    // broadcast timer, persisted into a crash-on-every-restart loop.
    const result = normalizeAtlasState({
      atlasLinks: [
        { id: "good", fromNodeId: "a", toNodeId: "b", anchor: { x: 1, y: 2 } },
        { id: "no-anchor", fromNodeId: "a", toNodeId: "b", visibleToPlayers: true },
        { id: "poison-anchor", fromNodeId: "a", toNodeId: "b", anchor: "nope" },
        { id: "nan-anchor", fromNodeId: "a", toNodeId: "b", anchor: { x: Number.NaN, y: 2 } },
      ],
    });
    expect(result.atlasLinks.map((link) => link.id)).toEqual(["good"]);
  });

  it("drops primitive entries from arrays and non-record values from the scene map", () => {
    const good = scene("doc-a");
    const result = normalizeAtlasState({
      atlasNodes: [{ id: "a" }, 42, null, "x"],
      // The surviving link must carry an anchor — anchor-less records are the
      // separate broadcast-crash class the dedicated test above covers.
      atlasLinks: [null, { id: "l", anchor: { x: 0, y: 0 } }],
      sceneStates: { "doc-a": good, "doc-b": 7, "doc-c": null },
    });
    expect(result.atlasNodes).toEqual([{ id: "a" }]);
    expect(result.atlasLinks).toEqual([{ id: "l", anchor: { x: 0, y: 0 } }]);
    expect(Object.keys(result.sceneStates)).toEqual(["doc-a"]);
  });
});

describe("normalizeAtlasState — scenes take the envelope's schema at the disk boundary", () => {
  it("drops a half-shaped scene (travel would throw MID-MUTATION on it) and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = normalizeAtlasState({
        sceneStates: {
          "doc-a": scene("doc-a"),
          "doc-b": { mapDocumentId: "doc-b" }, // no tokens, no doorStates — restore dereferences both
          "doc-c": { ...scene("doc-c"), tokens: {} }, // a collection that is not an array
        },
      });
      expect(Object.keys(result.sceneStates)).toEqual(["doc-a"]);
      expect(warn).toHaveBeenCalledTimes(2);
    } finally {
      warn.mockRestore();
    }
  });

  it("keeps a scene grown past a backup's limits: a restart must not delete it", () => {
    // Captured as the party leaves, with no cap. Dropped here, it vanished on the next
    // deploy; kept, Download table backup refuses and names it so the DM can clear it.
    const big = {
      ...scene("cellar"),
      tokens: Array.from({ length: 1001 }, (_, n) => ({ id: `t-${n}` })),
    };
    expect(normalizeAtlasState({ sceneStates: { cellar: big } }).sceneStates.cellar).toBe(big);
  });

  it("keeps a newer server's extra fields — the schema validates, it does not strip", () => {
    const future = { ...scene("doc-a"), weatherLater: "storm" };
    const result = normalizeAtlasState({ sceneStates: { "doc-a": future } });
    expect(result.sceneStates["doc-a"]).toBe(future);
  });
});

describe("sceneStatesFromEnvelope", () => {
  it("keys scenes by document id and drops orphans whose document was not restored", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const result = sceneStatesFromEnvelope(
        [scene("doc-a"), scene("doc-gone")],
        (documentId) => documentId === "doc-a",
      );
      expect(Object.keys(result)).toEqual(["doc-a"]);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("doc-gone"));
    } finally {
      warn.mockRestore();
    }
  });

  it("tolerates an absent envelope and entries with no usable key", () => {
    expect(sceneStatesFromEnvelope(undefined, () => true)).toEqual({});
    const noKey = { ...scene("doc-a"), mapDocumentId: "" };
    expect(sceneStatesFromEnvelope([noKey], () => true)).toEqual({});
  });
});

describe("tokens parked on another map (C5a)", () => {
  const parked = (frame: unknown) => ({
    ...scene("doc-p"),
    tokens: [
      { id: "keep", owner: "p", x: 0, y: 0, color: "#336699", frame: presetFrame("stone.castle") },
      { id: "junk", owner: "p", x: 1, y: 0, color: "#336699", frame },
    ],
  });

  it("are checked like the live ones off disk: a frame no client could draw is dropped", () => {
    const { sceneStates } = normalizeAtlasState({ sceneStates: { "doc-p": parked({ bands: 3 }) } });
    const [keep, junk] = sceneStates["doc-p"]!.tokens;
    expect(keep!.frame).toEqual(presetFrame("stone.castle"));
    expect(junk).not.toHaveProperty("frame");
  });

  it("and out of a load-session envelope", () => {
    const poisoned = parked({
      bands: [{ generator: "plain", palette: "constructor", weight: 0.1 }],
    });
    const result = sceneStatesFromEnvelope([poisoned as SceneState], () => true);
    expect(result["doc-p"]!.tokens[1]!.frame!.bands[0]).toMatchObject({ palette: "stone.grey" });
  });
});
