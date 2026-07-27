// Spline element — the wire contract (spline arc). Pins: sanitizeElement
// clones the points (no aliasing through undo history), rejects degenerate
// splines, the privacy filter passes splines to players intact (the
// toRenderable default-null trap), and compileScene ignores them by design
// (set dressing never blocks movement or vision).

import { describe, expect, it } from "vitest";
import { compileScene } from "../sceneCompiler";
import { deriveMapElements } from "../scenePublish";
import { sanitizeElement } from "../mapStudioValidation";
import { createMapDocument } from "../mapStudio";
import { addMapElement } from "../mapStudioElements";
import type { MapSplineElement } from "../mapStudioTypes";

const spline = (over?: Partial<MapSplineElement["data"]>): MapSplineElement => ({
  id: "spline-1",
  layerId: "objects",
  type: "spline",
  locked: false,
  hidden: false,
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  data: {
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 40 },
      { x: 220, y: 10 },
    ],
    kind: "rope",
    ...over,
  },
});

describe("spline element wire contract", () => {
  it("sanitizes with CLONED points and preserves kind/tint", () => {
    const source = spline({ kind: "filigree", tint: "#aabbcc" });
    const clean = sanitizeElement(source) as MapSplineElement;
    expect(clean.data.kind).toBe("filigree");
    expect(clean.data.tint).toBe("#aabbcc");
    expect(clean.data.points).toEqual(source.data.points);
    expect(clean.data.points).not.toBe(source.data.points);
    expect(clean.data.points[0]).not.toBe(source.data.points[0]);
  });

  it("rejects a degenerate single-point spline", () => {
    expect(() => sanitizeElement(spline({ points: [{ x: 1, y: 2 }] }))).toThrow();
  });

  it("passes the privacy filter to players with data intact", () => {
    let document = createMapDocument({ id: "doc", name: "Doc" });
    document = addMapElement(document, spline());
    const snapshot = deriveMapElements(document);
    const rendered = snapshot.layers.flatMap((layer) => layer.elements);
    expect(rendered).toHaveLength(1);
    expect(rendered[0]).toMatchObject({
      type: "spline",
      data: { kind: "rope", points: spline().data.points },
    });
  });

  it("never compiles into walls, doors or lights", () => {
    let document = createMapDocument({ id: "doc", name: "Doc" });
    document = addMapElement(document, spline());
    const scene = compileScene(document);
    expect(scene.walls).toHaveLength(0);
    expect(scene.doors).toHaveLength(0);
    expect(scene.lights).toHaveLength(0);
  });
});
