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
    layers: [layer("shapes", "objects", 10), layer("objects", "objects", 20)],
    elements: [shape, tile, stamp],
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
