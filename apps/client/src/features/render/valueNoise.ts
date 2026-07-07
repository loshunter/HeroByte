// Deterministic hash + coherent value noise (0..1), dependency-free. The single
// source of terrain noise — the interior-detail painters (terrainDetail) and the
// procedural terrain field (proceduralTerrain) both key off this, so a given
// world point yields the same noise on every surface, every redraw.

/** 32-bit integer hash of (x, y, seed) → [0, 1]. Math.imul keeps 32-bit
 * semantics for negative indices. Note: can return exactly 1 (divides by
 * 2^32 - 1) — callers indexing arrays must guard the boundary. */
export function hash2(x: number, y: number, seed: number): number {
  let h =
    (Math.imul(x | 0, 374761393) ^
      Math.imul(y | 0, 668265263) ^
      Math.imul(seed | 0, 2246822519)) >>>
    0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/** Bilinearly-interpolated, smoothstepped value noise over the integer lattice. */
export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  const u = smoothstep(xf);
  const v = smoothstep(yf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
