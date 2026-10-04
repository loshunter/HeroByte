import type { PopulateCategory, PopulateDensity } from "./mapEditTypes";

// One set of words for Populate's chips: the desktop panel once printed the raw ids
// ("structures", "decals") and the phone abbreviated them ("Structs", "Med").
export const POPULATE_CATEGORIES: { id: PopulateCategory; label: string }[] = [
  { id: "objects", label: "Objects" },
  { id: "structures", label: "Structures" },
  { id: "terrain", label: "Terrain" },
  { id: "decals", label: "Decals" },
];

export const POPULATE_DENSITIES: { id: PopulateDensity; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];
