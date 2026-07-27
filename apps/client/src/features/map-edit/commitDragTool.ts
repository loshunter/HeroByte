// The pointer-up commit for the map-edit drag tools (room / hallway / wall /
// door). Extracted from useMapEditTool so the hook stays under the structure
// cap and the tool→command mapping is one readable place. Not pure (it calls
// controller methods) but has no React state of its own.

import type { MapDocument } from "@herobyte/shared";
import { commitSegmentDrag } from "../map-studio/components/wallDoorDrafts";
import {
  pickPlacementLayer,
  roomBoundsFromDrag,
} from "../map-studio/components/mapStudioWorkspaceUtils";
import type { RoomDrag, StudioTool } from "../map-studio/components/MapStudioWorkspace.types";
import { getMapStudioTileAsset } from "../map-studio/starterTiles";
import type { MapStudioController } from "../map-studio/types";
import { buildRoomCommand, type RoomBounds } from "./roomBuilder";
import { buildHallwayCommand } from "./hallwayBuilder";
import { buildRowDrafts } from "./placementDrafts";
import type { MapEditFloorFamily, MapEditSubTool, MapEditWallFamily } from "./mapEditTypes";

interface CommitDragOptions {
  subTool: MapEditSubTool;
  drag: RoomDrag;
  document: MapDocument;
  controller: MapStudioController;
  floorFamily: MapEditFloorFamily;
  /** The Room tool's painted wall-ring material ("none" skips the ring). */
  roomWallFamily: MapEditWallFamily | "none";
  hallwayWidth: number;
  /** Asset the row sub-tool repeats along its dragged segment. */
  selectedAssetId: string;
  onRoomRejected?: (message: string) => void;
  /** A room/hallway landed — its bounds become the POPULATE target. */
  onRegionPlaced?: (bounds: RoomBounds) => void;
  /** A generate region was swept — the recipe's target, nothing placed yet. */
  onRegionDragged?: (bounds: RoomBounds) => void;
}

export function commitDragTool({
  subTool,
  drag,
  document,
  controller,
  floorFamily,
  roomWallFamily,
  hallwayWidth,
  selectedAssetId,
  onRoomRejected,
  onRegionPlaced,
  onRegionDragged,
}: CommitDragOptions): void {
  const layers = new Map(document.layers.map((layer) => [layer.id, layer]));

  if (subTool === "row") {
    // Rank 11: plain stamps repeated along the dragged segment — one command,
    // one undo, elements stay ordinary selectable stamps.
    const asset = getMapStudioTileAsset(selectedAssetId);
    const layer = pickPlacementLayer(document, asset);
    if (layer) {
      const drafts = buildRowDrafts(document, asset, drag.start, drag.end, layer.id);
      if (drafts.length > 0) controller.addStamps(drafts);
    }
    return;
  }

  if (subTool === "generate") {
    // Generate does not COMMIT on drop — the drag only aims the recipe. The DM
    // sets the dials and fires it from the panel, so a stray drag costs nothing.
    onRegionDragged?.(roomBoundsFromDrag(drag, document.grid.size));
    return;
  }

  if (subTool === "room") {
    const bounds = roomBoundsFromDrag(drag, document.grid.size);
    const { command, error } = buildRoomCommand(bounds, floorFamily, document.grid, layers, {
      wallFamily: roomWallFamily,
      terrain: document.terrain ?? null,
    });
    if (command) {
      controller.placeRoom(command.cells, command.elements);
      onRegionPlaced?.(bounds);
    } else if (error) {
      onRoomRejected?.(error);
    }
    return;
  }

  if (subTool === "hallway") {
    const { command, bounds, error } = buildHallwayCommand(
      drag,
      floorFamily,
      hallwayWidth,
      document.grid,
      layers,
      { wallFamily: roomWallFamily, terrain: document.terrain ?? null },
    );
    if (command && bounds) {
      controller.placeRoom(command.cells, command.elements);
      onRegionPlaced?.(bounds);
    } else if (error) {
      onRoomRejected?.(error);
    }
    return;
  }

  // wall / door: one segment drag → add-element.
  const segmentTool: StudioTool = subTool === "door" ? "door" : "wall";
  commitSegmentDrag(segmentTool, layers, drag, controller.addWall, controller.addDoor);
}
