import { AREA_TEMPLATE_TOOLS, type AreaTemplateTool, type DrawTool } from "@herobyte/shared";

export const DRAWING_TOOL_LABELS = {
  freehand: "Freehand",
  line: "Line",
  rect: "Rectangle",
  circle: "Circle",
  eraser: "Erase drawings",
  "template-circle": "AoE Burst",
  "template-cone": "AoE Cone",
  "template-square": "AoE Cube",
  "template-line": "AoE Bolt",
} satisfies Record<DrawTool, string>;

// The shape each template draws, in plain words: the labels are 5e's, and a
// newcomer cannot read "Burst" or "Bolt" as a shape. Shown beside the tool once
// it is active (a phone has no hover) and as the desktop button's tooltip.
export const TEMPLATE_TOOL_DESCRIPTIONS = {
  "template-circle":
    "Burst: a circle around the nearest cell centre, grid corner or cell-edge middle to where you press. Drag out to set its radius.",
  "template-cone":
    "Cone: a wedge that fans out from the nearest cell centre, grid corner or cell-edge middle to where you press, toward where you drag.",
  "template-square":
    "Cube: a square with one corner on the grid corner nearest where you press. Drag toward where it should grow; the longer distance sets its side.",
  "template-line":
    "Bolt: a straight line, one square wide, from the nearest cell centre, grid corner or cell-edge middle to where you press toward where you drag.",
} satisfies Record<AreaTemplateTool, string>;

export const DRAWING_TOOL_ICONS: Record<DrawTool, string> = {
  freehand: "✏️",
  line: "📏",
  rect: "▭",
  circle: "⬤",
  eraser: "🧹",
  "template-circle": "◯",
  "template-cone": "◺",
  "template-square": "▢",
  "template-line": "▬",
};

export const ANNOTATION_TOOLS = ["freehand", "line", "rect", "circle", "eraser"] as const;
export const DRAWING_TOOLS = [...ANNOTATION_TOOLS, ...AREA_TEMPLATE_TOOLS];
