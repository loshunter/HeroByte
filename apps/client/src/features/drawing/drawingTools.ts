import { AREA_TEMPLATE_TOOLS, type DrawTool } from "@herobyte/shared";

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
