// ============================================================================
// VISION RADIUS — how far a token can see, and what that means in each space
// ============================================================================
// Split out of visibility.ts, which owns the SWEEP. This module owns the
// UNITS: a radius is authored in feet, the grid measures feet in squares, the
// squares measure world pixels, and the sweep runs in map-document pixels.
// Getting that chain wrong is invisible at the default map scale of 1 and
// wrong by exactly the scale factor at any other, which is why both halves of
// the app call the one function here rather than spelling the chain twice.

import type { SceneTransform } from "./sceneGeometry.js";

/**
 * A sight radius expressed in MAP-DOCUMENT space, where the sweep runs.
 *
 * It is an axis-aligned ELLIPSE rather than a circle, and that is exact rather
 * than an approximation. `inverseTransformScenePoint` rotates by `-rotation`
 * and then divides by `scaleX` and `scaleY` INDEPENDENTLY; rotation maps a
 * circle to a circle, so only the scale survives. A world-space circle of
 * radius r therefore lands in document space as the axis-aligned ellipse with
 * semi-axes `r / |scaleX|` and `r / |scaleY|` — whatever the rotation is.
 * Under the uniform scale every transform the UI can produce today, the two
 * semi-axes are equal and this is a plain circle.
 */
export interface VisionRadius {
  /** Semi-axis along document X, in document units. */
  x: number;
  /** Semi-axis along document Y, in document units. */
  y: number;
}

/**
 * `Token.visionRadius` (FEET) -> the document-space ellipse to clip against,
 * or `null` for unlimited sight.
 *
 * Both halves of the app call THIS. The chain is
 * feet -> squares -> world pixels -> document units, and every step needs a
 * number the other side also has: `gridSize` and `gridSquareSize` ride the
 * snapshot, and the map transform is the published map scene object's. Doing
 * the conversion in two places is precisely how client fog and server
 * filtering would come to disagree by exactly the map's scale factor.
 *
 * - `undefined`, `null`, or a non-finite value means UNLIMITED — the pre-S7
 *   behaviour, so a token nobody has configured sees exactly as far as it
 *   always did. (`Infinity` is a legitimate spelling of unlimited; `NaN`
 *   cannot survive JSON and is coerced away at every entry point, so treating
 *   it as unlimited keeps a coercion bug from silently blinding a table.)
 * - Zero or negative means BLIND, and that is a real setting rather than an
 *   error: it is how a DM takes a token's sight away.
 * - A non-positive or non-finite `gridSize`/`gridSquareSize` means there is no
 *   grid to measure feet against, so the radius cannot be expressed and sight
 *   falls back to unlimited rather than to a garbage ellipse.
 */
export function tokenVisionRadius(input: {
  /** `Token.visionRadius`, in feet. Undefined means unlimited. */
  radiusFeet?: number | null;
  /** World pixels per grid square (`RoomState.gridSize`). */
  gridSize: number;
  /** Feet per grid square (`RoomState.gridSquareSize`, default 5). */
  gridSquareSize: number;
  /** The live map transform, when the DM has moved or scaled the published art. */
  mapTransform?: SceneTransform;
}): VisionRadius | null {
  const { radiusFeet, gridSize, gridSquareSize, mapTransform } = input;
  if (radiusFeet === undefined || radiusFeet === null || !Number.isFinite(radiusFeet)) {
    return null;
  }
  if (radiusFeet <= 0) {
    return { x: 0, y: 0 };
  }
  if (!Number.isFinite(gridSize) || gridSize <= 0) return null;
  if (!Number.isFinite(gridSquareSize) || gridSquareSize <= 0) return null;

  const worldRadius = (radiusFeet / gridSquareSize) * gridSize;
  const scaleX = Math.abs(mapTransform?.scaleX ?? 1);
  const scaleY = Math.abs(mapTransform?.scaleY ?? 1);
  // A degenerate scale collapses the document onto a line; there is no sane
  // ellipse to clip against, so decline to clip rather than blind the viewer.
  if (!Number.isFinite(scaleX) || scaleX <= 0) return null;
  if (!Number.isFinite(scaleY) || scaleY <= 0) return null;

  const semi = { x: worldRadius / scaleX, y: worldRadius / scaleY };
  // FAIL CLOSED on a radius too small to be a radius. Below this the geometry
  // divides by the semi-axes and overflows: the segment prune drops every
  // occluder and the ray limit stops being finite, so a viewer would have seen
  // the whole published map straight through every wall. Anything under a
  // thousandth of a document pixel is indistinguishable from blind anyway, and
  // "blind" is the safe reading of "sees essentially nothing".
  //
  // The validator's range is [0, 1000] FEET, which admits a positive subnormal,
  // and `coerceVisionRadius` clamps rather than rejects — so a hand-edited state
  // or session file can put one here. The geometry also guards itself
  // (`rayDistanceToRadius`), because one layer is not a guarantee.
  if (semi.x < MIN_USABLE_SEMI_AXIS || semi.y < MIN_USABLE_SEMI_AXIS) {
    return { x: 0, y: 0 };
  }
  return semi;
}

/** Document units below which a sight radius is treated as blind, not tiny. */
const MIN_USABLE_SEMI_AXIS = 1e-3;

/**
 * Bounds on `Token.visionRadius`, in feet. Zero is blind; the ceiling is far
 * past any lantern in any ruleset and exists only so a hand-edited state file
 * cannot put an absurd number into the geometry. Beyond unlimited there is
 * nothing left to see anyway — the sweep already stops at the scene bounds.
 */
export const VISION_RADIUS_MIN_FEET = 0;
export const VISION_RADIUS_MAX_FEET = 1000;

/**
 * Coerce an untrusted vision radius, for the two paths that read one off disk
 * (the room state file and an uploaded session file — "the least trustworthy
 * source there is"). Anything that is not a finite number becomes `undefined`,
 * i.e. UNLIMITED: that is the pre-S7 behaviour, so a corrupt field degrades to
 * the way fog has always worked rather than silently blinding a table.
 *
 * The same reasoning as `coerceDiagonalRule`, which exists because the maths
 * downstream must only ever branch on values it can actually handle.
 */
export function coerceVisionRadius(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(VISION_RADIUS_MAX_FEET, Math.max(VISION_RADIUS_MIN_FEET, value));
}

/**
 * Apply `coerceVisionRadius` across a token list arriving from an untrusted
 * source. Tokens are the one collection both restore paths copy VERBATIM —
 * `StatePersistence` and `SnapshotLoader` do no per-field work on them at all
 * — so this is the only hook where a hand-edited `visionRadius` can be caught
 * before it reaches the geometry. Unchanged tokens keep their identity.
 */
export function coerceTokenVisionRadii<T extends { visionRadius?: number }>(
  tokens: readonly T[],
): T[] {
  if (!Array.isArray(tokens)) return [];
  return tokens.map((token) => {
    const coerced = coerceVisionRadius(token.visionRadius);
    if (coerced === token.visionRadius) return token;
    const next = { ...token };
    if (coerced === undefined) {
      delete next.visionRadius;
    } else {
      next.visionRadius = coerced;
    }
    return next;
  });
}
