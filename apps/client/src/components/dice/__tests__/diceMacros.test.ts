/**
 * Tests for diceMacros — the client-local saved-roll store.
 *
 * Every accessor goes through a defensive localStorage wrapper, and every
 * entry is re-validated with the SERVER's parser on read, because the store is
 * user-editable through devtools. Both of those are the point of the module,
 * so both are pinned here rather than assumed.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { BUILTIN_MACROS, deleteMacro, loadMacros, saveMacro } from "../diceMacros";

const KEY = "herobyte.dice.macros";

describe("diceMacros", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    // The environment's localStorage is a partial stub, so the suite installs
    // its own — the same shape DraggableWindow.test.tsx uses.
    store = {};
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete store[key];
        }),
        clear: vi.fn(() => {
          store = {};
        }),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("built-ins", () => {
    it("are every one a formula the server would accept", async () => {
      const { parseDiceFormula } = await import("@herobyte/shared");
      for (const macro of BUILTIN_MACROS) {
        expect(parseDiceFormula(macro.formula).ok, macro.label).toBe(true);
      }
    });

    it("do not collide with the ADV/DIS labels on the mode toggle beside them", () => {
      // Two same-named controls in one panel is a footgun for a player and an
      // ambiguous query for a test — this is why they read "ADV d20".
      const labels = BUILTIN_MACROS.map((macro) => macro.label);
      expect(labels).not.toContain("ADV");
      expect(labels).not.toContain("DIS");
    });
  });

  describe("saving", () => {
    it("round-trips a saved macro", () => {
      const saved = saveMacro("Sneak", "2d6 + 3", "normal");

      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({ label: "Sneak", formula: "2d6 + 3", mode: "normal" });
      expect(loadMacros()).toEqual(saved);
    });

    it("trims and caps the label", () => {
      const saved = saveMacro(`   ${"x".repeat(40)}   `, "d20", "normal");
      expect(saved[0]?.label).toHaveLength(24);
    });

    it("refuses an empty label or a formula the server would reject", () => {
      expect(saveMacro("   ", "d20", "normal")).toEqual([]);
      expect(saveMacro("Nope", "2d7", "normal")).toEqual([]);
      expect(saveMacro("Nope", "", "normal")).toEqual([]);
      expect(loadMacros()).toEqual([]);
    });

    it("replaces rather than duplicating when the same roll is renamed", () => {
      saveMacro("Attack", "d20 + 5", "advantage");
      const saved = saveMacro("Sneak Attack", "d20 + 5", "advantage");

      expect(saved).toHaveLength(1);
      expect(saved[0]?.label).toBe("Sneak Attack");
    });

    it("replaces rather than duplicating when a name is reused", () => {
      saveMacro("Attack", "d20 + 5", "normal");
      const saved = saveMacro("Attack", "2d6", "normal");

      expect(saved).toHaveLength(1);
      expect(saved[0]?.formula).toBe("2d6");
    });

    it("keeps only the newest entries past the cap", () => {
      for (let i = 0; i < 20; i++) saveMacro(`m${i}`, `${i + 1}d6`, "normal");

      const saved = loadMacros();
      expect(saved).toHaveLength(12);
      expect(saved.at(-1)?.label).toBe("m19");
      expect(saved.map((macro) => macro.label)).not.toContain("m0");
    });
  });

  describe("deleting", () => {
    it("forgets one macro and leaves the rest", () => {
      saveMacro("A", "d4", "normal");
      const saved = saveMacro("B", "d6", "normal");
      const target = saved.find((macro) => macro.label === "A")!;

      const left = deleteMacro(target.id);

      expect(left.map((macro) => macro.label)).toEqual(["B"]);
      expect(loadMacros()).toEqual(left);
    });

    it("cannot remove a built-in", () => {
      saveMacro("A", "d4", "normal");
      expect(deleteMacro("builtin-d20")).toHaveLength(1);
    });
  });

  describe("a hostile or broken store", () => {
    it("ignores stored junk rather than rendering it", () => {
      store[KEY] = "not json at all";
      expect(loadMacros()).toEqual([]);

      store[KEY] = JSON.stringify({ not: "an array" });
      expect(loadMacros()).toEqual([]);
    });

    it("drops an entry whose formula the server would now refuse", () => {
      // Hand-edited through devtools, or written by an older build with looser
      // limits. It should disappear from the bar, not sit there failing every
      // time it is tapped.
      store[KEY] = JSON.stringify([
        { id: "ok", label: "Good", formula: "d20", mode: "normal" },
        { id: "bad", label: "Bad", formula: "999d20", mode: "normal" },
        { id: "worse", label: "Worse", formula: "<script>", mode: "normal" },
        { id: "shapeless", label: 42, formula: "d6", mode: "normal" },
      ]);

      expect(loadMacros().map((macro) => macro.id)).toEqual(["ok"]);
    });

    it("degrades to no macros when localStorage throws", () => {
      vi.mocked(window.localStorage.getItem).mockImplementation(() => {
        throw new Error("SecurityError");
      });

      expect(() => loadMacros()).not.toThrow();
      expect(loadMacros()).toEqual([]);
    });

    it("does not lose the roll in progress when the store is full", () => {
      vi.mocked(window.localStorage.setItem).mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

      expect(() => saveMacro("Big", "d20", "normal")).not.toThrow();
    });
  });
});
