// The phone's map-edit tool tiles, derived from the armable set rather than
// listed beside it.
//
// The phone arms EXACTLY the drag tools and the brush tools — MapBoard's
// mapEditTouchMode is `mapEditMode && isTouchTool(activeSubTool)`, and
// useArmedTouchTool routes off that alone. A hand-kept tile list would be a
// second copy of that set, free to drift from it in either direction: a tile
// for a tool the touch path refuses to arm (which looks armed and silently
// does nothing — the failure this mode is worst at), or an armable tool with
// no way to reach it on a phone.
//
// So PRESENTATION is a Record over TouchTool. Adding a tool to any of the three
// sets is a COMPILE ERROR here until it is given a tile, and a tile for a tool
// none of them contains will not type. That check earned its keep in M7: the
// click tools joined TouchTool and this file refused to compile until they had
// tiles, which is exactly the drift it exists to catch.

import { BRUSH_TOOLS, CLICK_TOOLS, DRAG_TOOLS, type TouchTool } from "../mapEditToolKinds";

export interface MobileToolTile {
  id: TouchTool;
  icon: string;
  label: string;
}

// Declaration order IS display order (string keys keep insertion order), so the
// exhaustiveness check and the layout are one list rather than two. Paint and
// Erase lead: VISION.md:46 promises painting on a touch device, and the two
// brushes are what a DM reaches for most between structural passes. Room, Hall,
// Wall and Door follow as the structural four; then Place, Scatter and Light,
// which dress a room once it exists; Row, Spline and Gen last.
// Labels stay short — the grid is 3 columns under 420px — and the icons are
// the DESKTOP palette's, so the two surfaces name the same tool the same way.
const PRESENTATION: Record<TouchTool, { icon: string; label: string }> = {
  terrain: { icon: "🖌️", label: "Paint" },
  erase: { icon: "🧹", label: "Erase" },
  room: { icon: "🏠", label: "Room" },
  hallway: { icon: "🚇", label: "Hall" },
  wall: { icon: "▬", label: "Wall" },
  door: { icon: "🚪", label: "Door" },
  place: { icon: "📦", label: "Place" },
  scatter: { icon: "🎲", label: "Scatter" },
  light: { icon: "💡", label: "Light" },
  row: { icon: "📏", label: "Row" },
  spline: { icon: "〰️", label: "Spline" },
  generate: { icon: "🏰", label: "Gen" },
};

export const MOBILE_TOOL_TILES: MobileToolTile[] = (Object.keys(PRESENTATION) as TouchTool[]).map(
  (id) => ({ id, ...PRESENTATION[id] }),
);

/** Every armable tool has a tile — pinned by a test, since the Record type
 * alone cannot catch a PRESENTATION key that was deleted along with its tool. */
export const TOUCH_TOOL_COUNT = DRAG_TOOLS.length + BRUSH_TOOLS.length + CLICK_TOOLS.length;
