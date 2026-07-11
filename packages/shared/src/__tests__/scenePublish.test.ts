import { describe, expect, it } from "vitest";
import {
  authoredDoorStatesOf,
  preserveDoorRuntimeStates,
  type CompiledDoor,
  type CompiledDoorState,
  type CompiledScene,
  type MapDoorElement,
  type MapDoorState,
  type MapDocument,
  type MapWallElement,
} from "../index.js";

function compiledDoor(
  id: string,
  state: CompiledDoorState,
  overrides: Partial<CompiledDoor> = {},
): CompiledDoor {
  return {
    id,
    x1: 0,
    y1: 0,
    x2: 50,
    y2: 0,
    state,
    blocksMovement: true,
    blocksVision: true,
    ...overrides,
  };
}

function scene(doors: CompiledDoor[], sourceDocumentId = "map-1"): CompiledScene {
  return {
    schemaVersion: 1,
    sourceDocumentId,
    sourceRevision: 3,
    compiledAt: 100,
    width: 2048,
    height: 2048,
    walls: [],
    doors,
    lights: [],
  };
}

/** Authored door states keyed by id — the shape authoredDoorStatesOf returns. */
function authored(entries: Record<string, CompiledDoorState>): Map<string, CompiledDoorState> {
  return new Map(Object.entries(entries));
}

function documentWithElements(elements: MapDocument["elements"]): MapDocument {
  return {
    schemaVersion: 1,
    id: "map-1",
    name: "Keep",
    width: 2048,
    height: 2048,
    grid: {
      type: "square",
      size: 50,
      squareSize: 5,
      offsetX: 0,
      offsetY: 0,
      visible: true,
      snap: true,
    },
    layers: [],
    elements,
    revision: 4,
    createdAt: 1,
    updatedAt: 1,
  };
}

