// The night-cave study's additions: light-pool OVERDRIVE (gain), the night
// grade reaching ledge courses, a tintable boat hull, and the second water
// body. Each pins the parity rule too — the shipped behaviour must be
// bit-identical when the new knob is absent.

import { describe, expect, it } from "vitest";
import { applyBakeLighting, type BakeLighting } from "../terrainLighting";
import { gradeHex, gradeTerrainPalette, nightGradeStrength } from "../terrainNightGrade";
import { VILLAGE_TERRAIN } from "../terrainPalette";
import { waterFamilyOf } from "../terrainFieldColor";
import { computeFieldDepths } from "../terrainDistanceField";
import { paintPropStamp } from "../propStampDetail";
import { getMapStudioTileAsset } from "../../map-studio/starterTiles";
import type { WearStampContext2D } from "../wearStampDetail";

/** A flat mid-grey buffer to light. */
function greyBuffer(w: number, h: number, value = 120): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    px[i * 4] = value;
    px[i * 4 + 1] = value;
    px[i * 4 + 2] = value;
    px[i * 4 + 3] = 255;
  }
  return px;
}

const at = (px: Uint8ClampedArray, w: number, x: number, y: number) => {
  const o = (y * w + x) * 4;
  return [px[o]!, px[o + 1]!, px[o + 2]!] as [number, number, number];
};

describe("light pool overdrive (gain)", () => {
  const W = 41;
  const H = 41;
  const base = (gain?: number): BakeLighting => ({
    ambient: 0.3,
    lights: [
      { x: 20.5, y: 20.5, radius: 6, color: "#ffb765", intensity: 1, ...(gain ? { gain } : {}) },
    ],
  });

  it("WITHOUT gain a pool can never exceed the unlit value — only cancel the veil", () => {
    const px = greyBuffer(W, H);
    applyBakeLighting(px, W, H, 0, 0, base());
    // Dead centre sits in the hot core, where the veil is fully cancelled.
    const [r, g, b] = at(px, W, 20, 20);
    // The tint warms it, but no channel climbs past the unlit 120 by more than
    // the tint can carry it — and the GREEN/BLUE channels of a warm lamp
    // cannot exceed it at all. This is the limitation the study found.
    expect(b).toBeLessThanOrEqual(120);
    expect(r).toBeLessThanOrEqual(255);
    expect(g).toBeLessThanOrEqual(180);
  });

  it("WITH gain the core climbs ABOVE the unlit value (a light, not a hole)", () => {
    const plain = greyBuffer(W, H);
    applyBakeLighting(plain, W, H, 0, 0, base());
    const lifted = greyBuffer(W, H);
    applyBakeLighting(lifted, W, H, 0, 0, base(0.4));

    const [, , plainB] = at(plain, W, 20, 20);
    const [liftR, liftG, liftB] = at(lifted, W, 20, 20);
    expect(liftB).toBeGreaterThan(plainB);
    // The core now reads brighter than the UNLIT ground on every channel.
    expect(liftR).toBeGreaterThan(120);
    expect(liftG).toBeGreaterThan(120);
    // ...and stays in range.
    expect(Math.max(liftR, liftG, liftB)).toBeLessThanOrEqual(255);
  });

  it("gain 0 / omitted is bit-identical to the shipped pool (parity rule)", () => {
    const a = greyBuffer(W, H);
    applyBakeLighting(a, W, H, 0, 0, base());
    const b = greyBuffer(W, H);
    applyBakeLighting(b, W, H, 0, 0, base(0));
    expect(a).toEqual(b);
  });

  it("falls off with the pool profile — the far wash is not lifted like the core", () => {
    const px = greyBuffer(W, H);
    applyBakeLighting(px, W, H, 0, 0, base(0.4));
    const core = at(px, W, 20, 20).reduce((s, c) => s + c, 0);
    const halo = at(px, W, 20 + 5, 20).reduce((s, c) => s + c, 0);
    const wash = at(px, W, 20 + 13, 20).reduce((s, c) => s + c, 0);
    expect(core).toBeGreaterThan(halo);
    expect(halo).toBeGreaterThan(wash);
  });
});

