// Which input machine each map-edit sub-tool drives, and the grid it snaps to.
// Pure predicates, kept out of useMapEditTool so the hook stays under the
// structure cap and the classification is one readable table.

import type { MapGridSettings } from "@herobyte/shared";
import type { MapEditSubTool } from "./mapEditTypes";

/**
 * Exported and `as const` so the mobile tool grid can be DERIVED from it rather
 * than hand-listed beside it. Since M6 the phone arms this set PLUS the brush
 * one (MapBoard's mapEditTouchMode is `isTouchTool(activeSubTool)`), so a
 * second hand-kept list would be a way for the two to disagree — the trap
 * mapEditFamilies.ts records killing for swatches. A new drag tool now has to
 * be given a phone tile before it compiles.
 */
export const DRAG_TOOLS = ["wall", "door", "room", "hallway", "generate", "row", "spline"] as const;

/** A sub-tool that drives the drag machine — the set touch is armed for. */
export type DragTool = (typeof DRAG_TOOLS)[number];

/**
 * Exported for the same reason DRAG_TOOLS is: since M6 the phone arms brushes
 * too, and its tile grid is a Record over the union of the two sets. A brush
 * added here without a tile is a compile error rather than a tool that is
 * armable on a phone with no way to reach it.
 */
export const BRUSH_TOOLS = ["terrain", "erase"] as const;

/** A sub-tool that drives the pointer-STREAM brush machine. */
export type BrushTool = (typeof BRUSH_TOOLS)[number];

/**
 * Exported since M7, when the click tools reached a finger too. Same contract
 * as the two sets above: a member without a phone tile does not compile.
 */
export const CLICK_TOOLS = ["place", "scatter", "light"] as const;

/** A sub-tool that resolves at ONE point: no drag, no stream. */
export type ClickTool = (typeof CLICK_TOOLS)[number];

/**
 * Every sub-tool a finger is armed for — which since M7 is all three machines.
 *
 * `select` is the one map-edit tool NOT in here, and deliberately: it arms no
 * touch gesture at all and resolves through the compat mouse path instead (see
 * MobileSelectPanel). Widening this to "every sub-tool" would arm it twice.
 */
export type TouchTool = DragTool | BrushTool | ClickTool;

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
export function isBrushTool(subTool: MapEditSubTool): subTool is BrushTool {
  return (BRUSH_TOOLS as readonly MapEditSubTool[]).includes(subTool);
}

/** True for every sub-tool the touch path arms — see `TouchTool`. */
export function isTouchTool(subTool: MapEditSubTool): subTool is TouchTool {
  return isDragTool(subTool) || isBrushTool(subTool) || isClickTool(subTool);
}

/** Place + scatter + light are click tools: they resolve at one point. */
export function isClickTool(subTool: MapEditSubTool): subTool is ClickTool {
  return (CLICK_TOOLS as readonly MapEditSubTool[]).includes(subTool);
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
