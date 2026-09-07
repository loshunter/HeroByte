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

const THEMES = new Set(["stone", "wood"]);
const DENSITIES = new Set(["low", "medium", "high"]);
const SIZES = new Set(["small", "medium", "large"]);
const LINK_TYPES = new Set(["door", "stair", "signpost"]);

/** The kind label a recipe's node takes; the building recipe adds its kinds. */
export function recipeLabel(recipe: GenerateRequest): string {
  switch (recipe.recipeId) {
    case "dungeon":
      return "Dungeon";
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

/** Anything that is not exactly a known dial falls back field by field. */
export function sanitizeKickSettings(input: unknown): KickSettings {
  const record = (input ?? {}) as Partial<Record<keyof KickSettings, unknown>>;
  const recipe = (record.recipe ?? {}) as Partial<Record<keyof GenerateRequest, unknown>>;
  const fallback = DEFAULT_KICK_SETTINGS.recipe;
  return {
    recipe: {
      recipeId: "dungeon",
      theme: THEMES.has(recipe.theme as string)
        ? (recipe.theme as "stone" | "wood")
        : fallback.theme,
      density: DENSITIES.has(recipe.density as string)
        ? (recipe.density as "low" | "medium" | "high")
        : fallback.density,
      size: SIZES.has(recipe.size as string)
        ? (recipe.size as GenerateRequest["size"])
        : fallback.size,
    },
    linkType: LINK_TYPES.has(record.linkType as string)
      ? (record.linkType as MapLink["linkType"])
      : DEFAULT_KICK_SETTINGS.linkType,
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
