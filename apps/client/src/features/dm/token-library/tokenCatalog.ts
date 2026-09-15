// ============================================================================
// TOKEN CATALOG
// ============================================================================
// Lookups over the bundled token pack. The images are static files under
// apps/client/public/tokens — served from the client's own origin, so a
// token's URL is root-relative and survives a session save untouched (the
// export's asset scan only inlines /assets/<hash> uploads). The data and the
// files are regenerated together by scripts/import-token-library.mjs.

import { LIBRARY_ASSETS, LIBRARY_FAMILIES } from "./tokenCatalog.generated";
import type { LibraryAsset, LibraryCategory } from "./tokenCatalogTypes";

export { LIBRARY_ASSETS, LIBRARY_FAMILIES };
export type {
  LibraryAsset,
  LibraryCategory,
  LibraryFamily,
  LibraryMimicState,
} from "./tokenCatalogTypes";

/** Where the pack is served from; `${root}/${asset.src}` is a token. */
export const LIBRARY_TOKEN_ROOT = "/tokens";

export const LIBRARY_CATEGORIES: readonly { id: LibraryCategory; label: string }[] = [
  { id: "monster", label: "Monsters" },
  { id: "civilian", label: "Townsfolk" },
];

export function libraryImageUrl(asset: Pick<LibraryAsset, "src">): string {
  return `${LIBRARY_TOKEN_ROOT}/${asset.src}`;
}

const byId = new Map(LIBRARY_ASSETS.map((asset) => [asset.id, asset]));
const byUrl = new Map(LIBRARY_ASSETS.map((asset) => [libraryImageUrl(asset), asset]));
const familyLabels = new Map(LIBRARY_FAMILIES.map((family) => [family.id, family.label]));
const categoryLabels = new Map(LIBRARY_CATEGORIES.map((c) => [c.id, c.label]));

export function libraryAssetById(id: string): LibraryAsset | undefined {
  return byId.get(id);
}

/**
 * The pack token behind an image URL, if it is one. The library writes the
 * root-relative form; an absolute same-origin form (a URL a DM copied out of
 * the address bar, say) resolves too, since the path is what identifies it.
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

/** Pack order is kept: families as the pack lists them, tokens likewise. */
export function searchLibrary({ category = "", family = "", query = "" }: LibrarySearch) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return LIBRARY_ASSETS.filter((asset) => {
    if (category && asset.category !== category) return false;
    if (family && asset.family !== family) return false;
    const text = searchText.get(asset.id) ?? "";
    return words.every((word) => text.includes(word));
  });
}
