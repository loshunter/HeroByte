import type { MapDocument } from "@herobyte/shared";
import { createSeededRng } from "@herobyte/shared";
import { clamp, pickPlacementLayer } from "./components/mapStudioWorkspaceUtils";
import type { MapStudioTileAsset } from "./starterTiles";
import type { MapStampDraft } from "./types";

export interface ScatterOptions {
  /** Stamps per click. */
  count?: number;
  /** Scatter radius, in grid cells around the cursor. */
  radiusCells?: number;
}

/**
 * The seeded scatter brush: one click flings a handful of stamps with
 * position jitter and random rotation, uniformly spread over a disc around
 * the cursor. Deterministic per seed — the same seed always lands the same
 * debris — and emitted as drafts for ONE add-elements command: undo-exact.
 */
export function buildScatterDrafts(
  document: MapDocument,
  asset: MapStudioTileAsset,
  center: { x: number; y: number },
  seed: number,
  options: ScatterOptions = {},
): MapStampDraft[] {
  const layer = pickPlacementLayer(document, asset);
  if (!layer) return [];
  const rng = createSeededRng(seed);
  const count = options.count ?? 7;
  const radius = (options.radiusCells ?? 1.5) * document.grid.size;
  const width = asset.columns * document.grid.size;
  const height = asset.rows * document.grid.size;

  const drafts: MapStampDraft[] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = rng() * Math.PI * 2;
    // sqrt keeps the spread uniform over the disc instead of clumping center.
    const distance = Math.sqrt(rng()) * radius;
    const x = center.x + Math.cos(angle) * distance - width / 2;
    const y = center.y + Math.sin(angle) * distance - height / 2;
    drafts.push({
      layerId: layer.id,
      assetId: asset.id,
      x: Math.round(clamp(x, 0, document.width - width)),
      y: Math.round(clamp(y, 0, document.height - height)),
      width,
      height,
      rotation: Math.floor(rng() * 360),
    });
  }
  return drafts;
}
