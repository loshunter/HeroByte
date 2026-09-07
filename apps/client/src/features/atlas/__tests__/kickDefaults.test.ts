import { describe, expect, it } from "vitest";
import {
  DEFAULT_KICK_SETTINGS,
  KICK_SETTINGS_KEY,
  defaultName,
  freshSeed,
  loadKickSettings,
  sanitizeKickSettings,
  saveKickSettings,
} from "../kickDefaults";

const DUNGEON = { recipeId: "dungeon", theme: "wood", density: "low", size: "large" } as const;

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    store,
  };
}

describe("defaultName", () => {
  it("names the node after the recipe, with a numeric suffix only on a collision", () => {
    expect(defaultName([], DUNGEON)).toBe("Dungeon");
    expect(defaultName([{ name: "Dungeon" }], DUNGEON)).toBe("Dungeon 2");
    expect(defaultName([{ name: "Dungeon" }, { name: "Dungeon 2" }], DUNGEON)).toBe("Dungeon 3");
    expect(defaultName([{ name: "Dungeon 2" }], DUNGEON)).toBe("Dungeon");
  });

  it("compares trimmed and case-insensitively — a renamed 'dungeon ' still counts", () => {
    expect(defaultName([{ name: "  dungeon " }], DUNGEON)).toBe("Dungeon 2");
    expect(defaultName([{ name: "DUNGEON 2" }, { name: "Dungeon" }], DUNGEON)).toBe("Dungeon 3");
  });
});

describe("freshSeed", () => {
  it("mints a signed 32-bit integer", () => {
    for (let i = 0; i < 50; i += 1) {
      const seed = freshSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(-2_147_483_648);
      expect(seed).toBeLessThanOrEqual(2_147_483_647);
    }
  });
});

describe("remembered settings", () => {
  it("round-trips through storage under a versioned key", () => {
    const storage = memoryStorage();
    saveKickSettings({ recipe: DUNGEON, linkType: "stair" }, storage);
    expect(JSON.parse(storage.store.get(KICK_SETTINGS_KEY)!).version).toBe(1);
    expect(loadKickSettings(storage)).toEqual({ recipe: DUNGEON, linkType: "stair" });
  });

  it("falls back to the defaults on nothing stored, another version, or garbage", () => {
    expect(loadKickSettings(memoryStorage())).toEqual(DEFAULT_KICK_SETTINGS);
    expect(
      loadKickSettings(memoryStorage({ [KICK_SETTINGS_KEY]: JSON.stringify({ version: 0 }) })),
    ).toEqual(DEFAULT_KICK_SETTINGS);
    expect(loadKickSettings(memoryStorage({ [KICK_SETTINGS_KEY]: "{not json" }))).toEqual(
      DEFAULT_KICK_SETTINGS,
    );
    expect(loadKickSettings(undefined)).toEqual(DEFAULT_KICK_SETTINGS);
  });

  it("sanitizes what it READ, not just what it is handed — a tampered store cannot make every ROLL fail", () => {
    // The stored value is attacker-adjacent in the mundane sense: devtools, a
    // future build's shape, a half-written entry. Without this, a junk dial
    // rides into every atlas-kick and the server validator rejects it, with no
    // way out but clearing site data.
    const storage = memoryStorage({
      [KICK_SETTINGS_KEY]: JSON.stringify({
        version: 1,
        settings: {
          recipe: { recipeId: "castle", theme: "granite", density: "low", size: "large" },
          linkType: "portal",
        },
      }),
    });
    expect(loadKickSettings(storage)).toEqual({
      recipe: { recipeId: "dungeon", theme: "stone", density: "low", size: "large" },
      linkType: "door",
    });
  });

  it("sanitizes field by field — a tampered dial cannot make every ROLL fail", () => {
    expect(
      sanitizeKickSettings({
        recipe: { recipeId: "castle", theme: "granite", density: "low", size: "large" },
        linkType: "portal",
      }),
    ).toEqual({
      recipe: { recipeId: "dungeon", theme: "stone", density: "low", size: "large" },
      linkType: "door",
    });
    expect(sanitizeKickSettings(null)).toEqual(DEFAULT_KICK_SETTINGS);
  });

  it("survives a storage that throws", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadKickSettings(throwing)).toEqual(DEFAULT_KICK_SETTINGS);
    expect(() => saveKickSettings(DEFAULT_KICK_SETTINGS, throwing)).not.toThrow();
  });
});
