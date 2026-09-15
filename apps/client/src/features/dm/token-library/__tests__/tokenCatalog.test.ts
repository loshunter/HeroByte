/**
 * The bundled token pack: the catalog and the files under public/ are
 * generated together, so what the tests pin is that they still agree — every
 * entry has its PNG at the URL the library will write, no PNG is a stray,
 * and the shape the NPC plumbing relies on (names under the create-npc cap,
 * reciprocal mimic pairs, a category per family) holds for every entry.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LIBRARY_ASSETS,
  LIBRARY_CATEGORIES,
  LIBRARY_FAMILIES,
  LIBRARY_TOKEN_ROOT,
  libraryAssetById,
  libraryAssetByImageUrl,
  libraryCategoryLabel,
  libraryCounterpart,
  libraryFamilyLabel,
  libraryImageUrl,
  searchLibrary,
} from "../tokenCatalog";

const PUBLIC_ROOT = resolve(__dirname, "../../../../../public/tokens");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngsUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...pngsUnder(full));
    else if (entry.endsWith(".png")) out.push(full);
  }
  return out;
}

describe("the bundled token catalog", () => {
  it("ships a PNG for every entry, at the URL the library writes", () => {
    for (const asset of LIBRARY_ASSETS) {
      const url = libraryImageUrl(asset);
      expect(url.startsWith(`${LIBRARY_TOKEN_ROOT}/`)).toBe(true);
      const file = join(PUBLIC_ROOT, ...asset.src.split("/"));
      expect(existsSync(file), `${asset.id} has no file at ${file}`).toBe(true);
      expect(readFileSync(file).subarray(0, 8).equals(PNG_SIGNATURE), asset.id).toBe(true);
    }
  });

  it("has no stray PNG: every file under public/ is a catalog entry", () => {
    const listed = new Set(
      LIBRARY_ASSETS.map((asset) => join(PUBLIC_ROOT, ...asset.src.split("/"))),
    );
    const strays = pngsUnder(PUBLIC_ROOT).filter((file) => !listed.has(file));
    expect(strays).toEqual([]);
  });

  it("holds both halves of the pack, and every family belongs to one of them", () => {
    const monsters = LIBRARY_ASSETS.filter((a) => a.category === "monster");
    const civilians = LIBRARY_ASSETS.filter((a) => a.category === "civilian");
    expect(monsters.length).toBeGreaterThan(100);
    expect(civilians.length).toBeGreaterThan(30);
    expect(monsters.length + civilians.length).toBe(LIBRARY_ASSETS.length);
    expect(new Set(LIBRARY_ASSETS.map((a) => a.id)).size).toBe(LIBRARY_ASSETS.length);
    const families = new Map(LIBRARY_FAMILIES.map((f) => [f.id, f]));
    expect(families.size).toBe(LIBRARY_FAMILIES.length);
    for (const asset of LIBRARY_ASSETS) {
      const family = families.get(asset.family);
      expect(family, asset.id).toBeDefined();
      expect(family?.category, asset.id).toBe(asset.category);
    }
    for (const family of LIBRARY_FAMILIES) {
      expect(
        LIBRARY_ASSETS.some((a) => a.family === family.id),
        family.id,
      ).toBe(true);
      expect(family.label.trim().length).toBeGreaterThan(0);
    }
    // The pack's own labels, not derived ones.
    expect(libraryFamilyLabel("FlyingPests")).toBe("Stirges & bats");
    expect(libraryFamilyLabel("tavern")).toBe("Tavern & inn");
    expect(libraryFamilyLabel("NotAFamily")).toBe("NotAFamily");
    expect(LIBRARY_CATEGORIES.map((c) => c.id)).toEqual(["monster", "civilian"]);
    expect(libraryCategoryLabel("civilian")).toBe("Townsfolk");
  });

  it("civilians carry the townsfolk metadata the search and the name lean on", () => {
    for (const asset of LIBRARY_ASSETS.filter((a) => a.category === "civilian")) {
      expect(asset.race, asset.id).toBeTruthy();
      expect(asset.gender, asset.id).toBeTruthy();
      expect(asset.age, asset.id).toBeTruthy();
      expect(asset.tags?.length ?? 0, asset.id).toBeGreaterThan(0);
      expect(asset.name.startsWith(`${asset.race} `), asset.id).toBe(true);
    }
    expect(libraryAssetById("npcDwarfBlacksmith")?.name).toBe("Dwarf blacksmith");
    expect(libraryAssetById("goblinMage")?.name).toBe("Goblin mage");
  });

  it("names fit the create-npc cap and carry no stray whitespace", () => {
    for (const asset of LIBRARY_ASSETS) {
      expect(asset.name.length, asset.id).toBeGreaterThan(0);
      expect(asset.name.length, asset.id).toBeLessThanOrEqual(50);
      expect(asset.name, asset.id).toBe(asset.name.trim());
    }
  });

  it("every mimic pair is reciprocal: one disguised, one revealed", () => {
    const paired = LIBRARY_ASSETS.filter((a) => a.counterpartId !== undefined);
    expect(paired.length).toBe(10);
    for (const asset of paired) {
      const other = libraryCounterpart(asset);
      expect(other, asset.id).toBeDefined();
      expect(other?.counterpartId, asset.id).toBe(asset.id);
      expect(asset.mimic, asset.id).toBeDefined();
      expect(other?.mimic, asset.id).not.toBe(asset.mimic);
    }
    expect(libraryCounterpart(libraryAssetById("goblinClub"))).toBeUndefined();
    expect(libraryCounterpart(undefined)).toBeUndefined();
  });

  it("resolves a token from its URL: root-relative, absolute, or with a query", () => {
    const club = libraryAssetById("goblinClub");
    expect(club).toBeDefined();
    const url = libraryImageUrl(club!);
    // The pack's own path: HeroByte and the pack's gallery agree on every URL.
    expect(url).toBe("/tokens/NPC/Enemies/Goblins/goblinClub.png");
    expect(libraryAssetByImageUrl(url)).toBe(club);
    expect(libraryAssetByImageUrl(`https://play.example.test${url}?v=2#x`)).toBe(club);
    expect(libraryAssetByImageUrl("https://example.test/goblin.png")).toBeUndefined();
    expect(libraryAssetByImageUrl("/tokens/NPC/Enemies/Goblins/nope.png")).toBeUndefined();
    expect(libraryAssetByImageUrl("")).toBeUndefined();
    expect(libraryAssetByImageUrl(undefined)).toBeUndefined();
  });

  it("search narrows by category, family and every word, and keeps pack order", () => {
    expect(searchLibrary({})).toEqual([...LIBRARY_ASSETS]);
    expect(searchLibrary({ category: "civilian" }).every((a) => a.category === "civilian")).toBe(
      true,
    );
    const mimics = searchLibrary({ family: "Mimics" });
    expect(mimics.length).toBe(10);
    const brutes = searchLibrary({ query: "  club   BRUTE " }).map((a) => a.id);
    expect(brutes).toContain("goblinClub");
    expect(brutes).toContain("banditBrute");
    expect(brutes).not.toContain("goblinMage");
    expect(searchLibrary({ family: "Goblins", query: "mage" }).map((a) => a.id)).toEqual([
      "goblinMage",
    ]);
    // Tags, ancestry and gender are search words too.
    expect(searchLibrary({ query: "drunk" }).every((a) => a.category === "civilian")).toBe(true);
    expect(searchLibrary({ query: "drunk" }).length).toBeGreaterThan(0);
    expect(searchLibrary({ query: "dwarf woman smith" }).map((a) => a.id)).toEqual([
      "npcDwarfBlacksmith",
    ]);
    expect(searchLibrary({ category: "monster", query: "villager" })).toEqual([]);
    expect(searchLibrary({ query: "zzzz" })).toEqual([]);
  });
});
