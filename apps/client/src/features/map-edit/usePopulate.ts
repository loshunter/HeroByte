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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MapDocument } from "@herobyte/shared";
import { getMapStudioTileAsset, MAP_STUDIO_TILE_ASSETS } from "../map-studio/starterTiles";
import { pickPlacementLayer } from "../map-studio/components/mapStudioWorkspaceUtils";
import type { MapStudioController } from "../map-studio/types";
import type { MapStampDraft } from "../map-studio/types";
import type { RoomBounds } from "./roomBuilder";
import type { PlacementGhost } from "./useMapEditPlacement";
import { buildPopulateDrafts, doorSegmentsWithin, populateSeedFromBounds } from "./populateRoom";
import type { PopulateCategory, PopulateDensity } from "./mapEditTypes";
import { populateTargetIsLive } from "./populateTarget";
import type {
  OnPopulateRegionPlaced,
  PlacedPopulateTarget,
  PopulateTarget,
} from "./populateTarget";

export interface UsePopulateReturn {
  density: PopulateDensity;
  setDensity: (density: PopulateDensity) => void;
  category: PopulateCategory;
  setCategory: (category: PopulateCategory) => void;
  /** Record the region a room/hallway just placed as the POPULATE target. */
  onRegionPlaced: OnPopulateRegionPlaced;
  onPopulate: () => void;
  canPopulate: boolean;
  target: PopulateTarget | null;
  hint: string;
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
  const [placed, setPlaced] = useState<PlacedPopulateTarget | null>(null);
  const activeDocument = controller.activeDocument;
  const activeDocumentId = controller.activeDocument?.id;
  const target = placed?.documentId === activeDocumentId ? placed : null;
  const lastPlacedBounds = target?.bounds ?? null;
  const onRegionPlaced: OnPopulateRegionPlaced = useCallback(
    (bounds, kind, perimeters) => {
      if (activeDocument)
        setPlaced({
          bounds,
          kind,
          perimeters,
          documentId: activeDocument.id,
          grid: activeDocument.grid,
        });
    },
    [activeDocument],
  );

  // A DOCUMENT SWAP drops the target (A5): the pixel rectangle was placed on
  // the OLD document; floor at the same coordinates is not a new target.
  useEffect(() => {
    setPlaced(null);
  }, [activeDocumentId]);

  const latest = useRef({ controller, target, category, density, notifyError });
  latest.current = { controller, target, category, density, notifyError };
  const onPopulate = useCallback(() => {
    const current = latest.current;
    const { controller: liveController, target: liveTarget } = current;
    const document = liveController.activeDocument;
    const bounds = liveTarget?.bounds;
    if (!document || !liveTarget || !bounds || liveController.saving || liveController.loading)
      return;
    // Underlying terrain can survive Undo. Validate this placement's identity
    // and whole floor footprint again even for a retained callback.
    if (!populateTargetIsLive(document, liveTarget)) {
      latest.current.target = null;
      setPlaced(null);
      current.notifyError?.("That area changed — draw a new room or hallway to decorate.");
      return;
    }
    const drafts = draftsForRegion(document, bounds, current.category, current.density);
    if (drafts && drafts.length > 0) {
      // Retained callbacks and rapid repeated presses consume the current target once.
      latest.current.target = null;
      liveController.addStamps(drafts);
      // One fill per placed region: drop the target so a second click can't
      // silently stack a byte-identical scatter on top of the first (the seed is
      // fixed by the region origin). The DM draws a fresh room/hallway to
      // populate again.
      setPlaced(null);
    } else
      current.notifyError?.(
        "No decoration fits — unlock a placement layer or choose a denser setting.",
      );
  }, []);

  // One validity predicate for the outline, ghosts, readiness and action. Keep
  // pending placement identity while the controller waits for its first reply.
  const regionIsLive = useMemo(
    () => Boolean(activeDocument && target && populateTargetIsLive(activeDocument, target)),
    [activeDocument, target],
  );

  const previewGhosts = useMemo<PlacementGhost[] | null>(() => {
    if (!activeDocument || !lastPlacedBounds || !regionIsLive) return null;
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
  }, [activeDocument, lastPlacedBounds, category, density, regionIsLive]);

  const hasDrafts = Boolean(previewGhosts?.length);
  const canPopulate = regionIsLive && hasDrafts && !controller.saving && !controller.loading;
  const hint =
    controller.saving || controller.loading
      ? "Working… wait for the map to finish."
      : !target
        ? "Draw a room or hallway first — decoration fills the last one you placed."
        : !regionIsLive
          ? "That area changed — draw a new room or hallway."
          : !hasDrafts
            ? "No decoration fits — unlock a placement layer or choose a denser setting."
            : `Fills the ${target.kind} you just drew. The outlined area is the target.`;

  return {
    density,
    setDensity,
    category,
    setCategory,
    onRegionPlaced,
    onPopulate,
    canPopulate,
    target: regionIsLive ? target : null,
    hint,
    previewGhosts,
  };
}
