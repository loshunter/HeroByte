// Emissive scenery → bake lights (Light & Colour II E3). The derivation is
// client-side over snapshot.mapElements, which is already privacy-filtered
// (deriveMapElements), so these tests pin the arithmetic and the merge rules,
// not the privacy — hidden props never reach the input by construction.

import { describe, expect, it } from "vitest";
import type { MapElementsSnapshot } from "@herobyte/shared";
import { getMapStudioTileAsset } from "../../../map-studio/starterTiles";
import { withEmissiveLights } from "../emissiveLights";

const GRID = { size: 50, offsetX: 0, offsetY: 0 };

const tile = (id: string, assetId: string, x: number, y: number, scale = 1) => ({
  id,
  type: "tile" as const,
  transform: { x, y, scaleX: scale, scaleY: scale, rotation: 0 },
  data: { assetId, columns: 1, rows: 1 },
});

/** The free-placed sibling: Alt-place, Scatter and POPULATE all emit stamps,
 * whose footprint is PX (width/height), not cells. */
const stamp = (id: string, assetId: string, x: number, y: number, scale = 1) => ({
  id,
  type: "stamp" as const,
  transform: { x, y, scaleX: scale, scaleY: scale, rotation: 0 },
  data: { assetId, width: 50, height: 50 },
});

const snapshot = (
  elements: (ReturnType<typeof tile> | ReturnType<typeof stamp>)[],
  lighting?: MapElementsSnapshot["lighting"],
): MapElementsSnapshot => ({
  grid: GRID,
  layers: [{ opacity: 1, elements }],
  ...(lighting ? { lighting } : {}),
});

describe("withEmissiveLights", () => {
  it("the bundled lamp asset is emissive with cell-denominated radius", () => {
    const lamp = getMapStudioTileAsset("objects:lamp");
    expect(lamp.id).toBe("objects:lamp"); // not the fallback
    expect(lamp.category).toBe("objects");
    expect(lamp.emissive).toBeDefined();
    expect(lamp.emissive!.radius).toBeGreaterThan(0);
    expect(lamp.emissive!.radius).toBeLessThanOrEqual(6); // cells, not px
    expect(lamp.emissive!.intensity).toBeGreaterThan(0);
    expect(lamp.emissive!.intensity).toBeLessThanOrEqual(1);
  });

  it("a placed lamp contributes a light at its centre, radius in world px", () => {
    const lighting = withEmissiveLights(snapshot([tile("l1", "objects:lamp", 100, 200)]));
    const glow = getMapStudioTileAsset("objects:lamp").emissive!;
    expect(lighting).toBeDefined();
    expect(lighting!.ambient).toBe(1); // no explicit lighting channel ⇒ daylight
    expect(lighting!.lights).toEqual([
      {
        id: "emissive:l1",
        x: 100 + 25, // 1x1 tile centre on the 50px grid
        y: 200 + 25,
        radius: glow.radius * 50,
        color: glow.color,
        intensity: glow.intensity,
      },
    ]);
  });

  it("appends emissive lights AFTER the explicit placed lights and keeps ambient", () => {
    const placed = { id: "L", x: 5, y: 6, radius: 120, color: "#ff9040", intensity: 0.8 };
    const lighting = withEmissiveLights(
      snapshot([tile("l1", "objects:lamp", 0, 0)], { ambient: 0.4, lights: [placed] }),
    );
    expect(lighting!.ambient).toBe(0.4);
    expect(lighting!.lights[0]).toEqual(placed);
    expect(lighting!.lights[1]!.id).toBe("emissive:l1");
  });

  it("a scaled prop's light centre follows the scale", () => {
    const lighting = withEmissiveLights(snapshot([tile("l1", "objects:lamp", 100, 100, 2)]));
    expect(lighting!.lights[0]!.x).toBe(100 + 50); // 1 cell × scale 2 / 2
    expect(lighting!.lights[0]!.y).toBe(100 + 50);
  });

  it("non-emissive scenery contributes nothing — the snapshot lighting passes through UNCHANGED", () => {
    const explicit = { ambient: 0.5, lights: [] };
    const s = snapshot([tile("c1", "objects:crate", 0, 0)], explicit);
    // Same reference — knob-less maps keep their exact lighting signature.
    expect(withEmissiveLights(s)).toBe(s.lighting);
    expect(withEmissiveLights(snapshot([tile("c1", "objects:crate", 0, 0)]))).toBeUndefined();
  });

  it("a STAMP lamp glows exactly like the tile one (Alt-place / Scatter / POPULATE)", () => {
    // Confirmed review finding: keying the glow off the element KIND made it
    // depend on which modifier key the DM held — three of the four placement
    // gestures emit stamps. A 50px stamp on the 50px grid is one cell, so its
    // light must match the tile version pixel for pixel (bar the id).
    const fromTile = withEmissiveLights(snapshot([tile("t1", "objects:lamp", 100, 200)]));
    const fromStamp = withEmissiveLights(snapshot([stamp("s1", "objects:lamp", 100, 200)]));
    expect(fromStamp!.lights).toEqual([{ ...fromTile!.lights[0]!, id: "emissive:s1" }]);
  });

  it("a scaled stamp's light centre follows its PX footprint, not the grid", () => {
    const lighting = withEmissiveLights(snapshot([stamp("s1", "objects:lamp", 100, 100, 3)]));
    expect(lighting!.lights[0]!.x).toBe(100 + 75); // 50px × scale 3 / 2
    expect(lighting!.lights[0]!.y).toBe(100 + 75);
  });

  it("non-prop element kinds (shape/text) never contribute a light", () => {
    const shape = {
      id: "sh1",
      type: "shape" as const,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      data: { shape: "rectangle", points: [], fill: "#fff", stroke: "#000", strokeWidth: 1 },
    };
    const s = snapshot([shape as never]);
    expect(withEmissiveLights(s)).toBeUndefined();
  });

  it("no mapElements ⇒ no lighting", () => {
    expect(withEmissiveLights(undefined)).toBeUndefined();
  });

  it("unknown/uploaded assets fall back to non-emissive, never throw", () => {
    const s = snapshot([tile("u1", "upload:abc123", 0, 0)]);
    expect(withEmissiveLights(s)).toBeUndefined();
  });
});
