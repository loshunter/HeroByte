import type { PlacementGhost } from "./useMapEditPlacement";
import type { GenerateRegionDescriptor } from "./generateRegion";

/** Data-only drafts forwarded through both layouts into the existing overlay. */
export interface MapEditPersistentPreview {
  populateGhosts: PlacementGhost[] | null;
  populateTarget?: import("./populateTarget").PopulateTarget | null;
  generateRegion: GenerateRegionDescriptor | null;
}
