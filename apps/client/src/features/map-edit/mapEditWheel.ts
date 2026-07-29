// Quick-wheel slot model (P5): 8 radial slots — the four everyday tools and
// four brush slots drawn from the deck's pins, then recents, then the first
// shelf entries. Pure derivation over the SAME data the painter's deck uses
// (PAINT_FAMILIES + the localStorage pins/recents), so the wheel can never
// disagree with the deck.

import { buildBrushDeckGroups, loadBrushPins, loadBrushRecents } from "./brushDeck";
import { PAINT_FAMILIES, type PaintFamilyEntry } from "./mapEditFamilies";
import type { MapEditSubTool } from "./mapEditTypes";

export interface WheelToolSlot {
  kind: "tool";
  tool: MapEditSubTool;
  icon: string;
  label: string;
}

export interface WheelBrushSlot {
  kind: "brush";
  entry: PaintFamilyEntry;
  pinned: boolean;
}

export type WheelSlot = WheelToolSlot | WheelBrushSlot;

/** The four everyday authoring tools (the S2–S6 core loop). */
export const WHEEL_TOOLS: WheelToolSlot[] = [
  { kind: "tool", tool: "room", icon: "🏠", label: "Room" },
  { kind: "tool", tool: "wall", icon: "🧱", label: "Wall" },
  { kind: "tool", tool: "terrain", icon: "🖌️", label: "Paint" },
  { kind: "tool", tool: "erase", icon: "🧹", label: "Erase" },
];

/** 8 slots: the tool arc plus four brushes — pins, then recents, then the
 * deck's shelves in browse order. Deduped; always exactly four brushes. */
export function buildWheelSlots(
  pins: string[] = loadBrushPins(),
  recents: string[] = loadBrushRecents(),
): WheelSlot[] {
  const byFamily = new Map(PAINT_FAMILIES.map((entry) => [entry.family, entry]));
  const pinnedSet = new Set(pins);
  const chosen: PaintFamilyEntry[] = [];
  const push = (family: string): void => {
    const entry = byFamily.get(family);
    if (entry && chosen.length < 4 && !chosen.includes(entry)) chosen.push(entry);
  };
  pins.forEach(push);
  recents.forEach(push);
  for (const group of buildBrushDeckGroups()) {
    for (const entry of group.entries) push(entry.family);
  }
  return [
    ...WHEEL_TOOLS,
    ...chosen.map((entry) => ({
      kind: "brush" as const,
      entry,
      pinned: pinnedSet.has(entry.family),
    })),
  ];
}

/**
 * A brush pick arms the family; when the active tool doesn't consume the
 * paint family (wall/door/place/…), it also arms the Paint brush so the pick
 * is immediately usable. Room/Hall keep their tool — a family swap mid-room
 * is a legit move (same rule as the deck staying visible for those tools).
 */
export function toolAfterBrushPick(activeSubTool: MapEditSubTool): MapEditSubTool {
  return activeSubTool === "room" || activeSubTool === "hallway" || activeSubTool === "terrain"
    ? activeSubTool
    : "terrain";
}
