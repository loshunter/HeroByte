import { AUTHORING_TOOLS, TOOL_DESCRIPTORS } from "../mapEditToolDescriptors";
import { BRUSH_TOOLS, CLICK_TOOLS, DRAG_TOOLS, type TouchTool } from "../mapEditToolKinds";

export interface MobileToolTile {
  id: TouchTool;
  icon: string;
  label: string;
}
/** Derived from the same exhaustive descriptors and input-kind sets as desktop. */
export const MOBILE_TOOL_TILES: MobileToolTile[] = AUTHORING_TOOLS.map((id) => ({
  id,
  ...TOOL_DESCRIPTORS[id],
}));
export const TOUCH_TOOL_COUNT = DRAG_TOOLS.length + BRUSH_TOOLS.length + CLICK_TOOLS.length;
