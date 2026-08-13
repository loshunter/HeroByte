// The phone's map-edit tool tiles, derived from the drag set rather than listed
// beside it.
//
// The phone arms EXACTLY the drag tools — MapBoard's mapEditDragMode is
// `mapEditMode && isDragTool(activeSubTool)`, and useArmedTouchTool routes off
// that alone. A hand-kept tile list would be a second copy of that set, free to
// drift from it in either direction: a tile for a tool the touch path refuses
// to arm (which looks armed and silently does nothing — the failure this mode
// is worst at), or a drag tool with no way to reach it on a phone.
//
// So PRESENTATION is a Record over DragTool. Adding an eighth drag tool is a
// COMPILE ERROR here until it is given a tile, and a tile for a non-drag tool
// will not type. The click tools (place/scatter/light) and brush tools
// (terrain/erase) are absent by construction, not by omission — a touch TAP
// generates compat mouse events and would drop two stamps per tap, which is
// why M4c armed the drag class only.

import { DRAG_TOOLS, type DragTool } from "../mapEditToolKinds";

export interface MobileToolTile {
  id: DragTool;
  icon: string;
  label: string;
}

// Declaration order IS display order (string keys keep insertion order), so the
// exhaustiveness check and the layout are one list rather than two. Room, Hall,
// Wall and Door lead because they are the structural four; Row, Spline and Gen
// follow. Labels stay short — the grid is 3 columns under 420px.
const PRESENTATION: Record<DragTool, { icon: string; label: string }> = {
  room: { icon: "🏠", label: "Room" },
  hallway: { icon: "🚇", label: "Hall" },
  wall: { icon: "▬", label: "Wall" },
  door: { icon: "🚪", label: "Door" },
  row: { icon: "📏", label: "Row" },
  spline: { icon: "〰️", label: "Spline" },
  generate: { icon: "🏰", label: "Gen" },
};

export const MOBILE_TOOL_TILES: MobileToolTile[] = (Object.keys(PRESENTATION) as DragTool[]).map(
  (id) => ({ id, ...PRESENTATION[id] }),
);

/** Every drag tool has a tile — pinned by a test, since the Record type alone
 * cannot catch a PRESENTATION key that was deleted along with its tool. */
export const DRAG_TOOL_COUNT = DRAG_TOOLS.length;
