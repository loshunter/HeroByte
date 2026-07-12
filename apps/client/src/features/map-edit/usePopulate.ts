// ============================================================================
// POPULATE (algorithmic set dressing)
// ============================================================================
// Owns the POPULATE palette state (density, category, the last-placed region)
// and the fill action. onRegionPlaced records the bounds of the most recent
// room/hallway; onPopulate scatters deterministic set dressing across it as ONE
// add-elements command (one undo), reading the live document's doors so it never
// covers a doorway. Pure geometry lives in populateRoom.ts.

import { useCallback, useState } from "react";
import { MAP_STUDIO_TILE_ASSETS } from "../map-studio/starterTiles";
import { pickPlacementLayer } from "../map-studio/components/mapStudioWorkspaceUtils";
import type { MapStudioController } from "../map-studio/types";
import type { RoomBounds } from "./roomBuilder";
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
    const assets = MAP_STUDIO_TILE_ASSETS.filter((asset) => asset.category === category);
    const layer = assets[0] ? pickPlacementLayer(document, assets[0]) : undefined;
    if (!layer || assets.length === 0) return;
    const doors = doorSegmentsWithin(document, lastPlacedBounds);
    const drafts = buildPopulateDrafts(
      lastPlacedBounds,
      document.grid,
      assets,
      density,
      populateSeedFromBounds(lastPlacedBounds),
      layer.id,
      doors,
    );
    if (drafts.length > 0) controller.addStamps(drafts);
    else notifyError?.("Nothing to populate — try a denser setting or a larger area.");
  }, [controller, lastPlacedBounds, category, density, notifyError]);

  const canPopulate = Boolean(lastPlacedBounds) && !controller.saving;

  return { density, setDensity, category, setCategory, onRegionPlaced, onPopulate, canPopulate };
}
