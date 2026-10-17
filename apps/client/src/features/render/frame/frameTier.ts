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
  if (ideal < current) {
    // The smallest tier the frame is comfortably (15%) under, if smaller than now.
    const shrunk = tiers.find((tier) => needed <= tier * TIER_SHRINK);
    return shrunk !== undefined && shrunk < current ? shrunk : current;
  }
  return current;
}

/** Phones and tablets: the smaller cache and the 512 cap. */
export function isCoarsePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;
}

/** The share of the cache the map's frames may hold at once; the rest is previews and bitmaps going out. */
export const MAP_FRAME_SHARE = 0.9;

/**
 * The largest tier `bitmaps` distinct frames can all be held at inside the
 * cache's cap: held bitmaps are never evicted, so without it thirty frames
 * at 1024 would be 120 MB against a 48 MB cap (30: 512 on a desktop, 256
 * on a phone; 10: 1024). 128 at the least, even where that does not fit.
 */
export function frameTierCeiling(bitmaps: number, cap: number): number {
  const count = Math.max(1, bitmaps);
  const fits = FRAME_TIERS.filter((tier) => count * tier * tier * 4 <= MAP_FRAME_SHARE * cap);
  return fits[fits.length - 1] ?? FRAME_TIERS[0];
}

/** What every token on the map bakes under: one tier for all, and whether stones are shared. */
export interface FrameTierBudget {
  tier: number;
  /**
   * Past the smallest tier's room, frames alike but for their stones bake
   * with one seed, so they share a bitmap: the stones repeat from token to
   * token, and another screen with room may lay them differently.
   */
  shareSeeds: boolean;
}

/** Room for a quarter more bitmaps is needed before the budget rises again. */
export const BUDGET_RISE_ROOM = 1.25;

/**
 * The budget for `bitmaps` distinct frames on the map. It drops at once, and
 * rises only when a quarter more would still fit, so a token added and
 * taken away at a boundary does not re-bake every frame on the map twice.
 */
export function nextFrameBudget(
  previous: FrameTierBudget | null,
  bitmaps: number,
  cap: number,
): FrameTierBudget {
  const roomy = Math.ceil(Math.max(1, bitmaps) * BUDGET_RISE_ROOM);
  const fresh = frameTierCeiling(bitmaps, cap);
  const tier =
    previous === null || fresh <= previous.tier
      ? fresh
      : Math.max(previous.tier, frameTierCeiling(roomy, cap));
  const smallest = FRAME_TIERS[0] * FRAME_TIERS[0] * 4;
  const overflows = (count: number) => count * smallest > MAP_FRAME_SHARE * cap;
  const shareSeeds = previous?.shareSeeds ? overflows(roomy) : overflows(Math.max(1, bitmaps));
  return { tier, shareSeeds };
}
