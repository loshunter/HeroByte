// Light & Colour II, Phase 3 (catalog rank 3): the night grade. A pure colour
// transform over the terrain palette that compresses every family into one
// cool desaturated ladder, driven by the existing ambient (Lighting layer
// opacity) so DMs get it for free.
//
// The parity invariant: daylight grades to strength 0, which returns the input
// palette ITSELF (same reference) — so an unlit map bakes byte-identically and
// its cache key never churns. The SVG export and swatches read starterTiles
// fills, never VILLAGE_TERRAIN, so they are structurally ungradeable — pinned
// here so a future refactor can't quietly route them through the grade.

import { describe, expect, it } from "vitest";
import { gradeHex, gradeTerrainPalette, nightGradeStrength } from "../terrainNightGrade";
import { VILLAGE_TERRAIN } from "../terrainPalette";
import { getMapStudioTileAsset } from "../../map-studio/starterTiles";

const parse = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
const luma = (hex: string): number => {
  const [r, g, b] = parse(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Distance between the max and min channel — a cheap saturation proxy. */
const chroma = (hex: string): number => {
  const c = parse(hex);
  return Math.max(...c) - Math.min(...c);
};

describe("nightGradeStrength (ambient → grade)", () => {
  it("daylight and near-daylight grade to exactly 0", () => {
    expect(nightGradeStrength(1)).toBe(0);
    expect(nightGradeStrength(0.9)).toBe(0);
    expect(nightGradeStrength(0.85)).toBe(0);
  });

  it("ramps monotonically to full grade at deepest night", () => {
    const dusk = nightGradeStrength(0.6);
    const night = nightGradeStrength(0.3);
    expect(dusk).toBeGreaterThan(0);
    expect(night).toBeGreaterThan(dusk);
    expect(nightGradeStrength(0)).toBe(1);
    expect(nightGradeStrength(-1)).toBe(1); // clamped, never over-grades
  });
});

describe("gradeHex (the colour transform)", () => {
  it("strength 0 is the identity, character for character", () => {
    for (const hex of ["#7cb04a", "#24516b", "#b3a687", "#000000", "#ffffff"]) {
      expect(gradeHex(hex, 0)).toBe(hex);
    }
  });

  it("darkens, desaturates and cools every day colour", () => {
    for (const hex of ["#7cb04a", "#60482e", "#b3a687", "#a08954"]) {
      const night = gradeHex(hex, 1);
      expect(luma(night), hex).toBeLessThan(luma(hex));
      expect(chroma(night), hex).toBeLessThan(chroma(hex));
      // Cool: blue gains on red relative to the day colour.
      const [dr, , db] = parse(hex);
      const [nr, , nb] = parse(night);
      expect(nb / Math.max(1, nr), hex).toBeGreaterThan(db / Math.max(1, dr));
    }
  });

  it("a NEUTRAL grey still cools — isolating the hue pull from the desaturation", () => {
    // Discriminating probe (confirmed review finding): every warm colour gets
    // a higher blue/red ratio from desaturation ALONE, so warm probes cannot
    // tell the hue pull apart from SAT_DROP — a mutation setting HUE_PULL to 0
    // left the whole suite green. Grey has zero chroma, so desaturating it is
    // a no-op: any move toward blue here is the moonlight pull and nothing
    // else. Deleting the pull turns this red.
    const night = gradeHex("#808080", 1);
    const [r, g, b] = parse(night);
    expect(b).toBeGreaterThan(r + 8);
    expect(b).toBeGreaterThan(g);
    // …and the pull scales with strength rather than snapping on.
    const half = parse(gradeHex("#808080", 0.5));
    expect(half[2] - half[0]).toBeGreaterThan(0);
    expect(half[2] - half[0]).toBeLessThan(b - r);
  });

  it("compresses the palette's spread — families converge on one ladder", () => {
    // The catalog's core night claim: the day palette's wide hue spread
    // collapses toward a single moonlit material set.
    const day = ["#7cb04a", "#60482e", "#8a7454", "#31549b"];
    const spread = (hexes: string[]): number => {
      const chromas = hexes.map(chroma);
      return Math.max(...chromas) - Math.min(...chromas);
    };
    expect(spread(day.map((h) => gradeHex(h, 1)))).toBeLessThan(spread(day));
  });

  it("is monotonic in strength (no banding as dusk deepens)", () => {
    const steps = [0.2, 0.4, 0.6, 0.8, 1].map((t) => luma(gradeHex("#7cb04a", t)));
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]!).toBeLessThanOrEqual(steps[i - 1]!);
    }
  });

  it("never emits a malformed or out-of-range hex", () => {
    for (const hex of ["#000000", "#ffffff", "#7cb04a"]) {
      for (const t of [0.01, 0.5, 1]) {
        const out = gradeHex(hex, t);
        expect(out, `${hex}@${t}`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
});

describe("gradeTerrainPalette", () => {
  it("strength 0 returns the SAME palette object (the parity default)", () => {
    expect(gradeTerrainPalette(VILLAGE_TERRAIN, 0)).toBe(VILLAGE_TERRAIN);
  });

  it("memoizes per strength so repeat bakes reuse one graded palette", () => {
    const a = gradeTerrainPalette(VILLAGE_TERRAIN, 0.7);
    const b = gradeTerrainPalette(VILLAGE_TERRAIN, 0.7);
    expect(a).toBe(b);
    expect(gradeTerrainPalette(VILLAGE_TERRAIN, 0.4)).not.toBe(a);
  });

  it("never mutates the source palette", () => {
    const before = JSON.stringify(VILLAGE_TERRAIN);
    gradeTerrainPalette(VILLAGE_TERRAIN, 1);
    expect(JSON.stringify(VILLAGE_TERRAIN)).toBe(before);
  });

  it("grades EVERY colour field a family carries, and no structural knob", () => {
    const night = gradeTerrainPalette(VILLAGE_TERRAIN, 1);
    const water = night["terrain:water"]!;
    const day = VILLAGE_TERRAIN["terrain:water"]!;
    // Colours moved…
    expect(water.base).not.toBe(day.base);
    expect(water.rim).not.toBe(day.rim);
    expect(water.water!.dash).not.toBe(day.water!.dash);
    expect(water.foam!.color).not.toBe(day.foam!.color);
    expect(water.caustics!.color).not.toBe(day.caustics!.color);
    expect(water.depthBands!.map((b) => b.base)).not.toEqual(day.depthBands!.map((b) => b.base));
    // …structure did not.
    expect(water.priority).toBe(day.priority);
    expect(water.underfill).toBe(day.underfill);
    expect(water.depthBands!.map((b) => b.maxCells)).toEqual(
      day.depthBands!.map((b) => b.maxCells),
    );
    expect(water.foam!.reach).toBe(day.foam!.reach);
    expect(water.caustics!.strength).toBe(day.caustics!.strength);
    // Detail painter palettes grade too (a wall's courses must not stay warm).
    const wall = night["terrain:wall-stone"]!;
    const dayWall = VILLAGE_TERRAIN["terrain:wall-stone"]!;
    expect(wall.wall!.palette.crev).not.toBe(dayWall.wall!.palette.crev);
    expect(wall.wall!.palette.light).not.toBe(dayWall.wall!.palette.light);
    // Sunken algae and floor clusters as well.
    expect(night["terrain:sunken-flagstone"]!.sunken!.algae).not.toBe(
      VILLAGE_TERRAIN["terrain:sunken-flagstone"]!.sunken!.algae,
    );
    expect(night["terrain:stone-floor"]!.floor!.palette.mid).not.toBe(
      VILLAGE_TERRAIN["terrain:stone-floor"]!.floor!.palette.mid,
    );
    // The three painter palettes the first pass left unasserted (review nit).
    expect(night["terrain:dirt"]!.keyCluster!.mid).not.toBe(
      VILLAGE_TERRAIN["terrain:dirt"]!.keyCluster!.mid,
    );
    expect(night["terrain:roof-shingle"]!.roof!.palette.mid).not.toBe(
      VILLAGE_TERRAIN["terrain:roof-shingle"]!.roof!.palette.mid,
    );
    expect(night["terrain:stairs-stone"]!.stairs!.palette.mid).not.toBe(
      VILLAGE_TERRAIN["terrain:stairs-stone"]!.stairs!.palette.mid,
    );
  });

  it("grades GRASS DECORATION — blades and flowers ride the same ladder as the ground", () => {
    // The confirmed high-severity finding: grass is the only family with no
    // palette-driven painter, so its blades/flowers were module constants the
    // grade could not reach. Night ground went cool while the decoration kept
    // full day chroma — blade-to-ground contrast INCREASED at night, the exact
    // opposite of the phase's intent. Grass decoration is palette data now.
    const day = VILLAGE_TERRAIN["terrain:grass"]!;
    expect(day.grass, "grass decoration must be palette data").toBeDefined();
    const night = gradeTerrainPalette(VILLAGE_TERRAIN, 1)["terrain:grass"]!;
    for (const key of [
      "bladeLight",
      "bladeDense",
      "petal",
      "petalPink",
      "flowerCenter",
      "flowerStem",
    ] as const) {
      const dayHex = day.grass![key];
      const nightHex = night.grass![key];
      expect(nightHex, key).not.toBe(dayHex);
      expect(luma(nightHex), key).toBeLessThan(luma(dayHex));
      expect(chroma(nightHex), key).toBeLessThan(chroma(dayHex));
    }
    // The decoration must not out-contrast the ground it sits on at night:
    // the blade/ground luma ratio may not grow versus daylight.
    const ratio = (fam: typeof day): number =>
      luma(fam.grass!.bladeLight) / Math.max(1, luma(fam.base));
    expect(ratio(night)).toBeLessThanOrEqual(ratio(day));
  });

  it("grades the CANOPY two-tone and leaf ticks (rank 9 rides the ladder)", () => {
    const day = VILLAGE_TERRAIN["terrain:canopy"]!;
    expect(day.canopy, "canopy must be palette data").toBeDefined();
    const night = gradeTerrainPalette(VILLAGE_TERRAIN, 1)["terrain:canopy"]!;
    expect(night.canopy!.shade).not.toBe(day.canopy!.shade);
    expect(night.canopy!.core).not.toBe(day.canopy!.core);
    for (const key of ["tickLight", "tickDark", "highlight"] as const) {
      expect(night.canopy!.detail[key], key).not.toBe(day.canopy!.detail[key]);
      expect(luma(night.canopy!.detail[key]), key).toBeLessThan(luma(day.canopy!.detail[key]));
    }
    expect(night.canopy!.sub).toBe(day.canopy!.sub); // structural knob survives
  });

  it("keeps the family set identical (membership drives the field, not colour)", () => {
    expect(Object.keys(gradeTerrainPalette(VILLAGE_TERRAIN, 1)).sort()).toEqual(
      Object.keys(VILLAGE_TERRAIN).sort(),
    );
  });

  it("preserves the floor painter routing (kind and scale survive the grade)", () => {
    const night = gradeTerrainPalette(VILLAGE_TERRAIN, 1);
    const cobble = night["terrain:stone-cobble"]!.floor!;
    const dayCobble = VILLAGE_TERRAIN["terrain:stone-cobble"]!.floor!;
    expect(cobble.kind).toBe(dayCobble.kind);
    expect(cobble.scale).toBe(dayCobble.scale);
  });
});

describe("the swatch / SVG path is structurally ungraded", () => {
  it("swatch fills come from starterTiles and never move with the grade", () => {
    // The flat fallback and the byte-pinned SVG export read asset fills, which
    // the grade cannot reach — it only ever produces a new palette RECORD.
    const ids = ["terrain:grass", "terrain:water", "terrain:wall-stone"];
    const before = ids.map((id) => getMapStudioTileAsset(id).fill);
    gradeTerrainPalette(VILLAGE_TERRAIN, 1);
    expect(ids.map((id) => getMapStudioTileAsset(id).fill)).toEqual(before);
  });
});
