// ============================================================================
// FRAME TIERS — which bitmap size a frame is baked at (C5a)
// ============================================================================
// A frame is polygons, so any tier is crisp; the tier only decides how many
// pixels it costs. It is chosen from the frame's edge on screen (token × zoom
// × devicePixelRatio) with hysteresis, so a zoom step back and forth across a
// boundary does not re-bake every time: a bitmap is allowed to stretch 8%
// before the next tier is baked, and the smaller tier is taken only once the
// frame has shrunk 15% below it. Phones stop at 512.

export const FRAME_TIERS = [128, 256, 512, 1024] as const;
/** How far a bitmap may be stretched before the next tier up is baked. */
export const TIER_STRETCH = 1.08;
/** How far below a smaller tier the frame must shrink before that tier is taken. */
export const TIER_SHRINK = 0.85;
export const COARSE_TIER_CAP = 512;

/** The tier for a frame `needed` pixels across on screen, given the tier it has now. */
export function pickFrameTier(needed: number, current: number | null, coarse: boolean): number {
  const cap = coarse ? COARSE_TIER_CAP : FRAME_TIERS[FRAME_TIERS.length - 1]!;
  const tiers = FRAME_TIERS.filter((tier) => tier <= cap);
  const ideal = tiers.find((tier) => tier >= needed) ?? cap;
  if (current === null || !tiers.includes(current as (typeof FRAME_TIERS)[number])) return ideal;
  if (ideal > current) return needed > current * TIER_STRETCH ? ideal : current;
  if (ideal < current) return needed <= ideal * TIER_SHRINK ? ideal : current;
  return current;
}

/** Phones and tablets: the smaller cache and the 512 cap. */
export function isCoarsePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;
}