function doorElement(id: string, state: MapDoorState = "closed"): MapDoorElement {
  return {
    id,
    layerId: "walls",
    type: "door",
    locked: false,
    hidden: false,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: { width: 40, state, blocksMovement: true, blocksVision: true },
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

describe("preserveDoorRuntimeStates", () => {
  it("carries a door's runtime state when its authored state is unchanged", () => {
    // The recompile rebuilds door-a at authored "closed"; a player opened it, so
    // the unrelated edit (authored state unchanged) must keep it "open".
    const previous = scene([compiledDoor("door-a", "open")]);
    const next = scene([compiledDoor("door-a", "closed")]);

    const result = preserveDoorRuntimeStates(previous, next, authored({ "door-a": "closed" }));

    expect(result.doors.map((d) => [d.id, d.state])).toEqual([["door-a", "open"]]);
  });

  it("lets the freshly authored state win when the edit re-authored the door", () => {
    // DM changed the authored state closed -> locked; the runtime "open" is
    // discarded because the DM's re-authoring is intentional.
    const previous = scene([compiledDoor("door-a", "open")]);
    const next = scene([compiledDoor("door-a", "locked")]);

    const result = preserveDoorRuntimeStates(previous, next, authored({ "door-a": "closed" }));

    expect(result.doors[0]!.state).toBe("locked");
  });

  it("restores a door to secret on undo, discarding the stale runtime state (leak-safe)", () => {
    // Regression (info-leak): a door authored back to "secret" (e.g. by undo)
    // must NOT keep the stale non-secret runtime state, or the disguise breaks.
    const previous = scene([compiledDoor("door-a", "open")]);
    const next = scene([compiledDoor("door-a", "secret")]);

    // authored-before was "closed"; authored-after is "secret" -> changed.
    const result = preserveDoorRuntimeStates(previous, next, authored({ "door-a": "closed" }));

    expect(result.doors[0]!.state).toBe("secret");
  });

  it("keeps an opened door open across a width-only door edit", () => {
    // Regression: resizing a door (state unchanged) must not slam it shut.
    const previous = scene([compiledDoor("door-a", "open")]);
    const next = scene([compiledDoor("door-a", "closed")]);

    const result = preserveDoorRuntimeStates(previous, next, authored({ "door-a": "closed" }));

    expect(result.doors[0]!.state).toBe("open");
  });

  it("keeps a duplicate/no-op edit from slamming an opened door shut", () => {
    // Regression (dedup replay): the pre-edit document equals the post-edit one,
    // so the authored state matches and the runtime "open" survives.
    const previous = scene([compiledDoor("door-a", "open")]);
    const next = scene([compiledDoor("door-a", "closed")]);

    const result = preserveDoorRuntimeStates(previous, next, authored({ "door-a": "closed" }));

    expect(result.doors[0]!.state).toBe("open");
  });

  it("keeps a newly added door at its authored state (no prior runtime)", () => {
    const previous = scene([compiledDoor("door-a", "open")]);
    const next = scene([compiledDoor("door-a", "closed"), compiledDoor("door-b", "secret")]);

    const result = preserveDoorRuntimeStates(
      previous,
      next,
      authored({ "door-a": "closed" }), // door-b is new: absent from authored-before
    );

    expect(result.doors.map((d) => [d.id, d.state])).toEqual([
      ["door-a", "open"],
      ["door-b", "secret"],
    ]);
  });

  it("drops doors removed from the document (only next's doors survive)", () => {
    const previous = scene([compiledDoor("door-a", "open"), compiledDoor("door-b", "closed")]);
    const next = scene([compiledDoor("door-a", "closed")]);

    const result = preserveDoorRuntimeStates(previous, next, authored({ "door-a": "closed" }));

    expect(result.doors.map((d) => d.id)).toEqual(["door-a"]);
  });

  it("returns next unchanged when there is no previous scene", () => {
    const next = scene([compiledDoor("door-a", "closed")]);
    expect(preserveDoorRuntimeStates(undefined, next, authored({ "door-a": "closed" }))).toBe(next);
  });

  it("does not carry runtime states from a scene compiled from a different document", () => {
    // Regression (cross-document leak): a stray publish left `previous` holding
    // ANOTHER document's scene whose colliding door id is "open"; that must not
    // resurrect this document's secret door as visible.
    const previousFromOtherDoc = scene([compiledDoor("door-a", "open")], "other-doc");
    const next = scene([compiledDoor("door-a", "secret")], "map-1");

    const result = preserveDoorRuntimeStates(
      previousFromOtherDoc,
      next,
      authored({ "door-a": "secret" }),
    );

    expect(result.doors[0]!.state).toBe("secret");
  });

  it("does not mutate the previous scene's doors", () => {
    const previous = scene([compiledDoor("door-a", "open")]);
    const next = scene([compiledDoor("door-a", "closed")]);

    preserveDoorRuntimeStates(previous, next, authored({ "door-a": "closed" }));

    expect(previous.doors[0]!.state).toBe("open");
  });
});

describe("authoredDoorStatesOf", () => {
  it("maps each door element id to its authored state", () => {
    const document = documentWithElements([
      doorElement("door-a", "secret"),
      doorElement("door-b", "locked"),
    ]);
    expect([...authoredDoorStatesOf(document)]).toEqual([
      ["door-a", "secret"],
      ["door-b", "locked"],
    ]);
  });

  it("ignores non-door elements", () => {
    const document = documentWithElements([wallElement("wall-a"), doorElement("door-a")]);
    expect([...authoredDoorStatesOf(document)]).toEqual([["door-a", "closed"]]);
  });

  it("returns an empty map for a document with no doors", () => {
    expect(authoredDoorStatesOf(documentWithElements([wallElement("wall-a")])).size).toBe(0);
  });

  it("round-trips with preserveDoorRuntimeStates: undo to secret re-disguises", () => {
    // The pre-edit document authored door-a "closed"; the post-undo document
    // authored it "secret". A player had toggled it open at runtime.
    const preEdit = documentWithElements([doorElement("door-a", "closed")]);
    const previousScene = scene([compiledDoor("door-a", "open")]);
    const postUndo = scene([compiledDoor("door-a", "secret")]);

    const result = preserveDoorRuntimeStates(
      previousScene,
      postUndo,
      authoredDoorStatesOf(preEdit),
    );

    expect(result.doors[0]!.state).toBe("secret");
  });
});
