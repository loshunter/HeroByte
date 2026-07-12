// ============================================================================
// MAP-EDIT PLACEMENT DRAFTS (pure)
// ============================================================================
// Pure draft builders for the live "place" and "scatter" sub-tools. They wrap
// the Studio's proven placement helpers so the live palette emits byte-identical
// tile/stamp geometry — the same add-element / add-elements commands the Studio
// uses, no server change. Everything here is deterministic (no Math.random): the
// scatter seed is derived from the drop point so a placement is reproducible.

import type { MapDocument } from "@herobyte/shared";
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
