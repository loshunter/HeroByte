// ============================================================================
// MAP-EDIT PLACEMENT DRAFTS (pure)
// ============================================================================
// Pure draft builders for the live "place" and "scatter" sub-tools. They wrap
// the Studio's proven placement helpers so the live palette emits byte-identical
// tile/stamp geometry — the same add-element / add-elements commands the Studio
// uses, no server change. Everything here is deterministic (no Math.random): the
// scatter seed is derived from the drop point so a placement is reproducible.

import type { MapDocument } from "@herobyte/shared";
import { createSeededRng } from "@herobyte/shared";
import type { MapStudioTileAsset } from "../map-studio/starterTiles";
import type { MapStampDraft, MapTileDraft } from "../map-studio/types";
import { snapPointToGrid } from "../map-studio/snapToGrid";
import {
  buildStampDraft,
  clamp,
  paintPlacementBounds,
  pickPlacementLayer,
} from "../map-studio/components/mapStudioWorkspaceUtils";

export interface PlacementFootprint {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where a grid-snapped tile of `asset` lands for a click at `point`, in document
 * px — the Studio's paintAtPoint lattice math (snap → clamp within
 * paintPlacementBounds). Used both to build the draft and to draw the ghost, so
 * the preview sits exactly where the placement will.
 */
export function tileFootprint(
  document: MapDocument,
  asset: MapStudioTileAsset,
  point: { x: number; y: number },
): PlacementFootprint {
  const { grid } = document;
  const snapped = snapPointToGrid(point, grid);
  const xBounds = paintPlacementBounds(
    document.width,
    asset.columns,
    grid.size,
    grid.offsetX,
    grid.snap,
  );
  const yBounds = paintPlacementBounds(
    document.height,
    asset.rows,
    grid.size,
    grid.offsetY,
    grid.snap,
  );
  return {
    x: clamp(snapped.x, xBounds.min, xBounds.max),
    y: clamp(snapped.y, yBounds.min, yBounds.max),
    width: asset.columns * grid.size,
    height: asset.rows * grid.size,
  };
}

/**
 * A grid-snapped tile placement (normal click). Refuses to stack an identical
 * tile already sitting at that cell. Null when no layer accepts it or a
 * duplicate is already there.
 */
export function buildTilePlacement(
  document: MapDocument,
  asset: MapStudioTileAsset,
  point: { x: number; y: number },
): MapTileDraft | null {
  const { x, y } = tileFootprint(document, asset, point);
  const duplicate = document.elements.some(
    (element) =>
      element.type === "tile" &&
      element.data.assetId === asset.id &&
      element.transform.x === x &&
      element.transform.y === y,
  );
  if (duplicate) return null;
  const layer = pickPlacementLayer(document, asset);
  if (!layer) return null;
  return { layerId: layer.id, assetId: asset.id, x, y, columns: asset.columns, rows: asset.rows };
}

/**
 * A free-placed stamp centered on the cursor (Alt click), carrying the pending
 * rotation. buildStampDraft clamps the footprint inside the document; we only
 * add the rotation (which the tile-lattice path can't express — createTileElement
 * is axis-aligned). Null when no layer accepts it.
 */
export function buildStampPlacement(
  document: MapDocument,
  asset: MapStudioTileAsset,
  point: { x: number; y: number },
  rotation: number,
): MapStampDraft | null {
  const draft = buildStampDraft(document, asset, point);
  if (!draft) return null;
  return rotation ? { ...draft, rotation } : draft;
}

/**
 * A deterministic scatter seed from the drop point: identical drops reproduce
 * identical debris (golden rule #10 — no Math.random in placement). A spatial
 * hash of the whole-pixel coordinates, coerced to a uint32.
 */
export function scatterSeedFromPoint(point: { x: number; y: number }): number {
  const x = Math.round(point.x) | 0;
  const y = Math.round(point.y) | 0;
  return (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
}

/** Deterministic row seed from both drag endpoints — identical drags rebuild
 * identical rows. */
export function rowSeedFromDrag(
  start: { x: number; y: number },
  end: { x: number; y: number },
): number {
  return (
    (Math.imul(Math.round(start.x), 2654435761) ^
      Math.imul(Math.round(start.y), 40503) ^
      Math.imul(Math.round(end.x), 924391) ^
      Math.imul(Math.round(end.y), 69621)) >>>
    0
  );
}

const ROW_SKIP_CHANCE = 0.08; // a few missing slots read as lived-in, not broken
const ROW_ANGLE_JITTER = 14; // total degrees of per-stamp rotation wobble
const MAX_ROW_STAMPS = 200; // far under the add-elements cap, still a whole quay

/**
 * Stamps repeated along a dragged segment (catalog rank 11) — fish racks,
 * drying lines, shield rows, dock piles as ONE add-elements command (one
 * undo). Interval = the footprint's long side × the asset's `rowSpacing`
 * (default butt-to-butt; a street lamp ships 3 — the lamp-post idiom). Each
 * slot draws a fixed 4-roll sequence (skip / along / perpendicular / rotation)
 * so a skipped slot never shifts the stamps after it. Stamps centre ON the
 * line and rotate to its angle ± jitter — the centre-pivot renderer contract.
 */
export function buildRowDrafts(
  document: MapDocument,
  asset: MapStudioTileAsset,
  start: { x: number; y: number },
  end: { x: number; y: number },
  layerId: string,
): MapStampDraft[] {
  const { size } = document.grid;
  const w = asset.columns * size;
  const h = asset.rows * size;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < size * 0.5) return []; // a degenerate drag is a misclick, not a row
  const interval = Math.max(w, h) * (asset.rowSpacing ?? 1);
  const count = Math.min(MAX_ROW_STAMPS, Math.floor(length / interval) + 1);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const ux = dx / length;
  const uy = dy / length;
  const rng = createSeededRng(rowSeedFromDrag(start, end));
  const drafts: MapStampDraft[] = [];
  for (let i = 0; i < count; i += 1) {
    const skipRoll = rng();
    const alongRoll = rng();
    const perpRoll = rng();
    const rotRoll = rng();
    if (skipRoll < ROW_SKIP_CHANCE && count > 2) continue;
    const t = i * interval + (alongRoll - 0.5) * interval * 0.12;
    const off = (perpRoll - 0.5) * size * 0.12;
    const cx = start.x + ux * t - uy * off;
    const cy = start.y + uy * t + ux * off;
    drafts.push({
      layerId,
      assetId: asset.id,
      x: Math.round(cx - w / 2),
      y: Math.round(cy - h / 2),
      width: w,
      height: h,
      rotation: Math.round((angle + (rotRoll - 0.5) * ROW_ANGLE_JITTER) * 10) / 10,
    });
  }
  return drafts;
}
