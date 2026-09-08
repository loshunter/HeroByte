// ============================================================================
// KICK DEFAULTS — the pure half of the kicked-in door panel
// ============================================================================
// What the panel opens WITH: a name players will see the moment they arrive
// (never "Unnamed #3"), a seed minted the way useGenerate mints one, and the
// dials the DM last rolled with, remembered per browser. Pure functions, so
// every rule here has a test that needs no DOM.

import type { AtlasNodeSnapshot, GenerateRequest, MapLink } from "@herobyte/shared";

export const KICK_SETTINGS_KEY = "herobyte:kick:last";
const KICK_SETTINGS_VERSION = 1;

/** The dials a DM last rolled with. */
export interface KickSettings {
  recipe: GenerateRequest;
  linkType: MapLink["linkType"];
}

export const DEFAULT_KICK_SETTINGS: KickSettings = {
  recipe: { recipeId: "dungeon", theme: "stone", density: "medium", size: "medium" },
  linkType: "door",
};

/** The dungeon's dials, kept so a recipe swap can restore what was chosen. */
export const DEFAULT_DUNGEON = { theme: "stone", density: "medium" } as const;
export const DEFAULT_BUILDING_KIND = "tavern";

const THEMES = new Set(["stone", "wood"]);
const DENSITIES = new Set(["low", "medium", "high"]);
const SIZES = new Set(["small", "medium", "large"]);
const KINDS = new Set(["tavern", "shop", "warehouse", "house"]);
const LINK_TYPES = new Set(["door", "stair", "signpost"]);

/**
 * The name a node takes when the DM does not rename it. A building is named
 * for its KIND — "Tavern", not "Building" — because that is what the players
 * are about to walk into, and the node auto-discovers on arrival.
 */
export function recipeLabel(recipe: GenerateRequest): string {
  switch (recipe.recipeId) {
    case "dungeon":
      return "Dungeon";
    case "building":
      return recipe.kind.charAt(0).toUpperCase() + recipe.kind.slice(1);
  }
}

/**
 * "Dungeon", or "Dungeon 2" when the DM already has one — the numeric suffix
 * only on a collision against the DM's own node list, compared trimmed and
 * case-insensitively so "dungeon " does not slip past.
 */
export function defaultName(
  nodes: readonly Pick<AtlasNodeSnapshot, "name">[],
  recipe: GenerateRequest,
): string {
  const base = recipeLabel(recipe);
  const taken = new Set(nodes.map((node) => node.name.trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base} ${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/** Signed 32-bit from crypto, the useGenerate convention — never Math.random. */
export function freshSeed(): number {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0]! | 0;
}

/**
 * Anything that is not exactly a known dial falls back field by field. The
 * stored value is attacker-adjacent in the mundane sense — devtools, a future
 * build's shape, a half-written entry — and a junk dial that rode into the
 * message would be rejected by the server's validator on EVERY roll, with no
 * way out but clearing site data.
 */
export function sanitizeKickSettings(input: unknown): KickSettings {
  const record = (input ?? {}) as { recipe?: unknown; linkType?: unknown };
  const recipe = (record.recipe ?? {}) as Record<string, unknown>;
  const size = SIZES.has(recipe.size as string)
    ? (recipe.size as GenerateRequest["size"])
    : DEFAULT_KICK_SETTINGS.recipe.size;
  const linkType = LINK_TYPES.has(record.linkType as string)
    ? (record.linkType as MapLink["linkType"])
    : DEFAULT_KICK_SETTINGS.linkType;

  if (recipe.recipeId === "building") {
    return {
      recipe: {
        recipeId: "building",
        kind: KINDS.has(recipe.kind as string)
          ? (recipe.kind as "tavern" | "shop" | "warehouse" | "house")
          : DEFAULT_BUILDING_KIND,
        size,
      },
      linkType,
    };
  }
  return {
    recipe: {
      recipeId: "dungeon",
      theme: THEMES.has(recipe.theme as string)
        ? (recipe.theme as "stone" | "wood")
        : DEFAULT_DUNGEON.theme,
      density: DENSITIES.has(recipe.density as string)
        ? (recipe.density as "low" | "medium" | "high")
        : DEFAULT_DUNGEON.density,
      size,
    },
    linkType,
  };
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** localStorage, or nothing: some contexts throw on the accessor itself. */
function safeStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function loadKickSettings(storage: StorageLike | undefined = safeStorage()): KickSettings {
  try {
    const raw = storage?.getItem(KICK_SETTINGS_KEY);
    if (!raw) return DEFAULT_KICK_SETTINGS;
    const parsed = JSON.parse(raw) as { version?: unknown; settings?: unknown };
    if (parsed?.version !== KICK_SETTINGS_VERSION) return DEFAULT_KICK_SETTINGS;
    return sanitizeKickSettings(parsed.settings);
  } catch {
    return DEFAULT_KICK_SETTINGS;
  }
}

export function saveKickSettings(
  settings: KickSettings,
  storage: StorageLike | undefined = safeStorage(),
): void {
  try {
    storage?.setItem(
      KICK_SETTINGS_KEY,
      JSON.stringify({ version: KICK_SETTINGS_VERSION, settings }),
    );
  } catch {
    // Quota, private mode, a locked-down webview: remembering is a convenience.
  }
}
