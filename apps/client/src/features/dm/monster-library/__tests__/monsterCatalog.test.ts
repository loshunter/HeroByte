/**
 * The bundled monster pack: the catalog and the files under public/ are
 * generated together, so what the tests pin is that they still agree — every
 * entry has its PNG at the URL the library will write, no PNG is a stray,
 * and the shape the NPC plumbing relies on (names under the create-npc cap,
 * reciprocal mimic pairs) holds for every entry.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MONSTER_ASSETS,
  MONSTER_FAMILIES,
  MONSTER_TOKEN_ROOT,
  monsterByImageUrl,
  monsterById,
  monsterCounterpart,
  monsterFamilyLabel,
  monsterImageUrl,
  searchMonsters,
} from "../monsterCatalog";

const PUBLIC_ROOT = resolve(__dirname, "../../../../../public/tokens/monsters");
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

describe("the bundled monster catalog", () => {
  it("ships a PNG for every entry, at the URL the library writes", () => {
    for (const asset of MONSTER_ASSETS) {
      const url = monsterImageUrl(asset);
      expect(url.startsWith(`${MONSTER_TOKEN_ROOT}/`)).toBe(true);
      const file = join(PUBLIC_ROOT, url.slice(MONSTER_TOKEN_ROOT.length + 1));
      expect(existsSync(file), `${asset.id} has no file at ${file}`).toBe(true);
      expect(readFileSync(file).subarray(0, 8).equals(PNG_SIGNATURE), asset.id).toBe(true);
    }
  });

  it("has no stray PNG: every file under public/ is a catalog entry", () => {
    const listed = new Set(
      MONSTER_ASSETS.map((asset) => join(PUBLIC_ROOT, asset.family, `${asset.id}.png`)),
    );
    const strays = pngsUnder(PUBLIC_ROOT).filter((file) => !listed.has(file));
    expect(strays).toEqual([]);
    expect(MONSTER_ASSETS.length).toBeGreaterThan(100);
  });

  it("ids are unique and every family is labelled, in both directions", () => {
    expect(new Set(MONSTER_ASSETS.map((a) => a.id)).size).toBe(MONSTER_ASSETS.length);
    const familyIds = new Set(MONSTER_FAMILIES.map((f) => f.id));
    expect(familyIds.size).toBe(MONSTER_FAMILIES.length);
    for (const asset of MONSTER_ASSETS) expect(familyIds.has(asset.family), asset.id).toBe(true);
    for (const family of MONSTER_FAMILIES) {
      expect(
        MONSTER_ASSETS.some((a) => a.family === family.id),
        family.id,
      ).toBe(true);
      expect(family.label.trim().length).toBeGreaterThan(0);
    }
    expect(monsterFamilyLabel("FlyingPests")).toBe("Flying Pests");
    expect(monsterFamilyLabel("NotAFamily")).toBe("NotAFamily");
  });

  it("names fit the create-npc cap and carry no stray whitespace", () => {
    for (const asset of MONSTER_ASSETS) {
      expect(asset.name.length, asset.id).toBeGreaterThan(0);
      expect(asset.name.length, asset.id).toBeLessThanOrEqual(50);
      expect(asset.name, asset.id).toBe(asset.name.trim());
    }
  });

  it("every mimic pair is reciprocal: one disguised, one revealed", () => {
    const paired = MONSTER_ASSETS.filter((a) => a.counterpartId !== undefined);
    expect(paired.length).toBe(10);
    for (const asset of paired) {
      const other = monsterCounterpart(asset);
      expect(other, asset.id).toBeDefined();
      expect(other?.counterpartId, asset.id).toBe(asset.id);
      expect(asset.mimic, asset.id).toBeDefined();
      expect(other?.mimic, asset.id).not.toBe(asset.mimic);
    }
    expect(monsterCounterpart(monsterById("goblinClub"))).toBeUndefined();
    expect(monsterCounterpart(undefined)).toBeUndefined();
  });

  it("resolves a token from its URL: root-relative, absolute, or with a query", () => {
    const club = monsterById("goblinClub");
    expect(club).toBeDefined();
    const url = monsterImageUrl(club!);
    expect(url).toBe("/tokens/monsters/Goblins/goblinClub.png");
    expect(monsterByImageUrl(url)).toBe(club);
    expect(monsterByImageUrl(`https://play.example.test${url}?v=2#x`)).toBe(club);
    expect(monsterByImageUrl("https://example.test/goblin.png")).toBeUndefined();
    expect(monsterByImageUrl("/tokens/monsters/Goblins/nope.png")).toBeUndefined();
    expect(monsterByImageUrl("")).toBeUndefined();
    expect(monsterByImageUrl(undefined)).toBeUndefined();
  });

  it("search narrows by family and by every word, and keeps pack order", () => {
    expect(searchMonsters({})).toEqual([...MONSTER_ASSETS]);
    const mimics = searchMonsters({ family: "Mimics" });
    expect(mimics.length).toBe(10);
    expect(mimics.every((a) => a.family === "Mimics")).toBe(true);
    const brutes = searchMonsters({ query: "  club   BRUTE " }).map((a) => a.id);
    expect(brutes).toContain("goblinClub");
    expect(brutes).toContain("banditBrute");
    expect(brutes).not.toContain("goblinMage");
    expect(searchMonsters({ family: "Goblins", query: "mage" }).map((a) => a.id)).toEqual([
      "goblinMage",
    ]);
    expect(searchMonsters({ query: "disguised" }).map((a) => a.mimic)).toEqual(
      Array(5).fill("disguised"),
    );
    expect(searchMonsters({ query: "zzzz" })).toEqual([]);
  });
});
