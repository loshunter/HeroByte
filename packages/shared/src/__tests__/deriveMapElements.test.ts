import { describe, expect, it } from "vitest";
import {
  deriveMapElements,
  type MapDocument,
  type MapElement,
  type MapLayer,
  type MapLayerKind,
} from "../index.js";

// deriveMapElements is a hard PRIVACY contract: nothing a player must not see
// may survive it. Each exclusion rule gets an adversarial test that asserts the
// secret content is absent from the ENTIRE serialized output, not merely from
// the elements array — the same bar the server frame grep holds.

let seq = 0;
const nextId = () => `el-${(seq += 1)}`;

const T = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };

function layer(id: string, kind: MapLayerKind, over: Partial<MapLayer> = {}): MapLayer {
  return { id, name: id, kind, visible: true, locked: false, opacity: 1, zIndex: 0, ...over };
}

function tile(layerId: string, over: Partial<MapElement> = {}): MapElement {
  return {
    id: nextId(),
    layerId,
    type: "tile",
    locked: false,
    hidden: false,
    transform: T,
    data: { assetId: "tile:grass", columns: 2, rows: 2 },
    ...over,
  } as MapElement;
}

function textEl(layerId: string, text: string, visibleToPlayers: boolean): MapElement {
  return {
    id: nextId(),
    layerId,
    type: "text",
    locked: false,
    hidden: false,
    transform: T,
    data: { text, color: "#fff", fontSize: 24, visibleToPlayers },
  };
}

function wall(layerId: string): MapElement {
  return {
    id: nextId(),
    layerId,
    type: "wall",
    locked: false,
    hidden: false,
    transform: T,
    data: {
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
      ],
      blocksMovement: true,
      blocksVision: true,
    },
  };
}

function doc(layers: MapLayer[], elements: MapElement[]): MapDocument {
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
      offsetX: 4,
      offsetY: 6,
      visible: true,
      snap: true,
    },
    layers,
    elements,
    revision: 1,
    createdAt: 1,
    updatedAt: 1,
  };
}

/** All element ids present anywhere in the derived snapshot. */
function idsOf(result: ReturnType<typeof deriveMapElements>): string[] {
  return (result?.layers ?? []).flatMap((l) => l.elements.map((e) => e.id));
}

describe("deriveMapElements — privacy contract", () => {
  it("excludes hidden elements", () => {
    const objects = layer("objects", "objects");
    const secret = tile("objects", { hidden: true, id: "hidden-tile" });
    const shown = tile("objects", { id: "shown-tile" });
    const result = deriveMapElements(doc([objects], [secret, shown]));
    expect(idsOf(result)).toEqual(["shown-tile"]);
  });

  it("excludes EVERY element on a layer with visible:false", () => {
    const hiddenLayer = layer("objects", "objects", { visible: false });
    const result = deriveMapElements(doc([hiddenLayer], [tile("objects"), tile("objects")]));
    expect(result).toBeUndefined();
  });

  it("excludes an entire notes-kind layer, even when visible", () => {
    const notes = layer("notes", "notes", { visible: true });
    const secret = textEl("notes", "The vault code is 4271", true);
    const result = deriveMapElements(doc([notes], [secret]));
    // The GM note must not survive in ANY form.
    expect(result).toBeUndefined();
    expect(JSON.stringify(result ?? null)).not.toContain("4271");
  });

  it("excludes text with visibleToPlayers:false and leaks none of its content", () => {
    const objects = layer("objects", "objects");
    const secret = textEl("objects", "Trap: poison needle", false);
    const shown = textEl("objects", "Welcome, travellers", true);
    const result = deriveMapElements(doc([objects], [secret, shown]));
    const raw = JSON.stringify(result);
    expect(raw).toContain("Welcome, travellers");
    expect(raw).not.toContain("poison needle");
    expect(raw).not.toContain("Trap");
  });

  it("never emits the visibleToPlayers flag on shown text (nothing left to strip)", () => {
    const objects = layer("objects", "objects");
    const result = deriveMapElements(doc([objects], [textEl("objects", "hi", true)]));
    expect(JSON.stringify(result)).not.toContain("visibleToPlayers");
  });

  it("excludes wall/door/light kinds (they never render as scenery)", () => {
    const objects = layer("objects", "objects");
    const walls = layer("walls", "walls");
    const result = deriveMapElements(
      doc([objects, walls], [wall("walls"), tile("objects", { id: "t" })]),
    );
    expect(idsOf(result)).toEqual(["t"]);
  });

  it("returns undefined when nothing visible remains", () => {
    const objects = layer("objects", "objects");
    const result = deriveMapElements(doc([objects], [tile("objects", { hidden: true })]));
    expect(result).toBeUndefined();
  });

  it("drops elements referencing a non-existent layer (defensive)", () => {
    const objects = layer("objects", "objects");
    const orphan = tile("ghost-layer", { id: "orphan" });
    const result = deriveMapElements(doc([objects], [orphan, tile("objects", { id: "keep" })]));
    expect(idsOf(result)).toEqual(["keep"]);
  });
});

