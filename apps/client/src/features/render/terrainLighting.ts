// Ambient darkness veil + light pools over the baked terrain (Czepeku catalog
// #3, pools upgraded to catalog rank 1's 3-stop profile + sparkle motes).
// Seven of the sixteen study maps build night and dungeon mood the same way:
// a global cool dark veil punched through by warm pools whose colours
// re-saturate while the ground texture stays visible through the tint.
// This is a pure post-pass over the bake's RGBA pixels — the field, painters
// and exports know nothing about lighting, and daylight (ambient 1) is a
// no-op so lit-less maps render bit-identically.

import { hash2 } from "./valueNoise";

/** One light pool in world/document px (from MapLightingSnapshot). */
export interface BakeLight {
  x: number;
  y: number;
  radius: number;
  color: string;
  intensity: number;
  /**
   * Overdrive (night cave study): how far this pool may lift pixels ABOVE their
   * unlit value, as a fraction of the light's own colour added at the core.
   *
   * Without it a pool can only CANCEL the ambient veil — the lit ground tops out
   * at exactly its unlit colour, so a lantern on dark sand reads as "less dark"
   * rather than as a light source, and a night map can never show the bright
   * warm pools the corpus builds its mood from. Omitted/0 ⇒ the shipped
   * veil-cancel-only behaviour, bit for bit.
   */
  gain?: number;
}

export interface BakeLighting {
  /** 1 = daylight (no veil) … 0 = deepest night. */
  ambient: number;
  lights: readonly BakeLight[];
}

/** The veil never reaches full black — token play must stay readable. */
const MAX_VEIL = 0.78;
/** How strongly a pool re-tints the ground toward the light colour at night. */
const TINT = 0.45;
/** The veil picks up a cool night cast: red is dimmed hardest, blue least. */
const VEIL_COOL = 0.12;

/** 3-stop pool profile (catalog rank 1 — the corpus' dominant light shape):
 * a HOT CORE at full strength to 30 % of the radius, a halo falling smoothly
 * to the knee at the radius, then a broad low WASH fading to nothing at
 * 2.75× the radius — lamplight that spills across the street instead of a
 * hard-edged disc. Strength is later scaled by the light's intensity. */
const CORE_END = 0.3;
const HALO_KNEE = 0.35;
const WASH_REACH = 2.75;
function poolProfile(d: number): number {
  if (d <= CORE_END) return 1;
  if (d <= 1) {
    const u = (d - CORE_END) / (1 - CORE_END);
    return 1 - (1 - HALO_KNEE) * u * u * (3 - 2 * u);
  }
  const u = (d - 1) / (WASH_REACH - 1);
  const fall = 1 - u;
  return HALO_KNEE * fall * fall;
}

const parseHex = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

/** Sparkle motes (catalog rank 1): 4–8 single-pixel glints per pool, placed
 * by hash2 in polar coords around the light (seeded from its rounded world
 * position, so motes are stable across bakes), pulled toward the light colour
 * lifted near white. Strength rides the veil — daylight draws nothing, so the
 * ambient-1 no-op stays bit-identical. */
const MOTE_SPREAD = 0.85; // motes live inside the halo, never the wash
const MOTE_LIFT = 90; // how far above the light colour a glint reaches
function paintSparkleMotes(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  originX: number,
  originY: number,
  veil: number,
  lights: readonly { x: number; y: number; radius: number; rgb: [number, number, number] }[],
): void {
  if (veil <= 0) return;
  for (const light of lights) {
    if (light.radius <= 0) continue;
    const seed = Math.floor(hash2(Math.round(light.x), Math.round(light.y), 909) * 0x7fffffff);
    const count = 4 + Math.floor(hash2(0, 1, seed) * 4.9999); // 4–8 per pool
    for (let m = 0; m < count; m += 1) {
      const ang = hash2(m, 2, seed) * Math.PI * 2;
      const rad = Math.sqrt(hash2(m, 3, seed)) * light.radius * MOTE_SPREAD;
      const mx = Math.round(light.x + Math.cos(ang) * rad - originX - 0.5);
      const my = Math.round(light.y + Math.sin(ang) * rad - originY - 0.5);
      if (mx < 0 || my < 0 || mx >= width || my >= height) continue;
      const o = (my * width + mx) * 4;
      if (pixels[o + 3] === 0) continue; // never glint over transparency
      const a = 0.85 * veil;
      pixels[o] = pixels[o]! + (Math.min(255, light.rgb[0] + MOTE_LIFT) - pixels[o]!) * a;
      pixels[o + 1] =
        pixels[o + 1]! + (Math.min(255, light.rgb[1] + MOTE_LIFT) - pixels[o + 1]!) * a;
      pixels[o + 2] =
        pixels[o + 2]! + (Math.min(255, light.rgb[2] + MOTE_LIFT) - pixels[o + 2]!) * a;
    }
  }
}

