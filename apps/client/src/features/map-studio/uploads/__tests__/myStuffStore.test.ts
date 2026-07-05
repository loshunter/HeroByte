import { beforeEach, describe, expect, it } from "vitest";
import {
  MY_STUFF_MAX_ENTRIES,
  addMyStuffAsset,
  loadMyStuffAssets,
  removeMyStuffAsset,
  type MyStuffAsset,
} from "../myStuffStore";

const STORAGE_KEY = "herobyte-my-stuff";

function hashOf(index: number): string {
  return index.toString(16).padStart(64, "0");
}

function asset(index: number, overrides: Partial<MyStuffAsset> = {}): MyStuffAsset {
  return {
    hash: hashOf(index),
    name: `Asset ${index}`,
    mime: "image/png",
    size: 128,
    addedAt: 1_000 + index,
    ...overrides,
  };
}

// The client vitest environment ships a broken localStorage global; replace it
// with a working in-memory one (same pattern as features/rooms/__tests__).
let backing: Map<string, string>;
beforeEach(() => {
  backing = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => void backing.set(key, value),
      removeItem: (key: string) => void backing.delete(key),
      clear: () => backing.clear(),
    },
    writable: true,
    configurable: true,
  });
});

describe("loadMyStuffAssets", () => {
  it("returns an empty shelf when nothing is stored", () => {
    expect(loadMyStuffAssets()).toEqual([]);
  });

  it("returns an empty shelf when the stored JSON is corrupt", () => {
    backing.set(STORAGE_KEY, "{not json");
    expect(loadMyStuffAssets()).toEqual([]);
  });

  it("returns an empty shelf when storage throws", () => {
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: () => {
          throw new Error("denied");
        },
      },
      writable: true,
      configurable: true,
    });
    expect(loadMyStuffAssets()).toEqual([]);
  });

  it("drops malformed entries and keeps valid ones", () => {
    const good = asset(1, { width: 64, height: 32 });
    backing.set(
      STORAGE_KEY,
      JSON.stringify([
        good,
        { ...asset(2), hash: "not-a-hash" },
        { ...asset(3), name: 7 },
        "garbage",
        null,
      ]),
    );
    expect(loadMyStuffAssets()).toEqual([good]);
  });
});

/** Fold a sequence of adds through the store, threading the returned list. */
function addAll(...assets: MyStuffAsset[]): MyStuffAsset[] {
  return assets.reduce<MyStuffAsset[]>((current, next) => addMyStuffAsset(current, next), []);
}

describe("addMyStuffAsset", () => {
  it("persists and returns newest-first", () => {
    const list = addAll(asset(1), asset(2));
    expect(list.map((entry) => entry.hash)).toEqual([hashOf(2), hashOf(1)]);
    expect(loadMyStuffAssets()).toEqual(list);
  });

  it("dedupes by hash, moving the re-upload to the front with fresh metadata", () => {
    const renamed = asset(1, { name: "Renamed", addedAt: 9_999 });
    const list = addAll(asset(1), asset(2), renamed);
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual(renamed);
  });

  it("caps the shelf, dropping the oldest entries", () => {
    const list = addAll(
      ...Array.from({ length: MY_STUFF_MAX_ENTRIES + 5 }, (_, index) => asset(index)),
    );
    expect(list).toHaveLength(MY_STUFF_MAX_ENTRIES);
    expect(list[0]?.hash).toBe(hashOf(MY_STUFF_MAX_ENTRIES + 4));
    expect(list.at(-1)?.hash).toBe(hashOf(5));
  });

  it("keeps earlier same-session uploads when persistence keeps failing", () => {
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota");
        },
      },
      writable: true,
      configurable: true,
    });
    // Threading the returned list (not re-reading localStorage) survives the
    // failed persist: the second upload must not erase the first.
    const list = addAll(asset(1), asset(2));
    expect(list.map((entry) => entry.hash)).toEqual([hashOf(2), hashOf(1)]);
  });
});

describe("removeMyStuffAsset", () => {
  it("removes the entry and persists the rest", () => {
    const list = removeMyStuffAsset(addAll(asset(1), asset(2)), hashOf(1));
    expect(list.map((entry) => entry.hash)).toEqual([hashOf(2)]);
    expect(loadMyStuffAssets()).toEqual(list);
  });
});
