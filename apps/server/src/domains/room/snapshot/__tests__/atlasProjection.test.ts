// ============================================================================
// ATLAS PROJECTION — unit tests for the discovered-only whitelist
// ============================================================================
// The projection is a WHITELIST CONSTRUCTOR, so these tests pin the player
// shapes' EXACT KEY SETS: a field added to AtlasNode/MapLink later fails here
// by name before it can leak (the capture-completeness pattern applied to
// privacy).

import { describe, expect, it } from "vitest";
import type { AtlasNode, MapLink } from "@herobyte/shared";
import { createEmptyRoomState, toSnapshot, type RoomState } from "../../model.js";
import { projectAtlasFor } from "../atlasProjection.js";

function node(id: string, overrides: Partial<AtlasNode> = {}): AtlasNode {
  return {
    id,
    kind: "dungeon",
    name: `node-${id}`,
    discovered: false,
    createdAt: 111,
    updatedAt: 222,
    ...overrides,
  };
}

function link(id: string, overrides: Partial<MapLink> = {}): MapLink {
  return {
    id,
    fromNodeId: "a",
    toNodeId: "b",
    anchor: { x: 100, y: 200 },
    linkType: "door",
    visibleToPlayers: true,
    ...overrides,
  };
}

function stateWith(overrides: Partial<RoomState>): RoomState {
  return { ...createEmptyRoomState(), ...overrides };
}

describe("projectAtlasFor", () => {
  it("passes the DM the whole graph, provenance included", () => {
    const state = stateWith({
      atlasNodes: [
        node("a", {
          discovered: true,
          mapDocumentId: "doc-a",
          recipe: { recipeId: "dungeon", seed: 42, theme: "stone", density: "medium" },
        }),
        node("b"),
      ],
      atlasLinks: [link("l1")],
    });
    const view = projectAtlasFor(state, true);
    expect(view.atlasNodes).toHaveLength(2);
    expect(view.atlasNodes[0]).toBe(state.atlasNodes[0]); // whole records, not copies
    expect(view.atlasLinks).toHaveLength(1);
  });

  it("gives players ONLY discovered nodes, with the exact whitelist key set", () => {
    const state = stateWith({
      atlasNodes: [
        node("a", {
          discovered: true,
          mapDocumentId: "doc-a",
          recipe: { recipeId: "dungeon", seed: 987654321987, theme: "stone", density: "high" },
        }),
        node("hidden"),
      ],
    });
    const view = projectAtlasFor(state, false);
    expect(view.atlasNodes).toHaveLength(1);
    // The EXACT key set: recipe, mapDocumentId, createdAt, updatedAt must not
    // exist as keys at all — a redaction to undefined would still leak the key.
    expect(Object.keys(view.atlasNodes[0]!).sort()).toEqual(["discovered", "id", "kind", "name"]);
    expect(view.atlasNodes[0]).toEqual({
      id: "a",
      kind: "dungeon",
      name: "node-a",
      discovered: true,
    });
  });

  it("keeps parentId only when the parent itself is discovered", () => {
    const state = stateWith({
      atlasNodes: [
        node("root", { discovered: true }),
        node("shown-child", { discovered: true, parentId: "root" }),
        node("orphan-child", { discovered: true, parentId: "hidden-parent" }),
        node("hidden-parent"),
      ],
    });
    const view = projectAtlasFor(state, false);
    const shown = view.atlasNodes.find((entry) => entry.id === "shown-child");
    const orphan = view.atlasNodes.find((entry) => entry.id === "orphan-child");
    expect(shown?.parentId).toBe("root");
    expect(Object.keys(shown!).sort()).toEqual(["discovered", "id", "kind", "name", "parentId"]);
    // The hidden parent's existence leaks nothing — not even a dangling id.
    expect(orphan).toBeDefined();
    expect("parentId" in orphan!).toBe(false);
  });

  it("filters links to visible+discovered-from, blanking toNodeId for undiscovered targets", () => {
    const state = stateWith({
      atlasNodes: [node("a", { discovered: true }), node("b"), node("c", { discovered: true })],
      atlasLinks: [
        link("to-hidden", { fromNodeId: "a", toNodeId: "b" }),
        link("to-shown", { fromNodeId: "a", toNodeId: "c" }),
        link("dm-only", { fromNodeId: "a", toNodeId: "c", visibleToPlayers: false }),
        link("from-hidden", { fromNodeId: "b", toNodeId: "a" }),
      ],
    });
    const view = projectAtlasFor(state, false);
    expect(view.atlasLinks.map((entry) => entry.id).sort()).toEqual(["to-hidden", "to-shown"]);

    const toHidden = view.atlasLinks.find((entry) => entry.id === "to-hidden")!;
    // The sprite renders without knowing where it leads — and visibleToPlayers
    // is a tautological byte the projection drops.
    expect(Object.keys(toHidden).sort()).toEqual(["anchor", "fromNodeId", "id", "linkType"]);

    const toShown = view.atlasLinks.find((entry) => entry.id === "to-shown")!;
    expect(toShown.toNodeId).toBe("c");
    expect(Object.keys(toShown).sort()).toEqual([
      "anchor",
      "fromNodeId",
      "id",
      "linkType",
      "toNodeId",
    ]);
  });

  it("derives currentAtlasNodeId for the DM, and for players only when discovered", () => {
    const state = stateWith({
      atlasNodes: [node("here", { mapDocumentId: "doc-live" })],
      liveMapDocumentId: "doc-live",
    });
    expect(projectAtlasFor(state, true).currentAtlasNodeId).toBe("here");
    // Undiscovered current node: the deliberately mysterious frame.
    expect(projectAtlasFor(state, false).currentAtlasNodeId).toBeUndefined();

    state.atlasNodes[0]!.discovered = true;
    expect(projectAtlasFor(state, false).currentAtlasNodeId).toBe("here");
  });

  it("disarms a poisoned non-array instead of walking it (broadcast-timer safety)", () => {
    const state = stateWith({});
    (state as unknown as { atlasNodes: unknown }).atlasNodes = {};
    (state as unknown as { atlasLinks: unknown }).atlasLinks = "nope";
    const view = projectAtlasFor(state, false);
    expect(view.atlasNodes).toEqual([]);
    expect(view.atlasLinks).toEqual([]);
  });
});

