// ============================================================================
// FRAME BAKE — a TokenFrame into an RGBA bitmap (C5a)
// ============================================================================
// generate (band space) → warp (onto the circle) → light (per facet, the one
// table light) → rasterise (raster.ts). Pure: plain arrays in, bytes out, so
// it runs in a worker, under Node for the contact sheet, and in the tests.
// The bitmap is a square `tier` pixels across covering 2 × `extent` token
// units round the token's centre; the window inside the bands is left clear
// for the picture, apart from its contact shadow.

import { createSeededRng } from "../../rng.js";
import type { TokenSize } from "../../index.js";
import { FRAME_PALETTES } from "../frameCatalog.generated.js";
import { frameGeneratorSpec, resolveFrameParams } from "../generatorSpecs.js";
import { framePaletteById } from "../catalogLookup.js";
import type { FramePalette, FrameRole, TokenFrame } from "../types.js";
import {
  bandLength,
  courseCount,
  layoutFrame,
  warpPoint,
  warpPolygon,
  type BandRing,
  type FrameLayout,
} from "./bandSpace.js";
import {
  bandEdgeFacets,
  dropShadowFacets,
  stepFacets,
  windowShadowFacets,
  type EdgeFacet,
} from "./frameEdges.js";
import { FRAME_GENERATORS } from "./generators/index.js";
import { FRAME_MOTIF_BUDGET } from "./generators/common.js";
import { createRaster, fillPolygon, rasterToRgba } from "./raster.js";
import {
  mixRgb,
  personalRoleColor,
  resolvePalette,
  shade,
  slopeNormal,
  UP,
  type ResolvedPalette,
  type Vec3,
} from "./shading.js";
import type { Rgb } from "../../colorSpace.js";

export interface FrameBakeInput {
  frame: TokenFrame;
  size?: TokenSize;
  /** What a "personal" palette role resolves to: the frame's colour (the character's, or one picked). */
  accent: string;
  /** What a "personal" glow resolves to: the character's own colour. Default: `accent`. */
  personal?: string;
  /** The token's own seed (frameSeed); a band's `seed` wins over it. */
  seed: number;
  /** The bitmap's edge in pixels. */
  tier: number;
  /** For the build script's freshly checked catalog; the shipped one otherwise. */
  palettes?: Readonly<Record<string, FramePalette>>;
}

export interface FrameBakeResult {
  pixels: Uint8ClampedArray;
  tier: number;
  layout: FrameLayout;
}

/** One facet ready to fill: token-space polygon, colour, opacity. */
interface Paint {
  points: number[];
  color: Rgb;
  alpha: number;
}

/** A token id into a 32-bit seed (FNV-1a): the same stones on every client. */
export function frameSeed(tokenId: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < tokenId.length; index += 1) {
    hash ^= tokenId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}

/** The seed band `index` actually uses. */
export function bandSeed(frame: TokenFrame, index: number, seed: number): number {
  return frame.bands[index]?.seed ?? (seed + Math.imul(index + 1, 0x9e3779b1)) | 0;
}

/**
 * The frame with each seeded band's seed written in, from the token it was
 * drawn on: carried to another token (an NPC placed again, a character file
 * loaded at another table) it lays the same stones, not new ones.
 */
export function pinFrameSeeds(frame: TokenFrame, tokenId: string): TokenFrame {
  const seed = frameSeed(tokenId);
  return {
    ...frame,
    bands: frame.bands.map((band, index) =>
      band.seed === undefined && frameGeneratorSpec(band.generator)?.seeded
        ? { ...band, seed: bandSeed(frame, index, seed) }
        : band,
    ),
  };
}

/** The ring between radii r0 and r1 as one polygon (its two seam edges coincide and cancel). */
function annulus(r0: number, r1: number, steps = 180): number[] {
  const points: number[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const angle = (step / steps) * Math.PI * 2;
    points.push(r0 * Math.cos(angle), r0 * Math.sin(angle));
  }
  for (let step = steps; step >= 0; step -= 1) {
    const angle = (step / steps) * Math.PI * 2;
    points.push(r1 * Math.cos(angle), r1 * Math.sin(angle));
  }
  return points;
}

function centroid(points: readonly number[]): [number, number] {
  let x = 0;
  let y = 0;
  for (let index = 0; index < points.length; index += 2) {
    x += points[index]!;
    y += points[index + 1]!;
  }
  const count = points.length / 2;
  return [x / count, y / count];
}

