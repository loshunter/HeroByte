// ============================================================================
// ATLAS STATE — load-path normalization tests
// ============================================================================
// One helper guards three load paths (disk, Redis hydrate, snapshot merge)
// against the poisoned-non-array class that kills the process inside the
// debounced broadcast timer. `?? []` is NOT equivalent — `{}` is truthy AND
// non-nullish, which is exactly how the chatLog crash recurred on restart.

import { describe, expect, it, vi } from "vitest";
import type { SceneState } from "@herobyte/shared";
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
