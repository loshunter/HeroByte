// Pure algorithmic set-dressing for POPULATE: a room/hallway's bounds → a
// deterministic seeded scatter of stamps from a chosen category, emitted as ONE
// add-elements command (one undo). Determinism is a hard rule (no Math.random):
// identical inputs always produce identical drafts. Stamps keep a half-cell
// margin off the walls and never land within a cell of a door.

import type { MapDocument, MapGridSettings } from "@herobyte/shared";
import { createSeededRng, getTerrainCell } from "@herobyte/shared";
import type { MapStudioTileAsset } from "../map-studio/starterTiles";
import type { MapStampDraft } from "../map-studio/types";
import type { RoomBounds } from "./roomBuilder";
import type { PopulateDensity } from "./mapEditTypes";

/** Per-cell placement probability by density. */
const DENSITY_FILL: Record<PopulateDensity, number> = { low: 0.1, medium: 0.22, high: 0.4 };
/** Respect the add-elements cap (5000) with headroom; stop scattering past this. */
export const MAX_POPULATE_STAMPS = 2000;

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * True when the region still has painted floor terrain — the POPULATE target's
 * proof-of-life. A room/hallway paints floor when placed, so if the DM undoes it
 * the terrain vanishes and this returns false; callers then refuse to scatter
 * set dressing into now-empty space (the recorded bounds went stale).
 */
export function regionHasFloor(document: MapDocument, bounds: RoomBounds): boolean {
  if (!document.terrain) return false;
  const { size, offsetX, offsetY } = document.grid;
  const firstCX = Math.round((bounds.x - offsetX) / size);
  const firstCY = Math.round((bounds.y - offsetY) / size);
  const cols = Math.max(0, Math.round(bounds.width / size));
  const rows = Math.max(0, Math.round(bounds.height / size));
  for (let dy = 0; dy < rows; dy += 1) {
    for (let dx = 0; dx < cols; dx += 1) {
      if (getTerrainCell(document.terrain, firstCX + dx, firstCY + dy) !== null) return true;
    }
  }
  return false;
}

/** A deterministic seed from the region origin — identical regions repopulate identically. */
export function populateSeedFromBounds(bounds: RoomBounds): number {
  const x = Math.round(bounds.x) | 0;
  const y = Math.round(bounds.y) | 0;
  return (Math.imul(x, 2654435761) ^ Math.imul(y, 40503)) >>> 0;
}

/** Door segments (compiled from door elements) whose origin sits within the region. */
export function doorSegmentsWithin(document: MapDocument, bounds: RoomBounds): Segment[] {
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  const segments: Segment[] = [];
  for (const element of document.elements) {
    if (element.type !== "door") continue;
    const { x, y, rotation } = element.transform;
    if (x < bounds.x || x > right || y < bounds.y || y > bottom) continue;
    const radians = (rotation * Math.PI) / 180;
    segments.push({
      x1: x,
      y1: y,
      x2: x + element.data.width * Math.cos(radians),
      y2: y + element.data.width * Math.sin(radians),
    });
  }
  return segments;
}

/**
 * Build the populate stamp drafts. Iterates the region's cells, draws a fixed
 * 3-roll sequence per cell (placement / asset / rotation) BEFORE any skip so the
 * RNG stream stays stable regardless of which cells fill, then places a stamp
 * centered in the cell — skipped if its footprint would breach the half-cell
 * wall margin or land within a cell of a door.
 */
export function buildPopulateDrafts(
  bounds: RoomBounds,
  grid: MapGridSettings,
  assets: MapStudioTileAsset[],
  density: PopulateDensity,
  seed: number,
  layerId: string,
  doorSegments: Segment[] = [],
): MapStampDraft[] {
  if (assets.length === 0) return [];
  const { size, offsetX, offsetY } = grid;
  const inset = size * 0.5;
  const region = {
    left: bounds.x + inset,
    top: bounds.y + inset,
    right: bounds.x + bounds.width - inset,
    bottom: bounds.y + bounds.height - inset,
  };
  const firstCX = Math.round((bounds.x - offsetX) / size);
  const firstCY = Math.round((bounds.y - offsetY) / size);
  const cols = Math.max(0, Math.round(bounds.width / size));
  const rows = Math.max(0, Math.round(bounds.height / size));
  const rng = createSeededRng(seed);
  const fill = DENSITY_FILL[density];

  const drafts: MapStampDraft[] = [];
  for (let dy = 0; dy < rows; dy += 1) {
    for (let dx = 0; dx < cols; dx += 1) {
      const placeRoll = rng();
      const assetRoll = rng();
      const rotRoll = rng();
      if (placeRoll >= fill) continue;
      if (drafts.length >= MAX_POPULATE_STAMPS) return drafts;

      const asset = assets[Math.floor(assetRoll * assets.length)]!;
      const w = asset.columns * size;
      const h = asset.rows * size;
      const centerX = (firstCX + dx) * size + size / 2 + offsetX;
      const centerY = (firstCY + dy) * size + size / 2 + offsetY;
      const x = centerX - w / 2;
      const y = centerY - h / 2;
      if (x < region.left || y < region.top || x + w > region.right || y + h > region.bottom) {
        continue;
      }
      // Keep a cell of clearance from any door — measured from the stamp's
      // footprint (its bounding-circle radius), not its center, so a multi-cell
      // stamp (e.g. a 2×1 table) can't straddle a doorway.
      const clearance = Math.hypot(w / 2, h / 2) + size / 2;
      if (doorSegments.some((seg) => pointSegmentDistance(centerX, centerY, seg) < clearance)) {
        continue;
      }

      drafts.push({
        layerId,
        assetId: asset.id,
        x: Math.round(x),
        y: Math.round(y),
        width: w,
        height: h,
        rotation: Math.floor(rotRoll * 4) * 90,
      });
    }
  }
  return drafts;
}

function pointSegmentDistance(px: number, py: number, seg: Segment): number {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - seg.x1, py - seg.y1);
  let t = ((px - seg.x1) * dx + (py - seg.y1) * dy) / lengthSq;
  t = Math.min(1, Math.max(0, t));
  return Math.hypot(px - (seg.x1 + t * dx), py - (seg.y1 + t * dy));
}