function light(layerId: string, over: Partial<MapElement> = {}): MapElement {
  return {
    id: nextId(),
    layerId,
    type: "light",
    locked: false,
    hidden: false,
    transform: { x: 125, y: 275, scaleX: 1, scaleY: 1, rotation: 0 },
    data: { radius: 175, color: "#ffc06a", intensity: 1, castsShadows: false },
    ...over,
  } as MapElement;
}

// Lights render as POOLS through the terrain bake, not as scenery — they ride
// the separate `lighting` channel under the same hidden/visible privacy rules,
// alongside `ambient` (the lighting layer's opacity; invisible layer ⇒ day).
describe("deriveMapElements — lighting channel", () => {
  it("ships a visible light's pool data, never as scenery", () => {
    const lighting = layer("lighting", "lighting", { opacity: 0.4 });
    const result = deriveMapElements(doc([lighting], [light("lighting", { id: "torch" })]));
    expect(idsOf(result)).toEqual([]); // not in any scenery layer
    expect(result!.lighting).toEqual({
      ambient: 0.4,
      lights: [{ id: "torch", x: 125, y: 275, radius: 175, color: "#ffc06a", intensity: 1 }],
    });
    // The internal-only flag never reaches the wire.
    expect(JSON.stringify(result)).not.toContain("castsShadows");
  });

  it("a hidden light must not glow (prepared-but-unlit)", () => {
    const lighting = layer("lighting", "lighting", { opacity: 0.4 });
    const result = deriveMapElements(
      doc([lighting], [light("lighting", { id: "secret-brazier", hidden: true })]),
    );
    expect(result!.lighting).toEqual({ ambient: 0.4, lights: [] });
    expect(JSON.stringify(result)).not.toContain("secret-brazier");
  });

  it("an invisible lighting layer reads as daylight — the kill switch", () => {
    const lighting = layer("lighting", "lighting", { opacity: 0.2, visible: false });
    const result = deriveMapElements(doc([lighting], [light("lighting")]));
    // No veil, no lights, no scenery ⇒ nothing to ship at all.
    expect(result).toBeUndefined();
  });

  it("plain daylight with no lights omits the channel entirely", () => {
    const objects = layer("objects", "objects");
    const lighting = layer("lighting", "lighting");
    const result = deriveMapElements(doc([objects, lighting], [tile("objects")]));
    expect(result!.lighting).toBeUndefined();
  });

  it("a dimmed lighting layer ships ambient even with zero lights and zero scenery", () => {
    const lighting = layer("lighting", "lighting", { opacity: 0.6 });
    const result = deriveMapElements(doc([lighting], []));
    expect(result!.lighting).toEqual({ ambient: 0.6, lights: [] });
    expect(result!.layers).toEqual([]);
  });
});

describe("deriveMapElements — layering + shape", () => {
  it("emits non-empty layers in zIndex order, carrying opacity", () => {
    const top = layer("top", "objects", { zIndex: 20, opacity: 0.5 });
    const bottom = layer("bottom", "terrain", { zIndex: 5, opacity: 1 });
    const result = deriveMapElements(
      doc([top, bottom], [tile("top", { id: "on-top" }), tile("bottom", { id: "on-bottom" })]),
    );
    expect(result!.layers.map((l) => [l.opacity, l.elements[0]!.id])).toEqual([
      [1, "on-bottom"],
      [0.5, "on-top"],
    ]);
  });

  it("carries the document grid (tiles are cell-sized)", () => {
    const objects = layer("objects", "objects");
    const result = deriveMapElements(doc([objects], [tile("objects")]));
    expect(result!.grid).toEqual({ size: 50, offsetX: 4, offsetY: 6 });
  });

  it("deep-clones so a later document edit cannot mutate a prior payload", () => {
    const objects = layer("objects", "objects");
    const document = doc([objects], [tile("objects", { id: "t" })]);
    const result = deriveMapElements(document);
    // Mutate the source element's data in place.
    (document.elements[0] as { data: { columns: number } }).data.columns = 999;
    expect((result!.layers[0]!.elements[0] as { data: { columns: number } }).data.columns).toBe(2);
  });
});
