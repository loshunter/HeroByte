import { describe, it, expect } from "vitest";
import type { MapDocument, MapElement, MapLayer } from "@herobyte/shared";
import { elementSelectionRect, selectElementAtPoint } from "../elementHitTest";

function layer(id: string, kind: MapLayer["kind"], zIndex: number): MapLayer {
  return { id, name: id, kind, visible: true, locked: false, opacity: 1, zIndex };
}

const tile: MapElement = {
  id: "tile1",
  layerId: "objects",
  type: "tile",
  locked: false,
  hidden: false,
  transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0 },
  data: { assetId: "objects:crate", columns: 1, rows: 1 },
};
const stamp: MapElement = {
  id: "stamp1",
  layerId: "objects",
  type: "stamp",
  locked: false,
  hidden: false,
  transform: { x: 300, y: 300, scaleX: 1, scaleY: 1, rotation: 90 },
  data: { assetId: "objects:crate", width: 100, height: 50 },
};
const shape: MapElement = {
  id: "shape1",
  layerId: "shapes",
  type: "shape",
  locked: false,
  hidden: false,
  transform: { x: 500, y: 500, scaleX: 1, scaleY: 1, rotation: 0 },
  data: {
    shape: "rectangle",
    points: [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
    ],
    stroke: "#fff",
    strokeWidth: 4,
    opacity: 1,
  },
};

/**
 * A wall from (1000,1000) to (1200,1000) in DOCUMENT space — expressed as local
 * points plus a transform, which is how walls really are stored. A hit test
 * reading `data.points` as document coordinates passes every test built on an
 * element at the origin and fails on this one.
 */
const wall: MapElement = {
  id: "wall1",
  layerId: "walls",
  type: "wall",
  locked: false,
  hidden: false,
  transform: { x: 1000, y: 1000, scaleX: 1, scaleY: 1, rotation: 0 },
  data: {
    points: [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    ],
    blocksMovement: true,
    blocksVision: true,
  },
};
/** A door ON that wall: width 60 centred at (1100,1000), so they overlap. */
const door: MapElement = {
  id: "door1",
  layerId: "walls",
  type: "door",
  locked: false,
  hidden: false,
  transform: { x: 1100, y: 1000, scaleX: 1, scaleY: 1, rotation: 0 },
  data: { width: 60, state: "closed", blocksMovement: true, blocksVision: false },
};
/** A light with a HUGE radius, to prove the radius is not the grab handle. */
const light: MapElement = {
  id: "light1",
  layerId: "walls",
  type: "light",
  locked: false,
  hidden: false,
  transform: { x: 4000, y: 4000, scaleX: 1, scaleY: 1, rotation: 0 },
  data: { radius: 5000, color: "#fff", intensity: 1, castsShadows: true },
};
/** A rotated spline, so the transform is doing real work. */
const spline: MapElement = {
  id: "spline1",
  layerId: "walls",
  type: "spline",
  locked: false,
  hidden: false,
  transform: { x: 3000, y: 3000, scaleX: 1, scaleY: 1, rotation: 90 },
  data: {
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    kind: "rope",
  },
};

function makeDocument(): MapDocument {
  return {
    schemaVersion: 1,
    id: "live",
    name: "Live",
    width: 8192,
    height: 8192,
    grid: {
      type: "square",
      size: 50,
      squareSize: 5,
      offsetX: 0,
      offsetY: 0,
      visible: true,
      snap: true,
    },
    layers: [
      layer("shapes", "objects", 10),
      layer("objects", "objects", 20),
      layer("walls", "walls", 30),
    ],
    elements: [shape, tile, stamp, wall, door, light, spline],
    revision: 1,
    createdAt: 1,
    updatedAt: 1,
  };
}

const layers = new Map(makeDocument().layers.map((l) => [l.id, l]));

describe("selectElementAtPoint", () => {
  it("picks a tile under the cursor", () => {
    expect(selectElementAtPoint(makeDocument(), layers, { x: 120, y: 120 })?.id).toBe("tile1");
  });

  it("picks a rotated stamp at its center (rotation-invariant point)", () => {
    // stamp at (300,300) w100 h50 → center (350,325); rotation pivots there.
    expect(selectElementAtPoint(makeDocument(), layers, { x: 350, y: 325 })?.id).toBe("stamp1");
  });

  it("picks a shape by its bounds when no tile/stamp is on top", () => {
    expect(selectElementAtPoint(makeDocument(), layers, { x: 520, y: 520 })?.id).toBe("shape1");
  });

  it("returns null over empty canvas", () => {
    expect(selectElementAtPoint(makeDocument(), layers, { x: 2000, y: 2000 })).toBeNull();
  });

  it("skips elements on a hidden layer", () => {
    const doc = makeDocument();
    doc.layers = [
      layer("shapes", "objects", 10),
      { ...layer("objects", "objects", 20), visible: false },
    ];
    const hiddenLayers = new Map(doc.layers.map((l) => [l.id, l]));
    expect(selectElementAtPoint(doc, hiddenLayers, { x: 120, y: 120 })).toBeNull();
  });
});