/** True when this lighting state would change any pixel. */
export function lightingActive(lighting: BakeLighting | undefined): boolean {
  return lighting !== undefined && (lighting.ambient < 1 || lighting.lights.length > 0);
}

/**
 * Darken the baked pixels by the ambient veil, carving warm pools around the
 * lights: a pool locally cancels the veil through the 3-stop profile (hot
 * core → falling halo → broad wash to 2.75× the radius) and, at night,
 * re-tints the ground toward its colour — light that visibly TOUCHES the
 * ground instead of floating as a sticker. The tint is veil-scaled, so
 * daylight (ambient 1) stays a numeric no-op even with lights placed.
 * Transparent pixels stay untouched. `originX/originY` place pixel (0,0) in
 * world coordinates.
 */
export function applyBakeLighting(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  originX: number,
  originY: number,
  lighting: BakeLighting,
): void {
  if (!lightingActive(lighting)) return;
  const veil = (1 - lighting.ambient) * MAX_VEIL;
  const lights = lighting.lights.map((light) => ({
    x: light.x,
    y: light.y,
    reach2: light.radius * WASH_REACH * (light.radius * WASH_REACH),
    radius: light.radius,
    intensity: light.intensity,
    gain: light.gain ?? 0,
    rgb: parseHex(light.color),
  }));

  for (let py = 0; py < height; py += 1) {
    const wy = originY + py + 0.5;
    for (let pxi = 0; pxi < width; pxi += 1) {
      const o = (py * width + pxi) * 4;
      if (pixels[o + 3] === 0) continue;
      const wx = originX + pxi + 0.5;

      // Strongest pool at this pixel (max, not sum — overlapping torches
      // plateau instead of blowing out) and its light's colour for the tint.
      let pool = 0;
      let tintRgb: [number, number, number] | null = null;
      let lift = 0;
      for (const light of lights) {
        const dx = wx - light.x;
        const dy = wy - light.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= light.reach2 || light.radius <= 0) continue;
        const s = light.intensity * poolProfile(Math.sqrt(d2) / light.radius);
        if (s > pool) {
          pool = s;
          tintRgb = light.rgb;
          lift = s * light.gain;
        }
      }
      if (pool > 1) pool = 1;

      const effVeil = veil * (1 - pool);
      // Cool-cast veil: night light loses red first.
      const keepR = 1 - effVeil * (1 + VEIL_COOL);
      const keepG = 1 - effVeil;
      const keepB = 1 - effVeil * (1 - VEIL_COOL);
      let r = pixels[o]! * (keepR < 0 ? 0 : keepR);
      let g = pixels[o + 1]! * keepG;
      let b = pixels[o + 2]! * keepB;
      if (tintRgb && veil > 0) {
        const t = TINT * pool * veil;
        r += (tintRgb[0] - r) * t;
        g += (tintRgb[1] - g) * t;
        b += (tintRgb[2] - b) * t;
      }
      // Overdrive: ADD the light's own colour so the pool can climb above the
      // unlit ground — what makes a lantern read as a source rather than a
      // hole in the veil. Unlike the veil/tint terms this is NOT veil-scaled:
      // a lamp is as bright at dusk as at midnight, the dark around it is what
      // changes. Zero gain leaves the shipped behaviour untouched.
      if (tintRgb && lift > 0) {
        r += tintRgb[0] * lift;
        g += tintRgb[1] * lift;
        b += tintRgb[2] * lift;
      }
      pixels[o] = r > 255 ? 255 : r;
      pixels[o + 1] = g > 255 ? 255 : g;
      pixels[o + 2] = b > 255 ? 255 : b;
    }
  }
  paintSparkleMotes(pixels, width, height, originX, originY, veil, lights);
}
