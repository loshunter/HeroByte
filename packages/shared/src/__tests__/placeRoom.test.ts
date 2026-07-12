import { describe, expect, it } from "vitest";
import {
  applyMapDocumentCommand,
  createMapDocument,
  placeRoom,
  type MapDocument,
  type MapWallElement,
} from "../index.js";

const FLOOR = "terrain:wood-floor";

function doc(): MapDocument {
  return createMapDocument({ id: "live", name: "Live Map", timestamp: 1 });
}

// A 2x1 room's floor cells + one closed-rect perimeter wall on the walls layer.
const cells = [
  { x: 0, y: 0, assetId: FLOOR },
  { x: 1, y: 0, assetId: FLOOR },
];

function perimeter(id = "room-wall"): MapWallElement {
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
        { x: 100, y: 50 },
        { x: 0, y: 50 },
        { x: 0, y: 0 },
      ],
      blocksMovement: true,
      blocksVision: true,
    },
  };
}

describe("placeRoom", () => {
  it("paints floor AND adds walls in exactly ONE revision bump (one undo step)", () => {
    const before = doc();
    const after = placeRoom(before, cells, [perimeter()], 2);

    expect(after.revision).toBe(before.revision + 1);
    expect(after.elements.map((e) => e.id)).toEqual(["room-wall"]);
    expect(after.terrain).toBeDefined();
    expect(Object.keys(after.terrain!.chunks).length).toBeGreaterThan(0);
    expect(after.terrain!.palette).toContain(FLOOR);
  });

  it("is all-or-nothing: a locked walls layer aborts BOTH the floor and the walls", () => {
    const base = doc();
    const locked: MapDocument = {
      ...base,
      layers: base.layers.map((l) => (l.kind === "walls" ? { ...l, locked: true } : l)),
    };

    expect(() => placeRoom(locked, cells, [perimeter()], 2)).toThrow();
    // The original document is untouched — no terrain, no elements, same revision.
    expect(locked.terrain).toBeUndefined();
    expect(locked.elements).toEqual([]);
    expect(locked.revision).toBe(base.revision);
  });

  it("flows through the command dispatcher as a single-revision place-room command", () => {
    const before = doc();
    const result = applyMapDocumentCommand(
      before,
      {
        commandId: "c1",
        documentId: "live",
        baseRevision: before.revision,
        type: "place-room",
        cells,
        elements: [perimeter()],
      },
      2,
    );

    expect(result.revision).toBe(before.revision + 1);
    expect(result.document.elements).toHaveLength(1);
    expect(result.document.terrain).toBeDefined();
  });

  it("rejects an empty floor (paint core requires at least one cell)", () => {
    expect(() => placeRoom(doc(), [], [perimeter()], 2)).toThrow();
  });
});
