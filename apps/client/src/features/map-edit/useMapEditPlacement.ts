// ============================================================================
// MAP-EDIT PLACEMENT (place / scatter click tools)
// ============================================================================
// The click-to-place machine for the live palette's asset tools, composed by
// useMapEditTool. A normal click drops a grid-snapped tile; Alt drops a free
// stamp centered on the cursor; R rotates the pending stamp (15° steps, Shift
// reverses — the tile lattice path is axis-aligned, so rotation applies to
// stamps only, matching createTileElement). Scatter flings a seeded handful of
// stamps as ONE add-elements command. A translucent ghost previews the drop.
//
// Since M7 the two MODIFIER states live outside this hook, in usePlacementDials
// at App level, because a phone has no Alt and no R and the on-screen controls
// have to reach them. Alt and R are still here and still fastest — they now
// write the same state the buttons do, instead of a second copy nothing else
// can see. `altHeld` ORs with the sticky toggle: holding Alt is a momentary
// stamp, the toggle is a mode.

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

interface UseMapEditPlacementOptions {
  /** place or scatter sub-tool active in map-edit AND authoring the live doc. */
  active: boolean;
  subTool: MapEditSubTool;
  /** The live-bound active document, or null when not authoring it. */
  document: MapDocument | null;
  selectedAssetId: string;
  saving: boolean;
  /** Sticky "drop a free stamp" toggle; ORed with a held Alt. */
  stampMode: boolean;
  /** Degrees the pending stamp is turned by (0..359). */
  stampRotation: number;
  /** Turn the pending stamp by one step; negative reverses. */
  onRotateStamp: (steps: number) => void;
  /** A drop was SKIPPED because a command was in flight. Without this the click
   * vanishes with the ghost still under the cursor and nothing added. */
  onGestureDropped?: () => void;
  addTile: (draft: MapTileDraft) => unknown;
  addStamp: (draft: MapStampDraft) => unknown;
  addStamps: (drafts: MapStampDraft[]) => unknown;
}

interface UseMapEditPlacementReturn {
  ghost: PlacementGhost | null;
  /** The scatter tool's TRUE cluster at the cursor: the exact drafts a click
   * here would commit (the seed derives from the point), one ghost each. */
  draftGhosts: PlacementGhost[];
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
  stampMode,
  stampRotation,
  onRotateStamp,
  onGestureDropped,
  addTile,
  addStamp,
  addStamps,
}: UseMapEditPlacementOptions): UseMapEditPlacementReturn {
  const [altHeld] = useAltKeyTracking();
  // Either input stamps. Neither is authoritative over the other, so a DM can
  // hold Alt over a tile-mode toggle and get one stamp without changing modes.
  const stamping = altHeld || stampMode;
  const rotation = stampRotation;
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const asset = useMemo(() => getMapStudioTileAsset(selectedAssetId), [selectedAssetId]);

  // Leaving the placement tools drops the ghost.
  useEffect(() => {
    if (!active) setCursor(null);
  }, [active]);

  // R rotates the pending stamp (Shift reverses). Ctrl/Cmd+R stays browser
  // reload. The step and the wrap live in usePlacementDials now, so the key and
  // the on-screen buttons cannot turn by different amounts.
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "r" || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      onRotateStamp(event.shiftKey ? -1 : 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, onRotateStamp]);

  const updateCursor = useCallback(
    (point: { x: number; y: number } | null) => setCursor(point),
    [],
  );

  const place = useCallback(
    (point: { x: number; y: number }) => {
      if (!document) return;
      // The two refusals are not the same event. No document means the tool is
      // pointed at a non-live doc and the ghost is already hidden — nothing was
      // promised. `saving` means the DM aimed at a visible ghost and clicked,
      // and the click evaporates: say so rather than look like an empty tile.
      if (saving) {
        onGestureDropped?.();
        return;
      }
      if (stamping) {
        const draft = buildStampPlacement(document, asset, point, rotation);
        if (draft) addStamp(draft);
        return;
      }
      const draft = buildTilePlacement(document, asset, point);
      if (draft) addTile(draft);
    },
    [document, saving, onGestureDropped, stamping, asset, rotation, addStamp, addTile],
  );

  const scatter = useCallback(
    (point: { x: number; y: number }) => {
      if (!document) return;
      if (saving) {
        onGestureDropped?.();
        return;
      }
      const drafts = buildScatterDrafts(document, asset, point, scatterSeedFromPoint(point));
      if (drafts.length > 0) addStamps(drafts);
    },
    [document, saving, onGestureDropped, asset, addStamps],
  );

  const ghost = useMemo<PlacementGhost | null>(() => {
    if (!active || !document || !cursor) return null;
    // Scatter previews its whole cluster (draftGhosts below), not a footprint.
    if (subTool === "scatter") return null;
    const paint = { fill: asset.fill, stroke: asset.stroke };
    if (stamping) {
      const width = asset.columns * document.grid.size;
      const height = asset.rows * document.grid.size;
      const x = clampFootprint(cursor.x - width / 2, document.width - width);
      const y = clampFootprint(cursor.y - height / 2, document.height - height);
      return { x, y, width, height, rotation, ...paint };
    }
    const foot = tileFootprint(document, asset, cursor);
    return { ...foot, rotation: 0, ...paint };
  }, [active, document, cursor, asset, subTool, stamping, rotation]);

  // Ghost-before-commit (P2): the scatter cluster IS the commit — same
  // builder, same point-derived seed — so every footprint lands exactly
  // where a click at this cursor would put it.
  const draftGhosts = useMemo<PlacementGhost[]>(() => {
    if (!active || !document || !cursor || subTool !== "scatter") return [];
    const drafts = buildScatterDrafts(document, asset, cursor, scatterSeedFromPoint(cursor));
    return drafts.map((draft) => ({
      x: draft.x,
      y: draft.y,
      width: draft.width,
      height: draft.height,
      rotation: draft.rotation ?? 0,
      fill: asset.fill,
      stroke: asset.stroke,
    }));
  }, [active, document, cursor, asset, subTool]);

  return { ghost, draftGhosts, updateCursor, place, scatter };
}

function clampFootprint(value: number, max: number): number {
  return Math.round(Math.min(Math.max(value, 0), Math.max(0, max)));
}
