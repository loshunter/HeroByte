// Which input machine each map-edit sub-tool drives, and the grid it snaps to.
// Pure predicates, kept out of useMapEditTool so the hook stays under the
// structure cap and the classification is one readable table.

import type { MapGridSettings } from "@herobyte/shared";
import type { MapEditSubTool } from "./mapEditTypes";

/**
 * Exported and `as const` so the mobile tool grid can be DERIVED from it rather
 * than hand-listed beside it. The phone arms exactly this set (MapBoard's
 * mapEditDragMode is `isDragTool(activeSubTool)`), so a second hand-kept list
 * would be a way for the two to disagree — the trap mapEditFamilies.ts records
 * killing for swatches. A new drag tool now has to be given a phone tile before
 * it compiles.
 */
export const DRAG_TOOLS = ["wall", "door", "room", "hallway", "generate", "row", "spline"] as const;

/** A sub-tool that drives the drag machine — the set touch is armed for. */
export type DragTool = (typeof DRAG_TOOLS)[number];

const BRUSH_TOOLS: MapEditSubTool[] = ["terrain", "erase"];
const CLICK_TOOLS: MapEditSubTool[] = ["place", "scatter", "light"];

/** Wall, door, room, hallway, and generate all drive the same drag machine. */
export function isDragTool(subTool: MapEditSubTool): subTool is DragTool {
  return (DRAG_TOOLS as readonly MapEditSubTool[]).includes(subTool);
}

/**
 * Drag tools whose release sends NO command — the drag only AIMS something the
 * DM fires later from a panel (see commitDragTool: generate's drop just reports
 * the region). They must not be gated on `controller.saving`: there is no
 * command to pile up behind, so the gate buys nothing and costs the aim, which
 * is lost silently because the rubber band clears on release either way.
 */
const AIM_ONLY_TOOLS: MapEditSubTool[] = ["generate"];

/** True when the release aims something rather than committing it. */
export function isAimTool(subTool: MapEditSubTool): boolean {
  return AIM_ONLY_TOOLS.includes(subTool);
}

/** Terrain + erase are pointer-STREAM brushes (paint cells while down). */
export function isBrushTool(subTool: MapEditSubTool): boolean {
  return BRUSH_TOOLS.includes(subTool);
}

/** Place + scatter are click tools: one pointer-down drops (no drag, no stream). */
export function isClickTool(subTool: MapEditSubTool): boolean {
  return CLICK_TOOLS.includes(subTool);
}

/**
 * These tools ALWAYS snap to a SQUARE grid: their floor is quantized onto the
 * square terrain lattice, so their walls must land on the same cell edges (with
 * the doc's snap off, floor would spill outside them). Forcing `type: "square"`
 * also stops a hex-typed document (import/update-grid can make one) snapping the
 * drag to hex centers, which are not multiples of the cell size and would offset
 * floor from walls. Walls/doors respect the document's own snap + grid type.
 */
const SQUARE_SNAP_TOOLS: MapEditSubTool[] = ["room", "hallway", "generate"];

export function effectiveGrid(grid: MapGridSettings, subTool: MapEditSubTool): MapGridSettings {
  return SQUARE_SNAP_TOOLS.includes(subTool) ? { ...grid, snap: true, type: "square" } : grid;
}