describe("night grade completeness", () => {
  const t = nightGradeStrength(0.32);

  it("arms below the daylight threshold and grades toward moonlight", () => {
    expect(nightGradeStrength(1)).toBe(0);
    expect(nightGradeStrength(0.9)).toBe(0);
    expect(t).toBeGreaterThan(0.5);
  });

  it("now grades LEDGE courses — they were the last ungraded colour set", () => {
    const graded = gradeTerrainPalette(VILLAGE_TERRAIN, t);
    const day = VILLAGE_TERRAIN["terrain:cave-wall"]!.ledges!;
    const night = graded["terrain:cave-wall"]!.ledges!;
    expect(night.colors).toEqual(day.colors.map((c) => gradeHex(c, t)));
    expect(night.contour).toBe(gradeHex(day.contour, t));
    // And they actually MOVED — a night cavern must not keep day rock.
    expect(night.colors).not.toEqual(day.colors);
  });

  it("leaves GLOW alone — an emissive spill is light emitted, not received", () => {
    const graded = gradeTerrainPalette(VILLAGE_TERRAIN, t);
    expect(graded["terrain:lava"]!.glow).toEqual(VILLAGE_TERRAIN["terrain:lava"]!.glow);
    expect(graded["terrain:biolume"]!.glow).toEqual(VILLAGE_TERRAIN["terrain:biolume"]!.glow);
  });

  it("strength 0 returns the palette object itself (cache-key parity)", () => {
    expect(gradeTerrainPalette(VILLAGE_TERRAIN, 0)).toBe(VILLAGE_TERRAIN);
  });
});

describe("the flooded-cave water families", () => {
  it("give the abyss its own body, so it never fuses with the lagoon", () => {
    expect(VILLAGE_TERRAIN["terrain:abyss-water"]!.body).toBe("abyss");
    expect(VILLAGE_TERRAIN["terrain:biolume"]!.body).toBe("abyss");
    // Still exactly one WATER body for the drown tint.
    expect(waterFamilyOf(VILLAGE_TERRAIN)).toBe(VILLAGE_TERRAIN["terrain:water"]);
  });

  it("keeps abyss and lagoon bathymetries independent across a shared seam", () => {
    const familyByCell = new Map<string, string>();
    for (let y = 0; y < 3; y += 1) {
      for (let x = 0; x < 3; x += 1) familyByCell.set(`${x},${y}`, "terrain:water");
      for (let x = 3; x < 6; x += 1) familyByCell.set(`${x},${y}`, "terrain:abyss-water");
    }
    const depths = computeFieldDepths(
      familyByCell,
      ["terrain:water", "terrain:abyss-water"],
      VILLAGE_TERRAIN,
    );
    expect(depths.get("terrain:water")!.get("2,1")).toBe(1);
    expect(depths.get("terrain:abyss-water")!.get("3,1")).toBe(1);
  });

  it("has no sunlit caustics in the abyss (there is no sun down there)", () => {
    expect(VILLAGE_TERRAIN["terrain:abyss-water"]!.caustics).toBeUndefined();
    // ...but the glowing shoal makes its own light, so it keeps them.
    expect(VILLAGE_TERRAIN["terrain:biolume"]!.caustics).toBeDefined();
  });

  it("matches asset fills to palette bases", () => {
    for (const id of ["terrain:abyss-water", "terrain:biolume"]) {
      expect(getMapStudioTileAsset(id).fill, id).toBe(VILLAGE_TERRAIN[id]!.base);
    }
  });
});

describe("boat hull tint", () => {
  /** Collect every fill colour a stamp painter emits. */
  function paintedColours(tint?: string): string[] {
    const seen: string[] = [];
    let style = "";
    const ctx: WearStampContext2D = {
      get fillStyle() {
        return style;
      },
      set fillStyle(value) {
        style = String(value);
      },
      globalAlpha: 1,
      fillRect: () => seen.push(style),
    };
    paintPropStamp(ctx, 40, 60, 7, "boat", tint);
    return seen;
  }

  it("recolours the hull when tinted, and is untouched without one", () => {
    const plain = paintedColours();
    const red = paintedColours("#a8332c");
    expect(plain.length).toBe(red.length);
    expect(red).not.toEqual(plain);
    // The shipped gunwale timber is gone from a painted boat.
    expect(plain.some((c) => c.startsWith("#"))).toBe(true);
    expect(red.some((c) => c.startsWith("rgb("))).toBe(true);
  });

  it("leaves the gull alone — a recoloured seabird is a different bird", () => {
    const seen: string[] = [];
    let style = "";
    const ctx: WearStampContext2D = {
      get fillStyle() {
        return style;
      },
      set fillStyle(value) {
        style = String(value);
      },
      globalAlpha: 1,
      fillRect: () => seen.push(style),
    };
    paintPropStamp(ctx, 30, 30, 3, "gull", "#ff0000");
    expect(seen.every((c) => !c.includes("255, 0, 0"))).toBe(true);
  });
});
