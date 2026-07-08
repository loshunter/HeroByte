// Procedural terrain FIELD — the bumpy grass↔dirt↔path boundary render
// (Slynyrd "Grass/Dirt Connection Tiles", pg-50). Superseding the baked blob47
// silhouette: instead of tiling rounded quarters, the boundary between two
// families is a world-coherent noise-displaced field, so edges are organically
// bumpy and never repeat. Families layer by PRIORITY (grass over dirt over
// path); the higher family rounds its shading rim over the lower, which fills
// flat underneath (revealed at the higher family's receded edges). Light comes
// from the top-right, so the raised higher family casts a soft shadow on the
// lower one's lower-left.
//
// Pure and canvas-agnostic: it fills an RGBA pixel buffer (document-space, one
// buffer pixel per world pixel), which the surfaces blit — baked once per edit,
// then displayed like an image map. Interior DECORATION (grass blades, dirt
// pebbles) is a separate fillRect pass layered on top by the caller; this
// module paints only the base/rim/shadow field. Palette is data (terrainPalette).
// The per-pixel colour AND the signed field the caller clips detail against are
// both served by one sampler (createTerrainField), so there is a single field
// implementation. Validated in temp/_dirt_path_proto/transition_v2_proto.mjs.

import { smoothstep, valueNoise } from "./valueNoise";

/** One terrain family in the field render. */
export interface TerrainFieldFamily {
  assetId: string;
  /** Higher draws OVER lower — grass(3) > dirt(2) > path(1). */
  priority: number;
  /** Silhouette base fill (hex). */
  base: string;
  /** Boundary shading-lip colour (hex). */
  rim: string;
}

export interface TerrainFieldConfig {
  /** The family painted at a cell, or null for empty. */
  familyAt(cellX: number, cellY: number): string | null;
  families: readonly TerrainFieldFamily[];
  /** World px per cell. */
  cellSize: number;
  /** World coordinate of buffer pixel (0, 0). */
  originX: number;
  originY: number;
  /** World coordinate of the cell lattice origin (grid offset). Defaults to 0
   * so callers with a zero-offset grid can omit it. */
  offsetX?: number;
  offsetY?: number;
}

/** An RGB triple, 0–255 per channel. */
export type FieldRgb = [number, number, number];

/** The one field sampler: the composited pixel colour, and the signed field a
 * caller clips interior detail against (>= 0 is inside that family). */
export interface TerrainField {
  /** Pass-1 composited colour (base / rim / cast shadow) at a world point, or
   * null when no family paints there. */
  colorAt(wx: number, wy: number): FieldRgb | null;
  /** Signed field for one family at a world point; >= 0 is inside it,
   * >= TERRAIN_RIM is past its shading lip. Unknown ids sample as absent. */
  sampleField(assetId: string, wx: number, wy: number): number;
}

// Tuning — validated in the prototype.
export const TERRAIN_RIM = 0.16; // shading-lip band width, in field units
const SHADOW = 0.15; // cast-shadow band width on the lower family
const AMP = 0.9; // boundary bump amplitude
const SHADOW_STRENGTH = 0.16;

const parseHex = (h: string): FieldRgb => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

interface FieldFamily {
  assetId: string;
  priority: number;
  base: FieldRgb;
  rim: FieldRgb;
  seed: number;
}

/**
 * Build the shared field sampler for a terrain config. `colorAt` and
 * `sampleField` are the ONLY field math in the codebase, so the per-pixel bake
 * and the caller's detail-clipping can never diverge (F10). Pure and
 * deterministic on the world lattice.
 */
