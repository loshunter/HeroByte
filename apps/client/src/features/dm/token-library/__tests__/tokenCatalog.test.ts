/**
 * The bundled token pack: the catalog and the files under public/ are
 * generated together, so what the tests pin is that they still agree — every
 * entry has its three PNGs at the URLs the library writes, no PNG is a stray,
 * and the shape the NPC plumbing relies on (names under the create-npc cap, a
 * size on the ladder, reciprocal mimic pairs, a category per family, ids the
 * pack renamed still resolving) holds for every entry.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LIBRARY_ASSETS,
  LIBRARY_CATEGORIES,
  LIBRARY_FAMILIES,
  LIBRARY_ID_ALIASES,
  LIBRARY_PACK_VERSION,
  LIBRARY_TOKEN_ROOT,
  libraryAssetById,
  libraryAssetByImageUrl,
  libraryCategoryLabel,
  libraryCounterpart,
  libraryFamilyLabel,
  libraryImageUrl,
  libraryMediumUrl,
  libraryThumbUrl,
  searchLibrary,
} from "../tokenCatalog";

const PUBLIC_ROOT = resolve(__dirname, "../../../../../public/tokens");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const TOKEN_SIZES = ["tiny", "small", "medium", "large", "huge", "gargantuan"];

function pngsUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...pngsUnder(full));
    else if (entry.endsWith(".png")) out.push(full);
  }
  return out;
}

function pngEdge(file: string): number {
  const bytes = readFileSync(file);
  expect(bytes.subarray(0, 8).equals(PNG_SIGNATURE), file).toBe(true);
  expect(bytes.readUInt32BE(16), file).toBe(bytes.readUInt32BE(20));
  return bytes.readUInt32BE(16);
}

const fileOf = (path: string) => join(PUBLIC_ROOT, ...path.split("/"));

describe("the bundled token catalog", () => {
  it("is a versioned pack", () => {
    expect(LIBRARY_PACK_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("ships all three tiers for every entry, at the URLs the library writes", () => {
    for (const asset of LIBRARY_ASSETS) {
      for (const [url, path, edge] of [
        [libraryImageUrl(asset), asset.src, 1254],
        [libraryMediumUrl(asset), asset.medium, 336],
        [libraryThumbUrl(asset), asset.thumb, 84],
      ] as const) {
        expect(url).toBe(`${LIBRARY_TOKEN_ROOT}/${path}`);
        const file = fileOf(path);
        expect(existsSync(file), `${asset.id} has no file at ${file}`).toBe(true);
        expect(pngEdge(file), `${asset.id} ${path}`).toBe(edge);
      }
    }
  });

  it("has no stray PNG: every file under public/ belongs to a catalog entry", () => {
    const listed = new Set(
      LIBRARY_ASSETS.flatMap((a) => [fileOf(a.src), fileOf(a.medium), fileOf(a.thumb)]),
    );
    const strays = pngsUnder(PUBLIC_ROOT).filter((file) => !listed.has(file));
    expect(strays).toEqual([]);
    expect(listed.size).toBe(LIBRARY_ASSETS.length * 3);
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

  it("every entry has a name under the create-npc cap and a size on the ladder", () => {
    for (const asset of LIBRARY_ASSETS) {
      expect(asset.name.length, asset.id).toBeGreaterThan(0);
      expect(asset.name.length, asset.id).toBeLessThanOrEqual(50);
      expect(asset.name, asset.id).toBe(asset.name.trim());
      expect(TOKEN_SIZES, asset.id).toContain(asset.size);
    }
    expect(new Set(LIBRARY_ASSETS.map((a) => a.name)).size).toBe(LIBRARY_ASSETS.length);
    // The pack's own names and sizes, spot-checked.
    expect(libraryAssetById("goblinMage")?.name).toBe("Goblin mage");
    expect(libraryAssetById("npcDwarfBlacksmith")?.name).toBe("Dwarf blacksmith");
    expect(libraryAssetById("ogreChieftain")?.size).toBe("large");
    expect(libraryAssetById("goblinClub")?.size).toBe("small");
    expect(libraryAssetById("elementalFireGreater")?.size).toBe("huge");
  });

  it("civilians carry the townsfolk metadata the search leans on", () => {
    for (const asset of LIBRARY_ASSETS.filter((a) => a.category === "civilian")) {
      expect(asset.race, asset.id).toBeTruthy();
      expect(asset.gender, asset.id).toBeTruthy();
      expect(asset.age, asset.id).toBeTruthy();
      expect(asset.tags?.length ?? 0, asset.id).toBeGreaterThan(0);
    }
    // Monsters carry a creature type and a role since pack 1.0.0.
    for (const asset of LIBRARY_ASSETS.filter((a) => a.category === "monster")) {
      expect(asset.creatureType, asset.id).toBeTruthy();
      expect(asset.role, asset.id).toBeTruthy();
    }
  });

  it("every mimic pair is reciprocal, one disguised and one revealed, at one size", () => {
    const paired = LIBRARY_ASSETS.filter((a) => a.counterpartId !== undefined);
    expect(paired.length).toBe(10);
    for (const asset of paired) {
      const other = libraryCounterpart(asset);
      expect(other, asset.id).toBeDefined();
      expect(other?.counterpartId, asset.id).toBe(asset.id);
      expect(asset.mimic, asset.id).toBeDefined();
      expect(other?.mimic, asset.id).not.toBe(asset.mimic);
      // A reveal that changed the footprint would move the token under the party.
      expect(other?.size, asset.id).toBe(asset.size);
    }
    expect(libraryCounterpart(libraryAssetById("goblinClub"))).toBeUndefined();
    expect(libraryCounterpart(undefined)).toBeUndefined();
  });

  it("an id the pack renamed still resolves, by alias and by its old URL", () => {
    expect(Object.keys(LIBRARY_ID_ALIASES).length).toBeGreaterThan(0);
    for (const [legacy, current] of Object.entries(LIBRARY_ID_ALIASES)) {
      const asset = libraryAssetById(current);
      expect(asset, legacy).toBeDefined();
      expect(libraryAssetById(legacy), legacy).toBe(asset);
      expect(
        LIBRARY_ASSETS.some((a) => a.id === legacy),
        legacy,
      ).toBe(false);
    }
    const scimitar = libraryAssetById("goblinScimatar");
    expect(scimitar?.id).toBe("goblinScimitar");
    expect(
      libraryAssetByImageUrl("/tokens/NPC/Enemies/Goblins/goblinScimatar.png"),
      "legacy master path",
    ).toBe(scimitar);
    expect(libraryAssetById("nope")).toBeUndefined();
  });

  it("resolves a token from any tier's URL: root-relative, absolute, or with a query", () => {
    const club = libraryAssetById("goblinClub");
    expect(club).toBeDefined();
    const url = libraryImageUrl(club!);
    // The pack's own path: HeroByte and the pack's gallery agree on every URL.
    expect(url).toBe("/tokens/NPC/Enemies/Goblins/goblinClub.png");
    expect(libraryAssetByImageUrl(url)).toBe(club);
    expect(libraryAssetByImageUrl(libraryMediumUrl(club!))).toBe(club);
    expect(libraryAssetByImageUrl(libraryThumbUrl(club!))).toBe(club);
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
    expect(searchLibrary({ family: "Mimics" }).length).toBe(10);
    const brutes = searchLibrary({ query: "  club   BRUTE " }).map((a) => a.id);
    expect(brutes).toContain("goblinClub");
    expect(brutes).toContain("banditBrute");
    expect(brutes).not.toContain("goblinMage");
    expect(searchLibrary({ family: "Goblins", query: "mage" }).map((a) => a.id)).toEqual([
      "goblinMage",
    ]);
    // Tags, ancestry, gender, creature type and size are search words too.
    expect(searchLibrary({ query: "drunk" }).every((a) => a.category === "civilian")).toBe(true);
    expect(searchLibrary({ query: "drunk" }).length).toBeGreaterThan(0);
    expect(searchLibrary({ query: "dwarf woman smith" }).map((a) => a.id)).toEqual([
      "npcDwarfBlacksmith",
    ]);
    const undead = searchLibrary({ query: "undead" });
    expect(undead.length).toBeGreaterThan(20);
    expect(undead.every((a) => a.creatureType === "undead")).toBe(true);
    expect(searchLibrary({ query: "huge elemental" }).map((a) => a.id)).toContain(
      "elementalFireGreater",
    );
    expect(searchLibrary({ category: "monster", query: "villager" })).toEqual([]);
    expect(searchLibrary({ query: "zzzz" })).toEqual([]);
  });
});
