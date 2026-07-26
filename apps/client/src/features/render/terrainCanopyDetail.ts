// Canopy interior decoration (catalog rank 9) — sparse 2–4px leaf ticks
// standing in for thousands of leaves, plus sun-caught highlight clusters
// biased toward the crown's silhouette. Pure deterministic fillRect art over
// the two-tone field base, world-lattice keyed like every other cell painter,
// with all colour in the family palette (CanopyDetail) so a mood swap or the
// night grade reaches the leaves and not just the crown beneath them.

import type { TerrainCellRect, TileRenderContext2D } from "./tileRenderCore";
import type { CanopyDetail } from "./terrainPalette";
import { hash2, valueNoise } from "./valueNoise";

/** Highlight clusters only near the silhouette: crown (edge-distance) depth
 * at or under this — matching the lit rim the corpus paints. */
export const CANOPY_HIGHLIGHT_MAX_DEPTH = 1.8;

/**
 * Paint one canopy cell's leaf texture. `depth` is the cell's crown-mass
 * edge distance (the same BFS the field's core darkening reads); shallow
 * cells additionally sprout highlight clusters on their sun-catch side.
 */
export function paintCanopyDetail(
  ctx: TileRenderContext2D,
  cell: TerrainCellRect,
  canopy: { detail: CanopyDetail },
  depth: number,
): void {
  const { x, y, size, cellX, cellY } = cell;
  const d = canopy.detail;
  const inset = size * 0.12;
  const span = size - 2 * inset;
  const p = Math.max(1, size * 0.045);

  // Leaf ticks clump through a coherent noise field (like the tall-grass
  // blobs) instead of scattering uniformly per cell.
  const clump = valueNoise(cellX / 5 + 71, cellY / 5 + 71, 9);
  const ticks = clump > 0.62 ? 9 : clump > 0.4 ? 6 : 3;
  for (let i = 0; i < ticks; i += 1) {
    const tx = x + inset + hash2(cellX * 29 + i, cellY * 13 + i, 92) * span;
    const ty = y + inset + hash2(cellX * 11 + i, cellY * 23 + i, 93) * span;
    ctx.fillStyle = hash2(cellX * 7 + i, cellY * 17 + i, 94) > 0.55 ? d.tickLight : d.tickDark;
    // Alternate 1×2 and 2×1 ticks so the texture reads as leaves, not grain.
    if (hash2(cellX + i, cellY * 3 + i, 95) > 0.5) ctx.fillRect(tx, ty, p, p * 2);
    else ctx.fillRect(tx, ty, p * 2, p);
  }

  // Edge-biased highlight clusters: small sun-caught leaf bunches, densest on
  // the shallowest (silhouette) cells and gone past the depth gate.
  if (depth <= CANOPY_HIGHLIGHT_MAX_DEPTH) {
    const chance = 0.66 - depth * 0.24;
    if (hash2(cellX, cellY, 96) < chance) {
      const hx = x + inset + hash2(cellX, cellY, 97) * (span - 3 * p);
      const hy = y + inset + hash2(cellY, cellX, 98) * (span - 3 * p);
      ctx.fillStyle = d.highlight;
      const dots = 2 + Math.floor(hash2(cellX * 3, cellY * 5, 99) * 2);
      for (let i = 0; i < dots; i += 1) {
        const ox = hash2(cellX + i, cellY - i, 100) * p * 2.4;
        const oy = hash2(cellY + i, cellX - i, 101) * p * 2.4;
        ctx.fillRect(hx + ox, hy + oy, p, p);
      }
    }
  }
}
