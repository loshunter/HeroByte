import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAP_LAYERS,
  MAP_DOCUMENT_SCHEMA_VERSION,
  addMapElement,
  addMapLayer,
  createMapDocument,
  getVisibleMapElements,
  moveMapLayer,
  removeMapElement,
  removeMapLayer,
  updateMapElement,
  updateMapGrid,
  updateMapLayer,
  type CreateMapDocumentInput,
  type MapDocument,
  type MapElementTransform,
  type MapLayer,
  type MapStampElement,
} from "../mapStudio.js";

const transform: MapElementTransform = {
  x: 10,
  y: 20,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
};

function createDocument(overrides: Partial<CreateMapDocumentInput> = {}): MapDocument {
  return createMapDocument({ id: "map-1", name: "The Keep", timestamp: 100, ...overrides });
}

function createLayer(overrides: Partial<MapLayer> = {}): MapLayer {
  return {
    id: "weather",
    name: "Weather",
    kind: "objects",
    visible: true,
    locked: false,
    opacity: 1,
    zIndex: 60,
    ...overrides,
  };
}

function createStamp(overrides: Partial<MapStampElement> = {}): MapStampElement {
  return {
    id: "stamp-1",
    layerId: "objects",
    type: "stamp",
    locked: false,
    hidden: false,
    transform: { ...transform },
    data: { assetId: "asset:barrel", width: 50, height: 50 },
    ...overrides,
  };
}

describe("Map Studio document", () => {
  it("creates a versioned document with authoring layers", () => {
    const document = createDocument();

    expect(document).toMatchObject({
      schemaVersion: MAP_DOCUMENT_SCHEMA_VERSION,
      id: "map-1",
      name: "The Keep",
      width: 2048,
      height: 2048,
      revision: 0,
      createdAt: 100,
      updatedAt: 100,
      grid: {
        type: "square",
        size: 50,
        squareSize: 5,
        offsetX: 0,
        offsetY: 0,
        visible: true,
        snap: true,
      },
    });
    expect(document.layers.map((layer) => layer.id)).toEqual([
      "background",
      "terrain",
      "objects",
      "walls",
      "lighting",
      "notes",
    ]);
    expect(document.elements).toEqual([]);
  });

  it("accepts custom dimensions and grid settings", () => {
    const document = createDocument({
      width: 4096,
      height: 1024,
      grid: { type: "isometric", size: 64, squareSize: 10, offsetX: 4, snap: false },
    });

    expect(document.width).toBe(4096);
    expect(document.height).toBe(1024);
    expect(document.grid).toMatchObject({
      type: "isometric",
      size: 64,
      squareSize: 10,
      offsetX: 4,
      offsetY: 0,
      visible: true,
      snap: false,
    });
  });

  it("trims identity fields and clones default layers", () => {
    const document = createMapDocument({ id: " map ", name: " Keep ", timestamp: 1 });
    document.layers[0]!.name = "Changed";

    expect(document.id).toBe("map");
    expect(document.name).toBe("Keep");
    expect(DEFAULT_MAP_LAYERS[0]!.name).toBe("Background");
  });

  it.each([
    [{ id: " ", name: "Map" }, "Map document id is required"],
    [{ id: "map", name: " " }, "Map document name is required"],
    [{ id: "map", name: "Map", width: 0 }, "Map document width must be greater than zero"],
    [{ id: "map", name: "Map", height: -1 }, "Map document height must be greater than zero"],
    [{ id: "map", name: "Map", grid: { size: 0 } }, "Grid size must be greater than zero"],
    [
      { id: "map", name: "Map", grid: { squareSize: Number.NaN } },
      "Grid square size must be a finite number",
    ],
    [
      { id: "map", name: "Map", grid: { offsetX: Number.POSITIVE_INFINITY } },
      "Grid X offset must be a finite number",
    ],
    [
      { id: "map", name: "Map", grid: { offsetY: Number.NaN } },
      "Grid Y offset must be a finite number",
    ],
  ])("rejects invalid document input %#", (input, message) => {
    expect(() => createMapDocument(input as CreateMapDocumentInput)).toThrow(message as string);
  });
});

