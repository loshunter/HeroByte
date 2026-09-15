// ============================================================================
// MONSTER CATALOG
// ============================================================================
// Lookups over the bundled token pack. The images are static files under
// apps/client/public/tokens/monsters — served from the client's own origin, so
// a token's URL is root-relative and survives a session save untouched (the
// export's asset scan only inlines /assets/<hash> uploads). The data and the
// files are regenerated together by scripts/import-monster-library.mjs.

import { MONSTER_ASSETS, MONSTER_FAMILIES } from "./monsterCatalog.generated";
import type { MonsterAsset } from "./monsterCatalogTypes";

export { MONSTER_ASSETS, MONSTER_FAMILIES };
export type { MonsterAsset, MonsterFamily, MonsterMimicState } from "./monsterCatalogTypes";

/** Where the pack is served from; `${root}/<Family>/<id>.png` is a token. */
export const MONSTER_TOKEN_ROOT = "/tokens/monsters";

export function monsterImageUrl(asset: Pick<MonsterAsset, "id" | "family">): string {
  return `${MONSTER_TOKEN_ROOT}/${asset.family}/${asset.id}.png`;
}

const byId = new Map(MONSTER_ASSETS.map((asset) => [asset.id, asset]));
const byUrl = new Map(MONSTER_ASSETS.map((asset) => [monsterImageUrl(asset), asset]));
const familyLabels = new Map(MONSTER_FAMILIES.map((family) => [family.id, family.label]));

export function monsterById(id: string): MonsterAsset | undefined {
  return byId.get(id);
}

/**
 * The pack token behind an image URL, if it is one. The library writes the
 * root-relative form; an absolute same-origin form (a URL a DM copied out of
 * the address bar, say) resolves too, since the path is what identifies it.
 */
export function monsterByImageUrl(url: string | null | undefined): MonsterAsset | undefined {
  if (!url) return undefined;
  const direct = byUrl.get(url);
  if (direct) return direct;
  const start = url.indexOf(`${MONSTER_TOKEN_ROOT}/`);
  if (start < 0) return undefined;
  const path = url.slice(start).split(/[?#]/, 1)[0] ?? "";
  return byUrl.get(path);
}

/** The other half of a mimic pair; undefined for everything else. */
export function monsterCounterpart(asset: MonsterAsset | undefined): MonsterAsset | undefined {
  return asset?.counterpartId ? byId.get(asset.counterpartId) : undefined;
}

export function monsterFamilyLabel(familyId: string): string {
  return familyLabels.get(familyId) ?? familyId;
}

export interface MonsterSearch {
  /** A family id, or empty for every family. */
  family?: string;
  /** Free text; every whitespace-separated word must match. */
  query?: string;
}

const searchText = new Map(
  MONSTER_ASSETS.map((asset) => [
    asset.id,
    [asset.name, asset.title, asset.id, monsterFamilyLabel(asset.family), asset.mimic ?? ""]
      .join(" ")
      .toLowerCase(),
  ]),
);

/** Pack order is kept: families in roadmap order, tokens as the pack lists them. */
export function searchMonsters({ family = "", query = "" }: MonsterSearch): MonsterAsset[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return MONSTER_ASSETS.filter((asset) => {
    if (family && asset.family !== family) return false;
    const text = searchText.get(asset.id) ?? "";
    return words.every((word) => text.includes(word));
  });
}
