// ============================================================================
// TOKEN CATALOG
// ============================================================================
// Lookups over the bundled token pack, and the one shape the picker draws —
// a LibraryItem — for pack entries and for a table's own custom tokens alike.
// The pack's images are static files under apps/client/public/tokens, served
// from the client's own origin, so a token's URL is root-relative and
// survives a session save untouched (the export's asset scan only inlines
// /assets/<hash> uploads). The data and the files are regenerated together
// by scripts/import-token-library.mjs.

import type { CustomToken, NpcDisposition, TokenSize } from "@herobyte/shared";
import {
  LIBRARY_ASSETS,
  LIBRARY_FAMILIES,
  LIBRARY_ID_ALIASES,
  LIBRARY_PACK_VERSION,
} from "./tokenCatalog.generated";
import type { LibraryAsset, LibraryCategory, LibraryMimicState } from "./tokenCatalogTypes";

export { LIBRARY_ASSETS, LIBRARY_FAMILIES, LIBRARY_ID_ALIASES, LIBRARY_PACK_VERSION };
export type {
  LibraryAsset,
  LibraryCategory,
  LibraryFamily,
  LibraryMimicState,
} from "./tokenCatalogTypes";

/** Where the pack is served from; `${root}/${asset.src}` is a token's master. */
export const LIBRARY_TOKEN_ROOT = "/tokens";

export const LIBRARY_CATEGORIES: readonly { id: LibraryCategory; label: string }[] = [
  { id: "monster", label: "Monsters" },
  { id: "civilian", label: "Townsfolk" },
];

/** The 1254px master — what a token on the map draws. */
export function libraryImageUrl(asset: Pick<LibraryAsset, "src">): string {
  return `${LIBRARY_TOKEN_ROOT}/${asset.src}`;
}

/** The 336px render — the portrait. */
export function libraryMediumUrl(asset: Pick<LibraryAsset, "medium">): string {
  return `${LIBRARY_TOKEN_ROOT}/${asset.medium}`;
}

/** The 84px render — the picker's thumbnail, one pixel per pixel-15 cell. */
export function libraryThumbUrl(asset: Pick<LibraryAsset, "thumb">): string {
  return `${LIBRARY_TOKEN_ROOT}/${asset.thumb}`;
}

const byId = new Map(LIBRARY_ASSETS.map((asset) => [asset.id, asset]));
// Every URL a token has ever been served at — all three tiers, plus the master
// paths the pack renamed away from — so a saved session from any pack version
// still resolves to the token it meant.
const byUrl = new Map<string, LibraryAsset>();
for (const asset of LIBRARY_ASSETS) {
  byUrl.set(libraryImageUrl(asset), asset);
  byUrl.set(libraryMediumUrl(asset), asset);
  byUrl.set(libraryThumbUrl(asset), asset);
  for (const legacy of asset.legacySrcs ?? []) byUrl.set(`${LIBRARY_TOKEN_ROOT}/${legacy}`, asset);
}
const familyLabels = new Map(LIBRARY_FAMILIES.map((family) => [family.id, family.label]));
const categoryLabels = new Map(LIBRARY_CATEGORIES.map((c) => [c.id, c.label]));

/** By current id, or by an id the pack has since renamed. */
export function libraryAssetById(id: string): LibraryAsset | undefined {
  return byId.get(id) ?? byId.get(LIBRARY_ID_ALIASES[id] ?? "");
}

/**
 * The pack token behind an image URL, if it is one — any tier, any pack
 * version. The library writes the root-relative form; an absolute same-origin
 * form (a URL a DM copied out of the address bar, say) resolves too, since the
 * path is what identifies it.
 */
