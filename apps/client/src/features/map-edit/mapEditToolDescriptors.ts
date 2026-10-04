import { BRUSH_TOOLS, CLICK_TOOLS, DRAG_TOOLS, type TouchTool } from "./mapEditToolKinds";
import type { MapEditSubTool } from "./mapEditTypes";

export const TOOL_GROUPS = [
  { id: "terrain", label: "Terrain", initialTool: "terrain" },
  { id: "structures", label: "Structures", initialTool: "wall" },
  { id: "objects", label: "Objects", initialTool: "place" },
  { id: "lighting", label: "Lighting", initialTool: "light" },
  { id: "generate", label: "Generate", initialTool: "generate" },
] as const;
export type MapEditGroup = (typeof TOOL_GROUPS)[number]["id"];

interface ToolDescriptor {
  group: MapEditGroup | null;
  label: string;
  icon: string;
  help: string;
  mobilePanel: boolean;
}

/** Exhausts the existing sub-tool union; presentation never invents an input tool. */
export const TOOL_DESCRIPTORS = {
  terrain: {
    group: "terrain",
    label: "Paint terrain",
    icon: "🖌️",
    help: "Paint with the selected material and square brush size.",
    mobilePanel: true,
  },
  erase: {
    group: "terrain",
    label: "Erase terrain",
    icon: "🧹",
    help: "Remove terrain with the selected square brush size.",
    mobilePanel: true,
  },
  room: {
    group: "structures",
    label: "Room",
    icon: "🏠",
    help: "Drag a room with a floor and perimeter walls.",
    mobilePanel: true,
  },
  hallway: {
    group: "structures",
    label: "Hallway",
    icon: "🚇",
    help: "Drag a corridor with the selected width and side walls.",
    mobilePanel: true,
  },
  wall: {
    group: "structures",
    label: "Wall",
    icon: "🧱",
    help: "Drag a blocking wall segment.",
    mobilePanel: false,
  },
  door: {
    group: "structures",
    label: "Door",
    icon: "🚪",
    help: "Drag a door across an opening.",
    mobilePanel: false,
  },
  place: {
    group: "objects",
    label: "Place object",
    icon: "📦",
    help: "Place the selected asset as a grid tile or free stamp.",
    mobilePanel: true,
  },
  scatter: {
    group: "objects",
    label: "Scatter objects",
    icon: "🎲",
    help: "Place a seeded cluster of the selected asset.",
    mobilePanel: true,
  },
  row: {
    group: "objects",
    label: "Repeat along line",
    icon: "📏",
    help: "Drag a line of repeated objects.",
    mobilePanel: true,
  },
  spline: {
    group: "objects",
    label: "Rope / curve",
    icon: "〰️",
    help: "Drag a rope, chain, ribbon or decorative curve.",
    mobilePanel: true,
  },
  light: {
    group: "lighting",
    label: "Place light",
    icon: "💡",
    help: "Set Ambient light from Dark to Daylight, then place a light pool.",
    mobilePanel: true,
  },
  generate: {
    group: "generate",
    label: "Generate area",
    icon: "🏰",
    help: "Aim a region, choose a recipe, then generate in that area.",
    mobilePanel: true,
  },
  select: {
    group: null,
    label: "Select",
    icon: "👆",
    help: "Select an element to inspect or edit it.",
    mobilePanel: true,
  },
  eyedropper: {
    group: null,
    label: "Sample",
    icon: "💧",
    help: "Sample a material to Paint, or an object to Place. Ctrl/Cmd keeps the current tool.",
    mobilePanel: false,
  },
} satisfies Record<MapEditSubTool, ToolDescriptor>;

const armable = new Set<MapEditSubTool>([...DRAG_TOOLS, ...BRUSH_TOOLS, ...CLICK_TOOLS]);
export const AUTHORING_TOOLS = (Object.keys(TOOL_DESCRIPTORS) as MapEditSubTool[]).filter(
  (id): id is TouchTool => armable.has(id),
);
export const PERSISTENT_TOOLS = (Object.keys(TOOL_DESCRIPTORS) as MapEditSubTool[]).filter(
  (id) => TOOL_DESCRIPTORS[id].group === null,
);
export const MOBILE_PANEL_TOOLS: ReadonlySet<MapEditSubTool> = new Set(
  (Object.keys(TOOL_DESCRIPTORS) as MapEditSubTool[]).filter(
    (id) => TOOL_DESCRIPTORS[id].mobilePanel,
  ),
);
