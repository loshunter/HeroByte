// Ambient darkness veil + light pools over the baked terrain (Czepeku catalog
// #3). Seven of the sixteen study maps build night and dungeon mood the same
// way: a global cool dark veil punched through by warm elliptical pools whose
// colours re-saturate while the ground texture stays visible through the tint.
// This is a pure post-pass over the bake's RGBA pixels — the field, painters
// and exports know nothing about lighting, and daylight (ambient 1, no lights)
// is a no-op so lit-less maps render bit-identically.

/** One light pool in world/document px (from MapLightingSnapshot). */
export interface BakeLight {
  x: number;
  y: number;
  radius: number;
  color: string;
  intensity: number;
}

export interface BakeLighting {
  /** 1 = daylight (no veil) … 0 = deepest night. */
  ambient: number;
  lights: readonly BakeLight[];
}

/** The veil never reaches full black — token play must stay readable. */
const MAX_VEIL = 0.78;
/** How strongly a pool re-tints the ground toward the light colour at night. */
const TINT = 0.3;
/** The veil picks up a cool night cast: red is dimmed hardest, blue least. */
const VEIL_COOL = 0.12;

const parseHex = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

/** True when this lighting state would change any pixel. */
export function lightingActive(lighting: BakeLighting | undefined): boolean {
  return lighting !== undefined && (lighting.ambient < 1 || lighting.lights.length > 0);
}

/**
 * Darken the baked pixels by the ambient veil, carving warm pools around the
 * lights: a pool locally cancels the veil (smooth radial falloff) and, at
 * night, re-tints the ground toward its colour — light that visibly TOUCHES
 * the ground instead of floating as a sticker. Transparent pixels stay
 * untouched. `originX/originY` place pixel (0,0) in world coordinates.
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
    r2: light.radius * light.radius,
    radius: light.radius,
    intensity: light.intensity,
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
      for (const light of lights) {
        const dx = wx - light.x;
        const dy = wy - light.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= light.r2) continue;
        const t = 1 - d2 / light.r2;
        const s = light.intensity * t * t;
        if (s > pool) {
          pool = s;
          tintRgb = light.rgb;
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
      pixels[o] = r;
      pixels[o + 1] = g;
      pixels[o + 2] = b;
    }
  }
}
