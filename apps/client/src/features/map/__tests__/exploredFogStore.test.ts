// Explored fog is a per-player memory in localStorage. These pin the two
// things that make that safe: a key that cannot bleed between tables or
// players, and a read path that re-validates against the CURRENT map instead
// of trusting whatever is on disk.

import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  byteLengthFor,
  clearExploredMask,
  exploredFogKey,
  loadExploredMask,
  MASK_MAX_DIMENSION,
  maskGeometryFor,
  saveExploredMask,
} from "../exploredFogStore";

const SCENE = { sceneWidth: 800, sceneHeight: 600 };

// The repo's localStorage idiom (roomDirectory.test.ts): jsdom's own store is
// not fully implemented here, so tests install a plain object-backed stub.
let store: Record<string, string>;

function installStorage(): void {
  store = {};
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
    },
    writable: true,
    configurable: true,
  });
}

function metaFor(width = SCENE.sceneWidth, height = SCENE.sceneHeight) {
  return maskGeometryFor(width, height);
}

describe("exploredFogKey", () => {
  it("scopes by table, player and map document", () => {
    expect(exploredFogKey("dungeon", "uid-1", "doc-a")).toBe(
      "herobyte:fog-explored:v1:dungeon:uid-1:doc-a",
    );
  });

  // The room-secret store shipped this exact bug once: switching tables is a
  // same-tab navigation, so a flat key carried the previous table's data into
  // the new one. Here that would leak what map area a player has seen.
  it("gives two tables different keys for the same player and map", () => {
    expect(exploredFogKey("table-a", "uid-1", "doc")).not.toBe(
      exploredFogKey("table-b", "uid-1", "doc"),
    );
  });

  it("gives two players different keys — the DM's lens cannot write a player's memory", () => {
    expect(exploredFogKey("t", "dm-uid", "doc")).not.toBe(exploredFogKey("t", "player-uid", "doc"));
  });

  it("gives two maps different keys", () => {
    expect(exploredFogKey("t", "uid", "doc-a")).not.toBe(exploredFogKey("t", "uid", "doc-b"));
  });

  it("names the default table explicitly rather than leaving a gap", () => {
    expect(exploredFogKey(undefined, "uid", "doc")).toBe(
      "herobyte:fog-explored:v1:default:uid:doc",
    );
  });

  // A document id is arbitrary trimmed text by contract, so a colon inside one
  // could otherwise forge a key segment and collide with another entry.
  it("encodes a document id that contains the separator", () => {
    const forged = exploredFogKey("t", "uid", "evil:uid2:doc");
    expect(forged).toBe("herobyte:fog-explored:v1:t:uid:evil%3Auid2%3Adoc");
    expect(forged).not.toBe(exploredFogKey("t", "uid", "evil") + ":uid2:doc");
  });
});

describe("maskGeometryFor", () => {
  it("never exceeds the dimension cap, so one entry cannot fill the quota", () => {
    const huge = maskGeometryFor(20000, 12000);
    expect(huge.cols).toBeLessThanOrEqual(MASK_MAX_DIMENSION);
    expect(huge.rows).toBeLessThanOrEqual(MASK_MAX_DIMENSION);
  });

  it("keeps a floor on resolution for a small map rather than one cell per pixel", () => {
    const small = maskGeometryFor(80, 40);
    expect(small.cell).toBe(8);
    expect(small).toMatchObject({ cols: 10, rows: 5 });
  });

  it("covers the whole scene even when it does not divide evenly", () => {
    const meta = maskGeometryFor(801, 601);
    expect(meta.cols * meta.cell).toBeGreaterThanOrEqual(801);
    expect(meta.rows * meta.cell).toBeGreaterThanOrEqual(601);
  });

  it("stays under a workable byte budget at the cap", () => {
    // 512*512 bits = 32KB packed; base64 is ~4/3 of that.
    expect(byteLengthFor(maskGeometryFor(20000, 20000))).toBeLessThanOrEqual(32 * 1024);
  });
});