export function createTerrainField(config: TerrainFieldConfig): TerrainField {
  const { familyAt, cellSize } = config;
  const offsetX = config.offsetX ?? 0;
  const offsetY = config.offsetY ?? 0;
  // Low → high priority; precompute rgb + a distinct noise seed per family so
  // adjacent boundaries don't share the exact same bumps.
  const fams: FieldFamily[] = [...config.families]
    .sort((a, b) => a.priority - b.priority)
    .map((f) => ({
      assetId: f.assetId,
      priority: f.priority,
      base: parseHex(f.base),
      rim: parseHex(f.rim),
      seed: f.priority * 97 + 3,
    }));
  const byId = new Map(fams.map((f) => [f.assetId, f]));
  const priorityOf = new Map(config.families.map((f) => [f.assetId, f.priority]));
  const fillPriority = (cx: number, cy: number): number => {
    const id = familyAt(cx, cy);
    return id ? (priorityOf.get(id) ?? 0) : 0;
  };
  const ns = cellSize * 1.15;
  const disp = (wx: number, wy: number, seed: number): number =>
    (valueNoise(wx / ns, wy / ns, seed) - 0.5) * AMP +
    (valueNoise(wx / (ns * 0.5) + 13, wy / (ns * 0.5) + 7, seed + 1) - 0.5) * AMP * 0.45;
  // Bilinear sample of a family's indicator (a cell counts when its fill
  // priority ≥ P, so lower families fill UNDER higher ones = underfill). World
  // coords map to the cell lattice through the grid offset.
  const bilinearIndicator = (p: number, wx: number, wy: number): number => {
    const gx = (wx - offsetX) / cellSize - 0.5;
    const gy = (wy - offsetY) / cellSize - 0.5;
    const i0 = Math.floor(gx);
    const j0 = Math.floor(gy);
    const fx = smoothstep(gx - i0);
    const fy = smoothstep(gy - j0);
    const ind = (ix: number, iy: number): number => (fillPriority(ix, iy) >= p ? 1 : 0);
    const top = ind(i0, j0) * (1 - fx) + ind(i0 + 1, j0) * fx;
    const bot = ind(i0, j0 + 1) * (1 - fx) + ind(i0 + 1, j0 + 1) * fx;
    return top * (1 - fy) + bot * fy;
  };
  // Signed field; ≥ 0 is inside. `prox` peaks at the boundary and is 0 in solid
  // interior, so the bump never punches a hole through solid ground.
  const fieldOf = (f: FieldFamily, wx: number, wy: number): number => {
    const base = bilinearIndicator(f.priority, wx, wy);
    const prox = 1 - Math.abs(2 * base - 1);
    return base - 0.5 + disp(wx, wy, f.seed) * prox;
  };
  const colorAt = (wx: number, wy: number): FieldRgb | null => {
    let color: FieldRgb | null = null;
    for (const f of fams) {
      const v = fieldOf(f, wx, wy);
      if (v >= 0) {
        color = v < TERRAIN_RIM ? f.rim : f.base;
      } else if (
        color &&
        v > -SHADOW &&
        fieldOf(f, wx + cellSize * 0.14, wy - cellSize * 0.14) >= 0
      ) {
        // Cast shadow: this higher family is present up-right, so darken the
        // lower family already painted here (its shadowed lower-left edge).
        const k = SHADOW_STRENGTH * (1 + v / SHADOW); // v in (-SHADOW,0) → fades out
        color = [
          Math.round(color[0] * (1 - k)),
          Math.round(color[1] * (1 - k)),
          Math.round(color[2] * (1 - k)),
        ];
      }
    }
    return color;
  };
  const sampleField = (assetId: string, wx: number, wy: number): number => {
    const f = byId.get(assetId);
    return f ? fieldOf(f, wx, wy) : Number.NEGATIVE_INFINITY;
  };
  return { colorAt, sampleField };
}

/**
 * Render the terrain base/rim/shadow field into an RGBA buffer. Painted pixels
 * get alpha 255; empty (no family, or a higher family's carved edge over
 * nothing) stays transparent. Thin wrapper over the shared sampler so the bake
 * and detail-clipping share one field.
 */
export function renderTerrainField(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  config: TerrainFieldConfig,
): void {
  const { colorAt } = createTerrainField(config);
  const { originX, originY } = config;
  for (let py = 0; py < height; py += 1) {
    const wy = originY + py + 0.5;
    for (let pxi = 0; pxi < width; pxi += 1) {
      const wx = originX + pxi + 0.5;
      const color = colorAt(wx, wy);
      if (color) {
        const o = (py * width + pxi) * 4;
        pixels[o] = color[0];
        pixels[o + 1] = color[1];
        pixels[o + 2] = color[2];
        pixels[o + 3] = 255;
      }
    }
  }
}
