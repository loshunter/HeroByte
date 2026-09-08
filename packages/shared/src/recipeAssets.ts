// ============================================================================
// RECIPE ASSETS — the catalog ids the server's recipes paint and stamp with
// ============================================================================
// Runtime consts in their own sub-module (the barrel re-exports the values —
// the shared-barrel rule). The server imports these; a CLIENT test asserts
// every id here exists in the tile catalog, because only the client can see
// both sides and a hand-copied list could never fail.

export const RECIPE_FLOOR_ASSETS = {
  stoneFloor: "terrain:stone-floor",
  woodFloor: "terrain:wood-floor",
  stoneCobble: "terrain:stone-cobble",
  woodWalnut: "terrain:wood-walnut",
  woodGrey: "terrain:wood-grey",
} as const;

export const RECIPE_WALL_ASSETS = {
  stone: "terrain:wall-stone",
  brick: "terrain:wall-brick",
  timber: "terrain:wall-timber",
  dark: "terrain:wall-dark",
} as const;

/** Object stamps, with their footprint in CELLS (the catalog's columns × rows). */
export const RECIPE_OBJECT_ASSETS = {
  crate: { id: "objects:crate", columns: 1, rows: 1 },
  table: { id: "objects:table", columns: 2, rows: 1 },
  lamp: { id: "objects:lamp", columns: 1, rows: 1 },
} as const;

/** Every id above, flat — the catalog-subset test walks this. */
export const RECIPE_ASSET_IDS: readonly string[] = [
  ...Object.values(RECIPE_FLOOR_ASSETS),
  ...Object.values(RECIPE_WALL_ASSETS),
  ...Object.values(RECIPE_OBJECT_ASSETS).map((asset) => asset.id),
];