describe("toSnapshot atlas carriage", () => {
  it("omits every atlas key from a pre-Atlas-shaped room, for both roles", () => {
    const state = stateWith({});
    for (const isDM of [true, false]) {
      const snapshot = toSnapshot(state, isDM, isDM ? "dm" : "watcher");
      expect("atlasNodes" in snapshot).toBe(false);
      expect("atlasLinks" in snapshot).toBe(false);
      expect("currentAtlasNodeId" in snapshot).toBe(false);
    }
  });

  it("omits atlas keys PER RECIPIENT: a DM sees the graph while an all-undiscovered player gets no keys at all", () => {
    const state = stateWith({
      atlasNodes: [node("a"), node("b", { parentId: "a" })],
      atlasLinks: [link("l1", { fromNodeId: "a", toNodeId: "b" })],
    });
    const dmSnapshot = toSnapshot(state, true, "dm");
    expect(dmSnapshot.atlasNodes).toHaveLength(2);

    // An `[]` would itself announce "there is an atlas you haven't seen".
    const playerSnapshot = toSnapshot(state, false, "watcher");
    expect("atlasNodes" in playerSnapshot).toBe(false);
    expect("atlasLinks" in playerSnapshot).toBe(false);
  });

  it("NEVER carries sceneStates, for any recipient — they exist on the wire nowhere", () => {
    const state = stateWith({
      sceneStates: {
        "doc-x": {
          mapDocumentId: "doc-x",
          suspendedAt: 1,
          tokens: [],
          props: [],
          drawings: [],
          sceneObjects: [],
          characterLinks: {},
          doorStates: {},
          combatActive: false,
          initiatives: {},
          fogEnabled: true,
          defaultVisionRadius: null,
        },
      },
    });
    for (const isDM of [true, false]) {
      const snapshot = toSnapshot(state, isDM, isDM ? "dm" : "watcher");
      expect("sceneStates" in snapshot).toBe(false);
      expect(JSON.stringify(snapshot)).not.toContain("sceneStates");
    }
  });
});
