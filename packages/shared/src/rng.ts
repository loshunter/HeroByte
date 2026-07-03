// ============================================================================
// Seeded RNG — the determinism contract's foundation
// ============================================================================
// Same seed, same sequence, on every platform: the scatter brush, generation
// recipes, and Cartridge Codes all build on this. Mulberry32: tiny, fast, and
// statistically solid for content generation (not cryptography).

/** A deterministic stream of floats in [0, 1). */
export type SeededRng = () => number;

export function createSeededRng(seed: number): SeededRng {
  // Hash the (possibly zero, negative, or fractional) seed into 32 bits with
  // EXACT 32-bit modular arithmetic. A float64 product here rounds away low
  // bits for seeds above ~3.4M — collapsing the upper half of the 32-bit
  // seed range into ~2^21 identical streams (found by adversarial review,
  // reproduced byte-for-byte). Math.imul is exact mod 2^32; the fractional
  // part folds in separately so fractional seeds stay distinct.
  const integer = Math.floor(seed);
  const fraction = seed - integer;
  let state =
    (Math.imul(integer, 0x9e3779b9) ^ Math.floor(fraction * 0x100000000) ^ 0x6d2b79f5) | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
