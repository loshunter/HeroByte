import { describe, expect, it } from "vitest";
import {
  authoredDoorIdsOf,
  preserveDoorRuntimeStates,
  type CompiledDoor,
  type CompiledScene,
  type MapDoorElement,
  type MapDocument,
  type MapStudioCommand,
  type MapWallElement,
} from "../index.js";

function compiledDoor(
  id: string,
  state: CompiledDoor["state"],
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

function scene(doors: CompiledDoor[]): CompiledScene {
  return {
    schemaVersion: 1,
    sourceDocumentId: "map-1",
    sourceRevision: 3,
    compiledAt: 100,
    width: 2048,
    height: 2048,
    walls: [],
    doors,
    lights: [],
  };
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

function doorElement(id: string): MapDoorElement {
  return {
    id,
    layerId: "walls",
    type: "door",
    locked: false,
    hidden: false,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    data: { width: 40, state: "closed", blocksMovement: true, blocksVision: true },
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

const base = { commandId: "c1", documentId: "map-1", baseRevision: 3 };

describe("preserveDoorRuntimeStates", () => {
  it("carries a door's prior runtime state across a recompile, matched by id", () => {
    const previous = scene([compiledDoor("door-a", "open")]);
    // A recompile from the document rebuilds every door at its AUTHORED state
    // ("closed"); the runtime "open" must survive because a player opened it.
    const next = scene([compiledDoor("door-a", "closed")]);

    const result = preserveDoorRuntimeStates(previous, next, new Set());

    expect(result.doors.map((d) => [d.id, d.state])).toEqual([["door-a", "open"]]);
  });

  it("lets an authored door take the freshly compiled state (the command set it)", () => {
    const previous = scene([compiledDoor("door-a", "open")]);
    const next = scene([compiledDoor("door-a", "locked")]);

    // door-a is in authoredDoorIds — the DM just changed its authored state.
    const result = preserveDoorRuntimeStates(previous, next, new Set(["door-a"]));

    expect(result.doors[0]!.state).toBe("locked");
  });

  it("drops doors removed from the document (only next's doors survive)", () => {
    const previous = scene([compiledDoor("door-a", "open"), compiledDoor("door-b", "closed")]);
    const next = scene([compiledDoor("door-a", "closed")]);

    const result = preserveDoorRuntimeStates(previous, next, new Set());

    expect(result.doors.map((d) => d.id)).toEqual(["door-a"]);
  });

  it("keeps a newly added door at its authored state (no prior to inherit)", () => {
    const previous = scene([compiledDoor("door-a", "open")]);
    const next = scene([compiledDoor("door-a", "closed"), compiledDoor("door-b", "secret")]);

    const result = preserveDoorRuntimeStates(previous, next, new Set(["door-b"]));

    expect(result.doors.map((d) => [d.id, d.state])).toEqual([
      ["door-a", "open"],
      ["door-b", "secret"],
    ]);
  });

  it("preserves every runtime state across an undo (authors nothing)", () => {
    const previous = scene([compiledDoor("door-a", "open"), compiledDoor("door-b", "locked")]);
    const next = scene([compiledDoor("door-a", "closed"), compiledDoor("door-b", "closed")]);

    // Undo carries no authored door ids, so both runtime states survive.
    const result = preserveDoorRuntimeStates(previous, next, new Set());

    expect(result.doors.map((d) => [d.id, d.state])).toEqual([
      ["door-a", "open"],
      ["door-b", "locked"],
    ]);
  });

  it("returns next unchanged when there is no previous scene", () => {
    const next = scene([compiledDoor("door-a", "closed")]);
    expect(preserveDoorRuntimeStates(undefined, next, new Set())).toBe(next);
  });

  it("does not mutate the previous scene's doors", () => {
    const previous = scene([compiledDoor("door-a", "open")]);
    const next = scene([compiledDoor("door-a", "closed")]);

    preserveDoorRuntimeStates(previous, next, new Set());

    expect(previous.doors[0]!.state).toBe("open");
  });
});

describe("authoredDoorIdsOf", () => {
  it("marks a door added via add-element", () => {
    const document = documentWithElements([doorElement("door-a")]);
    const command: MapStudioCommand = {
      ...base,
      type: "add-element",
      element: doorElement("door-a"),
    };
    expect([...authoredDoorIdsOf(command, document)]).toEqual(["door-a"]);
  });

  it("ignores a non-door added via add-element", () => {
    const document = documentWithElements([wallElement("wall-a")]);
    const command: MapStudioCommand = {
      ...base,
      type: "add-element",
      element: wallElement("wall-a"),
    };
    expect(authoredDoorIdsOf(command, document).size).toBe(0);
  });

  it("marks only the door-type elements in an add-elements batch", () => {
    const document = documentWithElements([wallElement("wall-a"), doorElement("door-a")]);
    const command: MapStudioCommand = {
      ...base,
      type: "add-elements",
      elements: [wallElement("wall-a"), doorElement("door-a")],
    };
    expect([...authoredDoorIdsOf(command, document)]).toEqual(["door-a"]);
  });

  it("marks the target of update-door when the document element is a door", () => {
    const document = documentWithElements([doorElement("door-a")]);
    const command: MapStudioCommand = {
      ...base,
      type: "update-door",
      elementId: "door-a",
      state: "locked",
      width: 40,
    };
    expect([...authoredDoorIdsOf(command, document)]).toEqual(["door-a"]);
  });

  it("does not mark an update-door id that is not a door in the document", () => {
    const document = documentWithElements([wallElement("wall-a")]);
    const command: MapStudioCommand = {
      ...base,
      type: "update-door",
      elementId: "wall-a",
      state: "locked",
      width: 40,
    };
    expect(authoredDoorIdsOf(command, document).size).toBe(0);
  });

  it("authors no doors for undo, redo, or terrain commands", () => {
    const document = documentWithElements([doorElement("door-a")]);
    const undo: MapStudioCommand = { ...base, type: "undo" };
    const redo: MapStudioCommand = { ...base, type: "redo" };
    const paint: MapStudioCommand = {
      ...base,
      type: "paint-terrain",
      cells: [{ x: 0, y: 0, assetId: "terrain:grass" }],
    };
    expect(authoredDoorIdsOf(undo, document).size).toBe(0);
    expect(authoredDoorIdsOf(redo, document).size).toBe(0);
    expect(authoredDoorIdsOf(paint, document).size).toBe(0);
  });
});