function ringPaints(
  ring: BandRing,
  index: number,
  input: FrameBakeInput,
  palette: ResolvedPalette,
  layout: FrameLayout,
): Paint[] {
  const { band } = ring;
  const generate = frameGeneratorSpec(band.generator)
    ? FRAME_GENERATORS[band.generator]!
    : FRAME_GENERATORS.plain!;
  const length = bandLength(ring);
  const courses = courseCount(ring);
  const middle = (ring.r0 + ring.r1) / 2;
  const facets = generate({
    length,
    courses,
    courseScale: (course) => (ring.r0 + (ring.r1 - ring.r0) * ((course + 0.5) / courses)) / middle,
    params: resolveFrameParams(band.generator, band.params),
    rng: createSeededRng(bandSeed(input.frame, index, input.seed)),
    maxMotifs: Math.max(3, Math.floor(FRAME_MOTIF_BUDGET / (input.frame.bands.length * courses))),
    bandPx: ((ring.r1 - ring.r0) * input.tier) / (2 * layout.extent),
  });
  const glow = band.glow
    ? band.glow.color === "personal"
      ? personalRoleColor(input.personal ?? input.accent, "glow")
      : personalRoleColor(band.glow.color, "tint")
    : null;
  const paints: Paint[] = [];
  for (const facet of facets) {
    const points = warpPolygon(ring, length, facet.points);
    let role: FrameRole = facet.role;
    const base = palette.roles[role];
    if (glow && (role === "crack" || role === "glow")) {
      // A glowing crack shines on its own: no light, its colour over the crack's.
      paints.push({
        points,
        color: mixRgb(base, glow, band.glow!.strength),
        alpha: facet.alpha ?? 1,
      });
      continue;
    }
    if (role === "glow") role = "crack"; // no glow on this band: the channel stays dark
    let normal: Vec3 = UP;
    if (facet.tilt) {
      const [cx, cy] = centroid(points);
      const [fx, fy] = warpPoint(ring, length, facet.tilt.from[0], facet.tilt.from[1]);
      normal = slopeNormal(cx - fx, cy - fy, facet.tilt.pitch);
    }
    paints.push({
      points,
      color: shade(palette.roles[role], normal, palette, role),
      alpha: facet.alpha ?? 1,
    });
  }
  const bevel = band.bevel ?? frameGeneratorSpec(band.generator)?.bevel;
  if (bevel) {
    for (const edge of bandEdgeFacets(ring.r0, ring.r1, bevel.profile, bevel.width)) {
      paints.push(edgePaint(edge, palette, "bevel"));
    }
  }
  return paints;
}

function edgePaint(edge: EdgeFacet, palette: ResolvedPalette | null, role: FrameRole): Paint {
  if (edge.kind === "shadow" || !palette) {
    return { points: edge.points, color: { r: 0, g: 0, b: 0 }, alpha: edge.alpha };
  }
  return {
    points: edge.points,
    color: shade(palette.roles[role], edge.normal, palette, role),
    alpha: edge.alpha,
  };
}

/** Every facet of the frame, in paint order, in token units. */
export function framePaints(input: FrameBakeInput): { paints: Paint[]; layout: FrameLayout } {
  const catalog = input.palettes ?? FRAME_PALETTES;
  const layout = layoutFrame(input.frame, input.size);
  const fallback = framePaletteById("stone.grey", catalog)!;
  const palettes = layout.rings.map((ring) =>
    resolvePalette(framePaletteById(ring.band.palette, catalog) ?? fallback, input.accent),
  );
  const paints: Paint[] = [];
  // Loops, never push(...many): a big frame is tens of thousands of facets.
  const add = (more: readonly Paint[]) => {
    for (const paint of more) paints.push(paint);
  };
  if (layout.outset > 0) {
    add(dropShadowFacets(layout.outer).map((edge) => edgePaint(edge, null, "shadow")));
  }
  // Where two bands meet, a thin opaque strip under the joint: their smoothed
  // edges blend into it instead of letting the map show through. Only there,
  // so the frame's own outer and inner edges keep their smoothing.
  const pixel = (2 * layout.extent) / input.tier;
  for (let index = 0; index + 1 < layout.rings.length; index += 1) {
    const joint = layout.rings[index]!.r1;
    add([
      {
        points: annulus(joint - 2 * pixel, joint + 2 * pixel),
        color: palettes[index]!.roles.outline,
        alpha: 1,
      },
    ]);
  }
  layout.rings.forEach((ring, index) =>
    add(ringPaints(ring, index, input, palettes[index]!, layout)),
  );
  // Steps between neighbouring bands of different height, over both of them.
  for (let index = 0; index + 1 < layout.rings.length; index += 1) {
    const inner = layout.rings[index]!;
    const outer = layout.rings[index + 1]!;
    const rise = inner.band.depth - outer.band.depth;
    if (Math.abs(rise) < 0.05) continue;
    const tallerInside = rise > 0;
    const taller = tallerInside ? inner : outer;
    const lower = tallerInside ? outer : inner;
    const { side, shadow } = stepFacets(
      inner.r1,
      Math.abs(rise),
      tallerInside,
      Math.min(0.45 * (taller.r1 - taller.r0), 0.03 * Math.abs(rise)),
      0.8 * (lower.r1 - lower.r0),
    );
    const tallerPalette = palettes[tallerInside ? index : index + 1]!;
    add(side.map((edge) => edgePaint(edge, tallerPalette, "side")));
    add(shadow.map((edge) => edgePaint(edge, null, "shadow")));
  }
  const innermost = layout.rings[0];
  if (innermost) {
    add(
      windowShadowFacets(layout.window, innermost.band.depth).map((edge) =>
        edgePaint(edge, null, "shadow"),
      ),
    );
  }
  return { paints, layout };
}

/** The frame as straight-alpha RGBA, `tier` pixels square. */
export function bakeFrame(input: FrameBakeInput): FrameBakeResult {
  const { paints, layout } = framePaints(input);
  const size = input.tier;
  const raster = createRaster(size);
  const scale = size / (2 * layout.extent);
  const pixels: number[] = [];
  for (const paint of paints) {
    pixels.length = paint.points.length;
    for (let index = 0; index < paint.points.length; index += 1) {
      pixels[index] = (paint.points[index]! + layout.extent) * scale;
    }
    fillPolygon(raster, pixels, paint.color, paint.alpha);
  }
  return { pixels: rasterToRgba(raster), tier: size, layout };
}
