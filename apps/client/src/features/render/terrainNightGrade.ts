// Night grade (Czepeku catalog rank 3) — a pure colour transform over the
// terrain palette. The corpus' night maps do not simply darken: they compress
// every family into ONE cool desaturated ladder, so a night map reads as a
// single moonlit material set rather than the day palette with the lights off.
// Warm accents survive because they are not terrain — prop/accent art and the
// light pools themselves (terrainLighting) paint OVER the graded ground.
//
// Everything here is pure and memoized on (palette, strength). Strength 0
// returns the palette UNCHANGED — the same object reference — so a daylight
// bake is byte-identical and its cache key never churns (the parity rule).

import type { TerrainFamilyPalette } from "./terrainPaletteTypes";
import type { KeyClusterPalette } from "./terrainPaletteTypes";

/** Moonlight hue every graded colour leans toward — a desaturated blue. */
const NIGHT_HUE: [number, number, number] = [58, 74, 122];
/** How far a fully-graded colour drifts toward NIGHT_HUE. */
const HUE_PULL = 0.42;
/** How much of a colour's own saturation survives a full grade. */
const SAT_DROP = 0.55;
/** How far a fully-graded colour's value is compressed. */
const VALUE_DROP = 0.3;

const parse = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const toHex = (c: number): string => {
  const v = c < 0 ? 0 : c > 255 ? 255 : Math.round(c);
  return v.toString(16).padStart(2, "0");
};

/**
 * Grade one colour toward night by `t` (0 = untouched, 1 = full moonlight):
 * desaturate toward its own luma, compress the value, then lean the result
 * toward the moonlight hue. Order matters — desaturating first keeps the hue
 * pull from fighting a colour's own chroma, so bright grass and drab path land
 * on the same ladder instead of drifting apart.
 */
export function gradeHex(hex: string, t: number): string {
  if (t <= 0) return hex;
  const [r, g, b] = parse(hex);
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const sat = 1 - SAT_DROP * t;
  const value = 1 - VALUE_DROP * t;
  const pull = HUE_PULL * t;
  const grade = (c: number, night: number): number => {
    const desaturated = luma + (c - luma) * sat;
    const compressed = desaturated * value;
    return compressed + (night - compressed) * pull;
  };
  return `#${toHex(grade(r, NIGHT_HUE[0]))}${toHex(grade(g, NIGHT_HUE[1]))}${toHex(grade(b, NIGHT_HUE[2]))}`;
}

const gradeCluster = (palette: KeyClusterPalette, t: number): KeyClusterPalette => ({
  crev: gradeHex(palette.crev, t),
  dark: gradeHex(palette.dark, t),
  mid: gradeHex(palette.mid, t),
  light: gradeHex(palette.light, t),
});

