// The painter's deck VIEW model over PAINT_FAMILIES: material shelves in a
// fixed browse order, the search filter, and the pinned/recent rows
// (localStorage-backed so they survive reloads). Pure data + storage — the
// UI lives in MapEditBrushDeck, the derivation in mapEditFamilies.

import type { TileMaterial } from "../map-studio/starterTiles";
import { PAINT_FAMILIES, type PaintFamilyEntry } from "./mapEditFamilies";

/** Shelf browse order: everyday ground brushes first, tall levels last. */
export const BRUSH_GROUP_ORDER: readonly TileMaterial[] = [
  "ground",
  "water",
  "stone",
  "wood",
  "roof",
  "canopy",
];

export const BRUSH_GROUP_LABELS: Record<TileMaterial, string> = {
  ground: "Ground",
  water: "Water",
  stone: "Stone",
  wood: "Wood",
  roof: "Roofs",
  canopy: "Canopy",
};

export interface BrushDeckGroup {
  material: TileMaterial;
  label: string;
  entries: PaintFamilyEntry[];
}

/** The deck's shelves: families grouped by material, each shelf sorted by
 * palette priority (the map's own stacking order, low ground → tall level). */
export function buildBrushDeckGroups(
  entries: readonly PaintFamilyEntry[] = PAINT_FAMILIES,
): BrushDeckGroup[] {
  return BRUSH_GROUP_ORDER.map((material) => ({
    material,
    label: BRUSH_GROUP_LABELS[material],
    entries: entries
      .filter((entry) => entry.material === material)
      .sort((a, b) => a.priority - b.priority),
  })).filter((group) => group.entries.length > 0);
}

/** Case-insensitive match on display name, family id, or material shelf. */
export function filterBrushEntries(
  entries: readonly PaintFamilyEntry[],
  query: string,
): PaintFamilyEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...entries];
  return entries.filter(
    (entry) =>
      entry.name.toLowerCase().includes(q) ||
      entry.family.includes(q) ||
      entry.material.includes(q),
  );
}

const KNOWN_FAMILIES = new Set(PAINT_FAMILIES.map((entry) => entry.family));

export function brushEntryOf(family: string): PaintFamilyEntry | null {
  return PAINT_FAMILIES.find((entry) => entry.family === family) ?? null;
}

// --- Pins + recents (localStorage) -----------------------------------------

const PINS_KEY = "herobyte:brush-deck:pins";
const RECENTS_KEY = "herobyte:brush-deck:recents";
const MAX_RECENTS = 6;

/** Read a persisted family list, dropping junk and families that no longer
 * exist (a removed family must not ghost in the pinned row forever). */
function readFamilyList(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is string => typeof item === "string" && KNOWN_FAMILIES.has(item),
    );
  } catch {
    return [];
  }
}

function writeFamilyList(key: string, families: string[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(families));
  } catch {
    // Storage full/denied — pins just won't survive the reload.
  }
}

export function loadBrushPins(): string[] {
  return readFamilyList(PINS_KEY);
}

/** Toggle a family's pin; persists and returns the new pin list. */
export function toggleBrushPin(family: string): string[] {
  const pins = readFamilyList(PINS_KEY);
  const next = pins.includes(family) ? pins.filter((f) => f !== family) : [...pins, family];
  writeFamilyList(PINS_KEY, next);
  return next;
}

export function loadBrushRecents(): string[] {
  return readFamilyList(RECENTS_KEY);
}

/** Move a family to the front of the recents row; persists and returns it. */
export function pushBrushRecent(family: string): string[] {
  const recents = readFamilyList(RECENTS_KEY);
  const next = [family, ...recents.filter((f) => f !== family)].slice(0, MAX_RECENTS);
  writeFamilyList(RECENTS_KEY, next);
  return next;
}
