// ============================================================================
// POPULATE (algorithmic set dressing)
// ============================================================================
// Owns the POPULATE palette state (density, category, the last-placed region)
// and the fill action. onRegionPlaced records the bounds of the most recent
// room/hallway; onPopulate scatters deterministic set dressing across it as ONE
// add-elements command (one undo), reading the live document's doors so it never
// covers a doorway. Pure geometry lives in populateRoom.ts. Ghost-before-commit
// (P2): while a region is armed, previewGhosts carries the EXACT drafts the
// button would commit (same builder, same bounds-derived seed) as translucent
// footprints for MapEditPreviewLayer.

import { useCallback, useMemo, useState } from "react";
import type { MapDocument } from "@herobyte/shared";
import { getMapStudioTileAsset, MAP_STUDIO_TILE_ASSETS } from "../map-studio/starterTiles";
import { pickPlacementLayer } from "../map-studio/components/mapStudioWorkspaceUtils";
import type { MapStudioController } from "../map-studio/types";
import type { MapStampDraft } from "../map-studio/types";
import type { RoomBounds } from "./roomBuilder";
import type { PlacementGhost } from "./useMapEditPlacement";
import {
  buildPopulateDrafts,
  doorSegmentsWithin,
  populateSeedFromBounds,
  regionHasFloor,
} from "./populateRoom";
import type { PopulateCategory, PopulateDensity } from "./mapEditTypes";

export interface UsePopulateReturn {
  density: PopulateDensity;
  setDensity: (density: PopulateDensity) => void;
  category: PopulateCategory;
  setCategory: (category: PopulateCategory) => void;
  /** Record the region a room/hallway just placed as the POPULATE target. */
  onRegionPlaced: (bounds: RoomBounds) => void;
  onPopulate: () => void;
  canPopulate: boolean;
  /** The armed region's TRUE draft footprints (null when nothing is armed). */
  previewGhosts: PlacementGhost[] | null;
}

/** The region's drafts — door-aware, seeded from the bounds — or null when
 * the category has no assets/layer. ONE builder for the commit and the ghost
 * preview, so what the DM sees is byte-what the button places. */
function draftsForRegion(
  document: MapDocument,
  bounds: RoomBounds,
  category: PopulateCategory,
  density: PopulateDensity,
): MapStampDraft[] | null {
  const assets = MAP_STUDIO_TILE_ASSETS.filter((asset) => asset.category === category);
  const layer = assets[0] ? pickPlacementLayer(document, assets[0]) : undefined;
  if (!layer || assets.length === 0) return null;
  const doors = doorSegmentsWithin(document, bounds);
  return buildPopulateDrafts(
    bounds,
    document.grid,
    assets,
    density,
    populateSeedFromBounds(bounds),
    layer.id,
    doors,
  );
}

export function usePopulate(
  controller: MapStudioController,
  notifyError?: (message: string) => void,
): UsePopulateReturn {
  const [density, setDensity] = useState<PopulateDensity>("medium");
  const [category, setCategory] = useState<PopulateCategory>("objects");
  const [lastPlacedBounds, setLastPlacedBounds] = useState<RoomBounds | null>(null);

  const onRegionPlaced = useCallback((bounds: RoomBounds) => setLastPlacedBounds(bounds), []);

  const onPopulate = useCallback(() => {
    const document = controller.activeDocument;
    if (!document || !lastPlacedBounds || controller.saving) return;
    // The recorded region can go stale (e.g. the DM undoes the room after
    // placing it). If its floor is gone, don't scatter props into empty space —
    // drop the target and tell the DM to place a fresh room/hallway.
    if (!regionHasFloor(document, lastPlacedBounds)) {
      setLastPlacedBounds(null);
      notifyError?.("That area is empty now — draw a room or hallway, then Populate it.");
      return;
    }
    const drafts = draftsForRegion(document, lastPlacedBounds, category, density);
    if (drafts && drafts.length > 0) {
      controller.addStamps(drafts);
      // One fill per placed region: drop the target so a second click can't
      // silently stack a byte-identical scatter on top of the first (the seed is
      // fixed by the region origin). The DM draws a fresh room/hallway to
      // populate again.
      setLastPlacedBounds(null);
    } else notifyError?.("Nothing to populate — try a denser setting or a larger area.");
  }, [controller, lastPlacedBounds, category, density, notifyError]);

  const activeDocument = controller.activeDocument;
  const previewGhosts = useMemo<PlacementGhost[] | null>(() => {
    if (!activeDocument || !lastPlacedBounds) return null;
    if (!regionHasFloor(activeDocument, lastPlacedBounds)) return null;
    const drafts = draftsForRegion(activeDocument, lastPlacedBounds, category, density);
    if (!drafts || drafts.length === 0) return null;
    return drafts.map((draft) => {
      const asset = getMapStudioTileAsset(draft.assetId);
      return {
        x: draft.x,
        y: draft.y,
        width: draft.width,
        height: draft.height,
        rotation: draft.rotation ?? 0,
        fill: asset.fill,
        stroke: asset.stroke,
      };
    });
  }, [activeDocument, lastPlacedBounds, category, density]);

  const canPopulate = Boolean(lastPlacedBounds) && !controller.saving;

  return {
    density,
    setDensity,
    category,
    setCategory,
    onRegionPlaced,
    onPopulate,
    canPopulate,
    previewGhosts,
  };
}