/** Grade every colour field of one family; non-colour knobs pass through. */
function gradeFamily(fam: TerrainFamilyPalette, t: number): TerrainFamilyPalette {
  return {
    ...fam,
    base: gradeHex(fam.base, t),
    rim: gradeHex(fam.rim, t),
    ...(fam.keyCluster ? { keyCluster: gradeCluster(fam.keyCluster, t) } : {}),
    // Grass decoration is palette data precisely so the grade reaches it: left
    // as painter constants, night ground went cool while the blades and
    // flowers kept full day chroma (confirmed adversarial-review finding).
    ...(fam.grass
      ? {
          grass: {
            bladeLight: gradeHex(fam.grass.bladeLight, t),
            bladeDense: gradeHex(fam.grass.bladeDense, t),
            petal: gradeHex(fam.grass.petal, t),
            petalPink: gradeHex(fam.grass.petalPink, t),
            flowerCenter: gradeHex(fam.grass.flowerCenter, t),
            flowerStem: gradeHex(fam.grass.flowerStem, t),
          },
        }
      : {}),
    ...(fam.floor ? { floor: { ...fam.floor, palette: gradeCluster(fam.floor.palette, t) } } : {}),
    ...(fam.wall ? { wall: { palette: gradeCluster(fam.wall.palette, t) } } : {}),
    ...(fam.roof ? { roof: { palette: gradeCluster(fam.roof.palette, t) } } : {}),
    ...(fam.stairs ? { stairs: { palette: gradeCluster(fam.stairs.palette, t) } } : {}),
    ...(fam.water ? { water: { dash: gradeHex(fam.water.dash, t) } } : {}),
    // Canopy: the two-tone split, the core darkening AND the leaf ticks all
    // ride the ladder (the grass-decoration lesson); `sub` is structural.
    ...(fam.canopy
      ? {
          canopy: {
            ...fam.canopy,
            shade: gradeHex(fam.canopy.shade, t),
            core: gradeHex(fam.canopy.core, t),
            detail: {
              tickLight: gradeHex(fam.canopy.detail.tickLight, t),
              tickDark: gradeHex(fam.canopy.detail.tickDark, t),
              highlight: gradeHex(fam.canopy.detail.highlight, t),
            },
          },
        }
      : {}),
    ...(fam.sunken?.algae
      ? { sunken: { ...fam.sunken, algae: gradeHex(fam.sunken.algae, t) } }
      : {}),
    ...(fam.depthBands
      ? { depthBands: fam.depthBands.map((b) => ({ ...b, base: gradeHex(b.base, t) })) }
      : {}),
    ...(fam.foam ? { foam: { ...fam.foam, color: gradeHex(fam.foam.color, t) } } : {}),
    ...(fam.caustics
      ? { caustics: { ...fam.caustics, color: gradeHex(fam.caustics.color, t) } }
      : {}),
    // Ledge courses ride the ladder too (night cave study — they were the last
    // ungraded colour set, so a cliff or cavern wall kept DAY rock while its
    // own base/rim went cool: the grass-decoration bug, second edition).
    ...(fam.ledges
      ? {
          ledges: {
            colors: fam.ledges.colors.map((c) => gradeHex(c, t)),
            contour: gradeHex(fam.ledges.contour, t),
          },
        }
      : {}),
    // `glow` is deliberately NOT graded: an emissive spill is the family's own
    // light, not light it receives, so moonlight must not cool it. Lava stays
    // orange at midnight. (`mottle`/`speckle`/`sub`/`polar` are structural.)
  };
}

/** Grade strength for an ambient level (1 = daylight … 0 = deepest night).
 * Daylight and near-daylight stay at 0 so a barely-dimmed map is still
 * byte-identical; below that the grade ramps to full at deepest night. */
const GRADE_START = 0.85;
export function nightGradeStrength(ambient: number): number {
  if (ambient >= GRADE_START) return 0;
  const t = (GRADE_START - ambient) / GRADE_START;
  return t > 1 ? 1 : t;
}

/** Memo per (palette, strength) — the bake asks for the same pair every time
 * the terrain re-bakes at one ambient, and the grade is pure. */
const cache = new WeakMap<
  Record<string, TerrainFamilyPalette>,
  Map<number, Record<string, TerrainFamilyPalette>>
>();

/**
 * The palette a bake should paint with at this grade strength. Strength 0
 * returns the input palette itself (same reference), so daylight bakes are
 * bit-identical and unchanged in cost.
 */
export function gradeTerrainPalette(
  palette: Record<string, TerrainFamilyPalette>,
  strength: number,
): Record<string, TerrainFamilyPalette> {
  if (strength <= 0) return palette;
  const t = strength > 1 ? 1 : strength;
  let byStrength = cache.get(palette);
  if (!byStrength) {
    byStrength = new Map();
    cache.set(palette, byStrength);
  }
  const hit = byStrength.get(t);
  if (hit) return hit;
  const graded: Record<string, TerrainFamilyPalette> = {};
  for (const [id, fam] of Object.entries(palette)) graded[id] = gradeFamily(fam, t);
  byStrength.set(t, graded);
  return graded;
}