export function libraryAssetByImageUrl(url: string | null | undefined): LibraryAsset | undefined {
  if (!url) return undefined;
  const direct = byUrl.get(url);
  if (direct) return direct;
  const start = url.indexOf(`${LIBRARY_TOKEN_ROOT}/`);
  if (start < 0) return undefined;
  const path = url.slice(start).split(/[?#]/, 1)[0] ?? "";
  return byUrl.get(path);
}

/** The other half of a mimic pair; undefined for everything else. */
export function libraryCounterpart(asset: LibraryAsset | undefined): LibraryAsset | undefined {
  return asset?.counterpartId ? byId.get(asset.counterpartId) : undefined;
}

export function libraryFamilyLabel(familyId: string): string {
  return familyLabels.get(familyId) ?? familyId;
}

export function libraryCategoryLabel(category: LibraryCategory): string {
  return categoryLabels.get(category) ?? category;
}

// ----------------------------------------------------------------------------
// LibraryItem — what the picker draws and what a pick hands up
// ----------------------------------------------------------------------------

export interface LibraryItem {
  id: string;
  name: string;
  category: LibraryCategory | "custom";
  /** What a placed token draws. */
  imageUrl: string;
  /** What the NPC card and the Entities panel show. */
  portraitUrl: string;
  /** What the picker's grid draws. */
  thumbUrl: string;
  /** The footprint a placed token is born with. */
  size: TokenSize;
  /** A mimic pair's half, when this is one: "disguised" or "revealed". */
  mimic?: LibraryMimicState;
  /**
   * Where an NPC made from this token stands with the party. Absent = hostile,
   * which is what every NPC in the pack is except the townsfolk.
   */
  disposition?: NpcDisposition;
  description?: string;
  /** True for the table's own tokens — the picker marks these apart from pack art. */
  custom: boolean;
}

export function packItem(asset: LibraryAsset): LibraryItem {
  return {
    id: asset.id,
    name: asset.name,
    category: asset.category,
    imageUrl: libraryImageUrl(asset),
    portraitUrl: libraryMediumUrl(asset),
    thumbUrl: libraryThumbUrl(asset),
    size: asset.size,
    ...(asset.mimic ? { mimic: asset.mimic } : {}),
    // The pack tags all 60 townsfolk `role: "civilian"`; every other role is a
    // creature the party is meant to fight, so absent (hostile) is right for it.
    ...(asset.role === "civilian" ? { disposition: "neutral" as const } : {}),
    description: asset.description,
    custom: false,
  };
}

/**
 * A table's own token. The map draws the full picture; the grid draws the
 * 84px render made when it was added, and the portrait the full picture.
 *
 * A PASTED PACK PATH is the exception, and it was G1's own defect surviving
 * on that road: prepareCustomImage deliberately makes no thumb for pack art
 * ("it already ships three tiers"), so the shelf entry stored no thumbUrl,
 * this fell back to imageUrl, and the grid decoded the 1254px master in that
 * cell — precisely the cost G1 exists to remove. Now the path is resolved to
 * its pack asset (the URL index is keyed on all three tiers, so a pasted
 * master, Medium or Thumbs path all hit) and the entry draws the pack's own
 * 84px and 336px renders, exactly as packItem does for the same asset. Done
 * here rather than at add time so entries already on a shelf are healed on
 * their next render, with nothing to migrate. Anything that is not pack art
 * keeps the old fallback: the full picture, for a token added before thumbs
 * existed or one whose thumb could not be made.
 */
export function customItem(token: CustomToken): LibraryItem {
  const pack = libraryAssetByImageUrl(token.imageUrl);
  return {
    id: token.id,
    name: token.name,
    category: "custom",
    imageUrl: token.imageUrl,
    portraitUrl: pack ? libraryMediumUrl(pack) : token.imageUrl,
    thumbUrl: token.thumbUrl ?? (pack ? libraryThumbUrl(pack) : token.imageUrl),
    size: token.size,
    ...(token.disposition ? { disposition: token.disposition } : {}),
    description: token.description,
    custom: true,
  };
}

// ----------------------------------------------------------------------------
// Search
// ----------------------------------------------------------------------------

export interface LibrarySearch {
  /** A category, or empty for both. */
  category?: LibraryCategory | "";
  /** A family id, or empty for every family. */
  family?: string;
  /** Free text; every whitespace-separated word must match. */
  query?: string;
}

const searchText = new Map(
  LIBRARY_ASSETS.map((asset) => [
    asset.id,
    [
      asset.name,
      asset.title,
      asset.id,
      libraryFamilyLabel(asset.family),
      libraryCategoryLabel(asset.category),
      asset.size,
      asset.creatureType ?? "",
      asset.role ?? "",
      asset.description ?? "",
      asset.race ?? "",
      asset.gender ?? "",
      asset.age ?? "",
      asset.mimic ?? "",
      ...(asset.tags ?? []),
      ...(asset.setting ?? []),
    ]
      .join(" ")
      .toLowerCase(),
  ]),
);

const words = (query: string) => query.toLowerCase().split(/\s+/).filter(Boolean);

/** Pack order is kept: families as the pack lists them, tokens likewise. */
export function searchLibrary({ category = "", family = "", query = "" }: LibrarySearch) {
  const needles = words(query);
  return LIBRARY_ASSETS.filter((asset) => {
    if (category && asset.category !== category) return false;
    if (family && asset.family !== family) return false;
    const text = searchText.get(asset.id) ?? "";
    return needles.every((word) => text.includes(word));
  });
}

/** The same word rule over a table's own tokens: name, blurb, tags and size. */
export function searchCustomTokens(tokens: readonly CustomToken[], query = ""): CustomToken[] {
  const needles = words(query);
  return tokens.filter((token) => {
    const text = [token.name, token.description ?? "", token.size, "custom", ...token.tags]
      .join(" ")
      .toLowerCase();
    return needles.every((word) => text.includes(word));
  });
}
