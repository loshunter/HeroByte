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
//
// Each is short ON PURPOSE (66 characters at most): the phone sheet reserves at least two lines
// for it and the descriptions fit two lines, in a WIDE font too (Verdana; CI's DejaVu), in the
// narrowest place it appears (a 320 px portrait sheet, or the Tool column of the 640 px
// landscape layout), so arming a template never moves a chip. Where the shape
// snaps to (a cell centre, a grid corner or a cell-edge middle) is in the help topic
// "Area templates", not here.
export const TEMPLATE_TOOL_DESCRIPTIONS = {
  "template-circle": "Burst: a circle near where you press. Drag to set its radius.",
  "template-cone": "Cone: a wedge from near where you press, toward your drag.",
  "template-square": "Cube: a square, one corner near where you press. Drag to grow it.",
  "template-line": "Bolt: a line one square wide, toward where you drag.",
} satisfies Record<AreaTemplateTool, string>;

// What the phone sheet's tool line says while no template is armed (the line is always there,
// so arming a template or going back never changes the sheet's height: see
// MobileDrawingControls; the Settings rows below it still vary by tool, as they always did).
export const DRAWING_TOOL_HINT_DEFAULT = "Drag on the map to use the pressed tool.";

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