describe("elementSelectionRect", () => {
  it("sizes a tile by its grid footprint and pivots about its center", () => {
    expect(elementSelectionRect(tile, 50)).toEqual({
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      rotation: 0,
      pivotX: 25,
      pivotY: 25,
    });
  });

  it("carries a stamp's footprint and rotation, pivoting about its center", () => {
    expect(elementSelectionRect(stamp, 50)).toEqual({
      x: 300,
      y: 300,
      width: 100,
      height: 50,
      rotation: 90,
      pivotX: 50,
      pivotY: 25,
    });
  });

  it("bounds a shape from its points and pivots about the transform origin", () => {
    expect(elementSelectionRect(shape, 50)).toEqual({
      x: 500,
      y: 500,
      width: 50,
      height: 50,
      rotation: 0,
      pivotX: 0,
      pivotY: 0,
    });
  });

  it("pivots a shape offset from its origin about that origin, not the box corner", () => {
    // Points start at (20,10), so the bounds box sits 20/10 px past the origin;
    // the pivot offset is negative, placing the rotation center back at (500,500).
    const offsetShape: MapElement = {
      ...shape,
      data: {
        ...shape.data,
        points: [
          { x: 20, y: 10 },
          { x: 60, y: 40 },
        ],
      },
    };
    expect(elementSelectionRect(offsetShape, 50)).toEqual({
      x: 520,
      y: 510,
      width: 40,
      height: 30,
      rotation: 0,
      pivotX: -20,
      pivotY: -10,
    });
  });

  it("returns null for a wall (not selectable via the rect)", () => {
    const wall: MapElement = {
      id: "w",
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
    expect(elementSelectionRect(wall, 50)).toBeNull();
  });
});

/**
 * The five kinds that could not be selected — and therefore could not be
 * deleted — on any platform until proximity hit testing existed.
 *
 * Grid size is 50 in this fixture, so the half-cell tolerance is 25 document
 * units. Every "just outside" case below sits at 30, comfortably past it, so
 * these do not turn red on a tolerance tweak of a unit or two — only on the
 * tolerance being wrong by a lot, or gone.
 */
describe("selectElementAtPoint — kinds with no interior", () => {
  const doc = makeDocument();

  it("picks a WALL from beside it, through its transform", () => {
    // (1010, 1010) is 10 from a wall whose local points are (0,0)-(200,0) and
    // whose transform puts it at y=1000. Reading the points as document
    // coordinates would look for a wall near the ORIGIN and find nothing.
    //
    // Deliberately clear of the door, which spans x 1070-1130: the first draft
    // of this probed x=1050, which is 22 units from the door's end and so
    // inside the 25-unit tolerance. The door won, correctly, and the test was
    // wrong — worth recording, because it is the same arithmetic a DM does by
    // eye when they wonder why they grabbed the wrong thing.
    expect(selectElementAtPoint(doc, layers, { x: 1010, y: 1010 })?.id).toBe("wall1");
  });

  it("does NOT pick a wall from outside the tolerance", () => {
    expect(selectElementAtPoint(doc, layers, { x: 1050, y: 1030 })).toBeNull();
  });

  it("does NOT pick a wall past its END, which distance-to-line would", () => {
    // 300 past the far end but exactly on the infinite line. Without the clamp
    // in distanceToSegment this selects the wall from right across the map.
    expect(selectElementAtPoint(doc, layers, { x: 1500, y: 1000 })).toBeNull();
  });

  it("picks the DOOR where a door overlaps a wall", () => {
    // The tie that bites: both are within tolerance at (1100,1000). Resolving
    // the wall first would mean a DM aiming at a door deletes the wall behind.
    expect(selectElementAtPoint(doc, layers, { x: 1100, y: 1000 })?.id).toBe("door1");
  });

  it("picks the wall again just OUTSIDE the door's span", () => {
    // Proves the door does not simply win everywhere along the wall.
    expect(selectElementAtPoint(doc, layers, { x: 1180, y: 1000 })?.id).toBe("wall1");
  });

  it("picks a LIGHT by a small handle, not by its radius", () => {
    expect(selectElementAtPoint(doc, layers, { x: 4010, y: 4000 })?.id).toBe("light1");
    // radius is 5000 here. If the radius were the grab area, a click a
    // thousand units away — anywhere in the room it lights — would select it.
    expect(selectElementAtPoint(doc, layers, { x: 5000, y: 4000 })?.id).not.toBe("light1");
  });

  it("picks a SPLINE through a rotated transform", () => {
    // Local (0,0)-(100,0) rotated 90° about (3000,3000) runs DOWN, not right.
    // A hit test ignoring rotation looks along the wrong axis entirely.
    expect(selectElementAtPoint(doc, layers, { x: 3000, y: 3050 })?.id).toBe("spline1");
    expect(selectElementAtPoint(doc, layers, { x: 3050, y: 3000 })?.id).not.toBe("spline1");
  });

  it("refuses an element on a HIDDEN layer, exactly as the tile pass does", () => {
    const hidden = makeDocument();
    hidden.layers = hidden.layers.map((l) => (l.id === "walls" ? { ...l, visible: false } : l));
    const hiddenLayers = new Map(hidden.layers.map((l) => [l.id, l]));

    expect(selectElementAtPoint(hidden, hiddenLayers, { x: 1010, y: 1010 })).toBeNull();
  });

  it("still prefers a TILE where one overlaps — the interior pass runs first", () => {
    expect(selectElementAtPoint(doc, layers, { x: 120, y: 120 })?.id).toBe("tile1");
  });
});
