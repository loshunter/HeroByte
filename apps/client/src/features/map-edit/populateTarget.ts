import { forEachTerrainCell, TERRAIN_CHUNK_SIZE } from "@herobyte/shared";
import type { MapDocument, MapGridSettings, MapWallElement } from "@herobyte/shared";
import type { RoomBounds } from "./roomBuilder";

export type PopulateTargetKind = "room" | "hallway";
export type OnPopulateRegionPlaced = (
  bounds: RoomBounds,
  kind: PopulateTargetKind,
  perimeters: readonly MapWallElement[],
) => void;
export interface PopulateTarget {
  bounds: RoomBounds;
  kind: PopulateTargetKind;
}
export function decorateLabel(target: PopulateTarget | null | undefined) {
  return target ? `Decorate last ${target.kind}` : "Decorate last room / hallway";
}

/** Identity of the last placement, without changing its decoration rectangle. */
export interface PlacedPopulateTarget extends PopulateTarget {
  documentId: string;
  grid: Pick<MapGridSettings, "size" | "offsetX" | "offsetY">;
  perimeters: readonly MapWallElement[];
}

export function populateTargetIsLive(document: MapDocument, target: PlacedPopulateTarget) {
  const { grid, bounds } = target;
  if (
    document.id !== target.documentId ||
    document.grid.size !== grid.size ||
    document.grid.offsetX !== grid.offsetX ||
    document.grid.offsetY !== grid.offsetY ||
    target.perimeters.length === 0
  )
    return false;
  const elements = new Map(document.elements.map((element) => [element.id, element]));
  for (const expected of target.perimeters) {
    const live = elements.get(expected.id);
    if (live?.type !== "wall" || live.hidden !== expected.hidden) return false;
    for (const key of ["x", "y", "scaleX", "scaleY", "rotation"] as const) {
      if (live.transform[key] !== expected.transform[key]) return false;
    }
    if (
      live.data.points.length !== expected.data.points.length ||
      live.data.points.some(
        (point, index) =>
          point.x !== expected.data.points[index]!.x || point.y !== expected.data.points[index]!.y,
      )
    )
      return false;
  }
  if (!document.terrain) return false;
  const x = Math.round((bounds.x - grid.offsetX) / grid.size);
  const y = Math.round((bounds.y - grid.offsetY) / grid.size);
  const cols = Math.round(bounds.width / grid.size),
    rows = Math.round(bounds.height / grid.size);
  if (cols <= 0 || rows <= 0) return false;
  // Decode only intersecting chunks, once each, even for a maximum-size room.
  const chunks: Record<string, number[]> = {};
  for (
    let cy = Math.floor(y / TERRAIN_CHUNK_SIZE);
    cy <= Math.floor((y + rows - 1) / TERRAIN_CHUNK_SIZE);
    cy++
  ) {
    for (
      let cx = Math.floor(x / TERRAIN_CHUNK_SIZE);
      cx <= Math.floor((x + cols - 1) / TERRAIN_CHUNK_SIZE);
      cx++
    ) {
      const key = `${cx},${cy}`;
      const chunk = document.terrain.chunks[key];
      if (!chunk) return false;
      chunks[key] = chunk;
    }
  }
  let covered = 0;
  forEachTerrainCell({ ...document.terrain, chunks }, (cx, cy) => {
    if (cx >= x && cx < x + cols && cy >= y && cy < y + rows) covered++;
  });
  return covered === cols * rows;
}
