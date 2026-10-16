// ============================================================================
// FRAME LIMITS AND THE TABLE LIGHT (C5a)
// ============================================================================
// The numbers both ends agree on. FRAME_LIGHT is the one light every frame on
// every table is lit by: never a setting, so every token agrees about where
// the light comes from wherever it stands.

import type { TokenSize } from "../index.js";

/**
 * From the top-left. Azimuth is a compass bearing (clockwise from up on the
 * screen, so 315 is up-left); elevation is the angle above the table.
 */
export const FRAME_LIGHT = { azimuthDeg: 315, elevationDeg: 55 } as const;

export const FRAME_LIMITS = {
  MAX_BANDS: 6,
  /** Total weight (the sum of the bands'), as a fraction of the token edge. */
  MIN_WEIGHT: 0.04,
  MAX_WEIGHT: 0.34,
  /** How far a frame may grow OUTSIDE the token box, as a fraction of its edge. */
  MAX_OUTSET: 0.15,
  /** A preset id or a palette id, at most. */
  MAX_ID_LENGTH: 64,
} as const;

/** The weight slider's four named stops. */
export const FRAME_WEIGHTS = {
  skinny: 0.05,
  regular: 0.1,
  bold: 0.16,
  slab: 0.24,
} as const;

export type FrameWeightName = keyof typeof FRAME_WEIGHTS;

/** Cells per edge, as the map draws each size (PROP_SIZE_MULTIPLIERS). */
const SIZE_CELLS: Record<TokenSize, number> = {
  tiny: 0.5,
  small: 0.75,
  medium: 1,
  large: 1.5,
  huge: 2,
  gargantuan: 3,
};

/**
 * Large and bigger tokens wear a thinner frame for their size, or a
 * Gargantuan's ring is a wall: clamp(1 / sqrt(cells), 0.5, 1).
 */
export function frameSizeScale(size: TokenSize | undefined): number {
  const cells = SIZE_CELLS[size ?? "medium"] ?? 1;
  return Math.min(1, Math.max(0.5, 1 / Math.sqrt(cells)));
}