describe("Map Studio layers", () => {
  it("adds and updates a custom layer immutably", () => {
    const original = createDocument();
    const added = addMapLayer(original, createLayer(), 200);
    const updated = updateMapLayer(
      added,
      "weather",
      { name: " Rain ", opacity: 0.4, visible: false, locked: true },
      300,
    );

    expect(original.layers).toHaveLength(6);
    expect(added.layers).toHaveLength(7);
    expect(updated.layers.at(-1)).toMatchObject({
      id: "weather",
      name: "Rain",
      opacity: 0.4,
      visible: false,
      locked: true,
      kind: "objects",
      zIndex: 60,
    });
    expect(updated.revision).toBe(2);
    expect(updated.updatedAt).toBe(300);
  });

  it("moves a layer and normalizes all z-index values", () => {
    const document = addMapLayer(createDocument(), createLayer(), 200);
    const moved = moveMapLayer(document, "weather", 1, 300);

    expect(moved.layers.map((layer) => layer.id)).toEqual([
      "background",
      "weather",
      "terrain",
      "objects",
      "walls",
      "lighting",
      "notes",
    ]);
    expect(moved.layers.map((layer) => layer.zIndex)).toEqual([0, 10, 20, 30, 40, 50, 60]);
  });

  it("removes a custom layer and its elements", () => {
    let document = addMapLayer(createDocument(), createLayer(), 200);
    document = addMapElement(document, createStamp({ layerId: "weather" }), 300);
    const removed = removeMapLayer(document, "weather", 400);

    expect(removed.layers.some((layer) => layer.id === "weather")).toBe(false);
    expect(removed.elements).toEqual([]);
  });

  it.each([
    [() => addMapLayer(createDocument(), createLayer({ id: "objects" })), "already exists"],
    [() => addMapLayer(createDocument(), createLayer({ id: " " })), "Map layer id is required"],
    [() => addMapLayer(createDocument(), createLayer({ name: " " })), "Map layer name is required"],
    [() => addMapLayer(createDocument(), createLayer({ opacity: -0.1 })), "between 0 and 1"],
    [() => addMapLayer(createDocument(), createLayer({ opacity: Number.NaN })), "finite number"],
    [() => addMapLayer(createDocument(), createLayer({ zIndex: Number.NaN })), "finite number"],
    [() => updateMapLayer(createDocument(), "missing", {}), "Unknown map layer"],
    [() => moveMapLayer(createDocument(), "objects", -1), "out of range"],
    [() => moveMapLayer(createDocument(), "objects", 6), "out of range"],
    [() => moveMapLayer(createDocument(), "missing", 0), "Unknown map layer"],
    [() => removeMapLayer(createDocument(), "objects"), "cannot be removed"],
    [() => removeMapLayer(createDocument(), "missing"), "Unknown map layer"],
  ])("guards invalid layer operation %#", (operation, message) => {
    expect(operation).toThrow(message as string);
  });
});

describe("Map Studio grid", () => {
  it("updates grid settings immutably and advances the revision", () => {
    const original = createDocument();
    const updated = updateMapGrid(
      original,
      { type: "hex-row", size: 72, squareSize: 10, offsetX: 4, visible: false },
      200,
    );

    expect(original.grid).toMatchObject({ type: "square", size: 50, visible: true });
    expect(updated.grid).toMatchObject({
      type: "hex-row",
      size: 72,
      squareSize: 10,
      offsetX: 4,
      offsetY: 0,
      visible: false,
      snap: true,
    });
    expect(updated).toMatchObject({ revision: 1, updatedAt: 200 });
  });

  it.each([
    [{ size: 0 }, "Grid size must be greater than zero"],
    [{ squareSize: Number.NaN }, "Grid square size must be a finite number"],
    [{ offsetX: Number.POSITIVE_INFINITY }, "Grid X offset must be a finite number"],
    [{ type: "triangle" }, "Unsupported grid type"],
  ])("rejects invalid grid update %#", (update, message) => {
    expect(() => updateMapGrid(createDocument(), update as never)).toThrow(message as string);
  });
});