describe("saving and loading a mask", () => {
  const KEY = "herobyte:fog-explored:v1:t:uid:doc";

  beforeEach(installStorage);

  function bitsWith(indices: number[], meta = metaFor()): Uint8Array {
    const bits = new Uint8Array(byteLengthFor(meta));
    for (const index of indices) bits[index >> 3]! |= 1 << (index & 7);
    return bits;
  }

  it("round-trips a mask exactly", () => {
    const meta = metaFor();
    const bits = bitsWith([0, 1, 7, 8, 63, 100, meta.cols * meta.rows - 1], meta);

    saveExploredMask(KEY, { ...meta, ...SCENE }, bits);

    expect(loadExploredMask(KEY, { ...meta, ...SCENE })).toEqual(bits);
  });

  it("returns null when nothing was ever stored", () => {
    expect(loadExploredMask(KEY, { ...metaFor(), ...SCENE })).toBeNull();
  });

  // Re-validation against the CURRENT scene, not just "does it parse". A
  // republished map of a different size describes different ground.
  it("rejects a mask stored for a differently-sized scene", () => {
    const meta = metaFor();
    saveExploredMask(KEY, { ...meta, ...SCENE }, bitsWith([5], meta));

    const resized = { sceneWidth: 1200, sceneHeight: 600 };
    expect(loadExploredMask(KEY, { ...maskGeometryFor(1200, 600), ...resized })).toBeNull();
  });

  it("rejects a mask whose resolution no longer matches", () => {
    const meta = metaFor();
    saveExploredMask(KEY, { ...meta, ...SCENE }, bitsWith([5], meta));

    expect(loadExploredMask(KEY, { ...meta, cell: meta.cell * 2, ...SCENE })).toBeNull();
  });

  it("rejects a truncated or corrupt payload rather than throwing", () => {
    const meta = metaFor();
    localStorage.setItem(KEY, JSON.stringify({ ...meta, ...SCENE, bits: "not-base64!!" }));
    expect(loadExploredMask(KEY, { ...meta, ...SCENE })).toBeNull();

    localStorage.setItem(KEY, "{ not json");
    expect(loadExploredMask(KEY, { ...meta, ...SCENE })).toBeNull();

    localStorage.setItem(KEY, JSON.stringify({ ...meta, ...SCENE, bits: btoa("short") }));
    expect(loadExploredMask(KEY, { ...meta, ...SCENE })).toBeNull();
  });

  it("forgets one map on request", () => {
    const meta = metaFor();
    saveExploredMask(KEY, { ...meta, ...SCENE }, bitsWith([1], meta));
    clearExploredMask(KEY);

    expect(loadExploredMask(KEY, { ...meta, ...SCENE })).toBeNull();
  });

  // No other client store prunes by prefix, so this index is the only thing
  // stopping one entry per map a player has ever visited, forever.
  it("evicts the least recently used map past the PER-ROOM cap (v2: 24, an Atlas graph's worth)", () => {
    const meta = metaFor();
    const keys = Array.from({ length: 26 }, (_, i) => `${KEY}-${i}`);
    for (const key of keys) {
      saveExploredMask(key, { ...meta, ...SCENE }, bitsWith([1], meta));
    }

    const survivors = keys.filter((key) => loadExploredMask(key, { ...meta, ...SCENE }) !== null);
    expect(survivors).toHaveLength(24);
    // The 24 most recent, not the first 24.
    expect(survivors).toEqual(keys.slice(2));
  });

  it("keeps a map alive by re-saving it", () => {
    const meta = metaFor();
    const keys = Array.from({ length: 24 }, (_, i) => `${KEY}-${i}`);
    for (const key of keys) saveExploredMask(key, { ...meta, ...SCENE }, bitsWith([1], meta));

    saveExploredMask(keys[0]!, { ...meta, ...SCENE }, bitsWith([2], meta)); // touch the oldest
    saveExploredMask(`${KEY}-new`, { ...meta, ...SCENE }, bitsWith([1], meta));

    expect(loadExploredMask(keys[0]!, { ...meta, ...SCENE })).not.toBeNull();
    expect(loadExploredMask(keys[1]!, { ...meta, ...SCENE })).toBeNull();
  });
});

describe("when localStorage refuses to cooperate", () => {
  beforeEach(installStorage);

  // Memory fog is a nicety. Losing it must never cost the frame it was drawn on.
  it("swallows a quota error on write", () => {
    (localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const meta = metaFor();

    expect(() =>
      saveExploredMask("k", { ...meta, ...SCENE }, new Uint8Array(byteLengthFor(meta))),
    ).not.toThrow();
  });

  it("returns null when reading throws", () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(loadExploredMask("k", { ...metaFor(), ...SCENE })).toBeNull();
  });
});

describe("the v2 per-room LRU (A5)", () => {
  beforeEach(installStorage);

  function save(room: string, doc: string): string {
    const meta = metaFor();
    const key = exploredFogKey(room, "uid-1", doc);
    saveExploredMask(key, { ...meta, ...SCENE }, new Uint8Array(byteLengthFor(meta)));
    return key;
  }

  it("keeps 24 maps per room, and a second room does not evict the first's", () => {
    const first = save("room-a", "doc-0");
    for (let i = 1; i <= 23; i += 1) save("room-a", `doc-${i}`);
    for (let i = 0; i < 10; i += 1) save("room-b", `b-doc-${i}`);

    expect(store[first]).toBeDefined(); // room-b's touring cannot evict room-a
    const twentyFifth = save("room-a", "doc-24");
    expect(store[twentyFifth]).toBeDefined();
    expect(store[first]).toBeUndefined(); // room-a's own 25th evicts its oldest
  });

  it("evicting a ROOM takes all of its masks with it — nothing orphans", () => {
    const evicted = save("room-0", "doc-x");
    for (let i = 1; i <= 4; i += 1) save(`room-${i}`, "doc-x"); // 4-room registry cap

    expect(store[evicted]).toBeUndefined();
    expect(store["herobyte:fog-explored-index:v2:room-0"]).toBeUndefined();
  });

  it("migrates the legacy GLOBAL index: masks re-file under their rooms, the old index dies", () => {
    const meta = metaFor();
    const legacyKey = exploredFogKey("old-room", "uid-1", "old-doc");
    // A v1-era store: the mask exists and the GLOBAL index references it.
    store[legacyKey] = JSON.stringify({ ...meta, ...SCENE, bits: "" });
    store["herobyte:fog-explored:v1:index"] = JSON.stringify([legacyKey]);

    save("room-a", "doc-0"); // any write triggers the migration

    expect(store["herobyte:fog-explored:v1:index"]).toBeUndefined();
    expect(store[legacyKey]).toBeDefined(); // the mask survived the migration
    expect(store["herobyte:fog-explored-index:v2:old-room"]).toContain("old-doc");
  });
});
