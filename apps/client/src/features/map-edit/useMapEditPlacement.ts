// ============================================================================
// MAP-EDIT PLACEMENT (place / scatter click tools)
// ============================================================================
// The click-to-place machine for the live palette's asset tools, composed by
// useMapEditTool. A normal click drops a grid-snapped tile; Alt drops a free
// stamp centered on the cursor; R rotates the pending stamp (15° steps, Shift
// reverses — the tile lattice path is axis-aligned, so rotation applies to
// stamps only, matching createTileElement). Scatter flings a seeded handful of
// stamps as ONE add-elements command. A translucent ghost previews the drop.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MapDocument } from "@herobyte/shared";
import { getMapStudioTileAsset } from "../map-studio/starterTiles";
import { buildScatterDrafts } from "../map-studio/scatterBrush";
import type { MapStampDraft, MapTileDraft } from "../map-studio/types";
import { useAltKeyTracking } from "../map-studio/components/useAltKeyTracking";
import {
  buildStampPlacement,
  buildTilePlacement,
  scatterSeedFromPoint,
  tileFootprint,
} from "./placementDrafts";
import type { MapEditSubTool } from "./mapEditTypes";

/** A translucent footprint drawn at the cursor to preview the next drop. */
export interface PlacementGhost {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  stroke: string;
}

const STAMP_ROTATION_STEP = 15; // degrees; free stamps turn in fifteens (Studio's Shelf spec)

interface UseMapEditPlacementOptions {
  /** place or scatter sub-tool active in map-edit AND authoring the live doc. */
  active: boolean;
  subTool: MapEditSubTool;
  /** The live-bound active document, or null when not authoring it. */
  document: MapDocument | null;
  selectedAssetId: string;
  saving: boolean;
  addTile: (draft: MapTileDraft) => unknown;
  addStamp: (draft: MapStampDraft) => unknown;
  addStamps: (drafts: MapStampDraft[]) => unknown;
}

interface UseMapEditPlacementReturn {
  ghost: PlacementGhost | null;
  /** Track the cursor (document px) so the ghost follows it; null hides it. */
  updateCursor: (point: { x: number; y: number } | null) => void;
  /** Drop at a document-space point (tile, or Alt-held free stamp). */
  place: (point: { x: number; y: number }) => void;
  /** Scatter a seeded handful of stamps at a document-space point. */
  scatter: (point: { x: number; y: number }) => void;
}

export function useMapEditPlacement({
  active,
  subTool,
  document,
  selectedAssetId,
  saving,
  addTile,
  addStamp,
  addStamps,
}: UseMapEditPlacementOptions): UseMapEditPlacementReturn {
  const [altHeld] = useAltKeyTracking();
  const [rotation, setRotation] = useState(0);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const asset = useMemo(() => getMapStudioTileAsset(selectedAssetId), [selectedAssetId]);

  // Leaving the placement tools drops the ghost.
  useEffect(() => {
    if (!active) setCursor(null);
  }, [active]);

  // R rotates the pending stamp (Shift reverses). Ctrl/Cmd+R stays browser reload.
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "r" || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      setRotation((current) => {
        const delta = event.shiftKey ? -STAMP_ROTATION_STEP : STAMP_ROTATION_STEP;
        return (current + delta + 360) % 360;
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active]);

  const updateCursor = useCallback(
    (point: { x: number; y: number } | null) => setCursor(point),
    [],
  );

  const place = useCallback(
    (point: { x: number; y: number }) => {
      if (!document || saving) return;
      if (altHeld) {
        const draft = buildStampPlacement(document, asset, point, rotation);
        if (draft) addStamp(draft);
        return;
      }
      const draft = buildTilePlacement(document, asset, point);
      if (draft) addTile(draft);
    },
    [document, saving, altHeld, asset, rotation, addStamp, addTile],
  );

  const scatter = useCallback(
    (point: { x: number; y: number }) => {
      if (!document || saving) return;
      const drafts = buildScatterDrafts(document, asset, point, scatterSeedFromPoint(point));
      if (drafts.length > 0) addStamps(drafts);
    },
    [document, saving, asset, addStamps],
  );

  const ghost = useMemo<PlacementGhost | null>(() => {
    if (!active || !document || !cursor) return null;
    const paint = { fill: asset.fill, stroke: asset.stroke };
    // Scatter and Alt-place both preview a free stamp centered on the cursor.
    if (subTool === "scatter" || altHeld) {
      const width = asset.columns * document.grid.size;
      const height = asset.rows * document.grid.size;
      const x = clampFootprint(cursor.x - width / 2, document.width - width);
      const y = clampFootprint(cursor.y - height / 2, document.height - height);
      return { x, y, width, height, rotation: subTool === "scatter" ? 0 : rotation, ...paint };
    }
    const foot = tileFootprint(document, asset, cursor);
    return { ...foot, rotation: 0, ...paint };
  }, [active, document, cursor, asset, subTool, altHeld, rotation]);

  return { ghost, updateCursor, place, scatter };
}

function clampFootprint(value: number, max: number): number {
  return Math.round(Math.min(Math.max(value, 0), Math.max(0, max)));
}