describe("Map Studio elements", () => {
  it("adds, moves, and removes an element without mutating earlier revisions", () => {
    const source = createStamp();
    const original = createDocument();
    const added = addMapElement(original, source, 200);
    source.transform.x = 999;
    source.data.width = 999;

    const updated = updateMapElement(
      added,
      "stamp-1",
      { transform: { ...transform, x: 75 }, hidden: true },
      300,
    );
    const removed = removeMapElement(updated, "stamp-1", 400);

    expect(original.elements).toEqual([]);
    expect(added.elements[0]).toMatchObject({ transform: { x: 10 }, data: { width: 50 } });
    expect(updated.elements[0]).toMatchObject({ transform: { x: 75 }, hidden: true });
    expect(removed.elements).toEqual([]);
    expect(removed.revision).toBe(3);
  });

  it("moves an element between editable layers", () => {
    const document = addMapElement(createDocument(), createStamp(), 200);
    const updated = updateMapElement(document, "stamp-1", { layerId: "terrain" }, 300);
    expect(updated.elements[0]!.layerId).toBe("terrain");
  });

  it("enforces element and source-layer locks", () => {
    const lockedElement = addMapElement(createDocument(), createStamp({ locked: true }), 200);
    expect(() => updateMapElement(lockedElement, "stamp-1", { hidden: true })).toThrow(
      "Map element is locked",
    );
    expect(() => removeMapElement(lockedElement, "stamp-1")).toThrow("Map element is locked");
    expect(updateMapElement(lockedElement, "stamp-1", { locked: false }).elements[0]?.locked).toBe(
      false,
    );

    const onLockedLayer = addMapElement(createDocument(), createStamp(), 200);
    const lockedLayer = updateMapLayer(onLockedLayer, "objects", { locked: true }, 300);
    expect(() => updateMapElement(lockedLayer, "stamp-1", { layerId: "terrain" })).toThrow(
      "Map layer is locked",
    );
  });

  it("returns only elements visible through their layer", () => {
    let document = addMapElement(createDocument(), createStamp(), 200);
    document = addMapElement(document, createStamp({ id: "hidden", hidden: true }), 300);
    expect(getVisibleMapElements(document).map((element) => element.id)).toEqual(["stamp-1"]);

    document = updateMapLayer(document, "objects", { opacity: 0 }, 400);
    expect(getVisibleMapElements(document)).toEqual([]);

    document = updateMapLayer(document, "objects", { opacity: 1, visible: false }, 500);
    expect(getVisibleMapElements(document)).toEqual([]);
  });

  it.each([
    [() => addMapElement(createDocument(), createStamp({ id: " " })), "Map element id is required"],
    [
      () => addMapElement(createDocument(), createStamp({ layerId: "missing" })),
      "Unknown map layer",
    ],
    [
      () => addMapElement(createDocument(), createStamp({ layerId: "background" })),
      "Map layer is locked",
    ],
    [
      () => {
        const document = addMapElement(createDocument(), createStamp());
        return addMapElement(document, createStamp());
      },
      "already exists",
    ],
    [
      () =>
        addMapElement(createDocument(), createStamp({ transform: { ...transform, scaleX: 0 } })),
      "X scale must be greater than zero",
    ],
    [
      () =>
        addMapElement(
          createDocument(),
          createStamp({ data: { assetId: " ", width: 1, height: 1 } }),
        ),
      "Stamp asset id is required",
    ],
    [
      () =>
        addMapElement(
          createDocument(),
          createStamp({ data: { assetId: "a", width: 0, height: 1 } }),
        ),
      "Stamp width must be greater than zero",
    ],
    [() => updateMapElement(createDocument(), "missing", {}), "Unknown map element"],
    [
      () => {
        const document = addMapElement(createDocument(), createStamp());
        return updateMapElement(document, "stamp-1", { layerId: "background" });
      },
      "Map layer is locked",
    ],
    [() => removeMapElement(createDocument(), "missing"), "Unknown map element"],
  ])("guards invalid element operation %#", (operation, message) => {
    expect(operation).toThrow(message as string);
  });

  it("validates every authoring element type", () => {
    let document = createDocument();
    document = addMapElement(document, {
      ...createStamp({ id: "tile", layerId: "terrain" }),
      type: "tile",
      data: { assetId: "floor", columns: 2, rows: 3 },
    });
    document = addMapElement(document, {
      ...createStamp({ id: "shape" }),
      type: "shape",
      data: {
        shape: "rectangle",
        points: [
          { x: 0, y: 0 },
          { x: 50, y: 50 },
        ],
        stroke: "#fff",
        strokeWidth: 2,
        fill: "#000",
        opacity: 0.5,
      },
    });
    document = addMapElement(document, {
      ...createStamp({ id: "wall", layerId: "walls" }),
      type: "wall",
      data: {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        blocksMovement: true,
        blocksVision: true,
      },
    });
    document = addMapElement(document, {
      ...createStamp({ id: "door", layerId: "walls" }),
      type: "door",
      data: { width: 50, state: "closed", blocksMovement: true, blocksVision: true },
    });
    document = addMapElement(document, {
      ...createStamp({ id: "light", layerId: "lighting" }),
      type: "light",
      data: { radius: 300, color: "#ffaa00", intensity: 0.8, castsShadows: true },
    });
    document = addMapElement(document, {
      ...createStamp({ id: "text", layerId: "notes" }),
      type: "text",
      data: { text: "Secret door", color: "#fff", fontSize: 16, visibleToPlayers: false },
    });

    expect(document.elements.map((element) => element.type)).toEqual([
      "tile",
      "shape",
      "wall",
      "door",
      "light",
      "text",
    ]);
  });

  it.each([
    [
      {
        ...createStamp({ id: "tile", layerId: "terrain" }),
        type: "tile",
        data: { assetId: "floor", columns: 1.5, rows: 1 },
      },
      "Tile columns must be an integer",
    ],
    [
      {
        ...createStamp({ id: "shape" }),
        type: "shape",
        data: { shape: "rectangle", points: [], stroke: "#fff", strokeWidth: 1, opacity: 1 },
      },
      "Shape requires at least 2 points",
    ],
    [
      {
        ...createStamp({ id: "wall", layerId: "walls" }),
        type: "wall",
        data: { points: [{ x: 0, y: 0 }], blocksMovement: true, blocksVision: true },
      },
      "Wall requires at least 2 points",
    ],
    [
      {
        ...createStamp({ id: "door", layerId: "walls" }),
        type: "door",
        data: { width: 0, state: "open", blocksMovement: false, blocksVision: false },
      },
      "Door width must be greater than zero",
    ],
    [
      {
        ...createStamp({ id: "light", layerId: "lighting" }),
        type: "light",
        data: { radius: 10, color: "#fff", intensity: 2, castsShadows: false },
      },
      "Light intensity must be between 0 and 1",
    ],
    [
      {
        ...createStamp({ id: "text", layerId: "notes" }),
        type: "text",
        data: { text: " ", color: "#fff", fontSize: 12, visibleToPlayers: false },
      },
      "Map text is required",
    ],
  ])("rejects invalid specialized element %#", (element, message) => {
    expect(() => addMapElement(createDocument(), element as never)).toThrow(message);
  });

  it("rejects invalid commit timestamps", () => {
    expect(() => addMapLayer(createDocument(), createLayer(), Number.NaN)).toThrow(
      "Map document timestamp must be a finite number",
    );
  });
});
