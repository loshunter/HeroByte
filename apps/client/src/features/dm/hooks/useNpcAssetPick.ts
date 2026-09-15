/**
 * What a library pick means for an NPC that already exists.
 *
 * The portrait comes along when there is nothing to lose: an empty portrait,
 * or one the library set earlier (so a mimic's flip changes both faces). A
 * portrait the DM chose themselves is theirs and stays.
 *
 * Lifted out of NPCEditor, which sits a handful of lines under the 350-line
 * guard — the rule is worth a test of its own anyway, and NPCEditor was the
 * only place it could be reached from.
 *
 * @module features/dm/hooks/useNpcAssetPick
 */

import { libraryAssetByImageUrl, type LibraryItem } from "../token-library/tokenCatalog";

/** The fields a pick changes; `portrait` absent means "leave the DM's alone". */
export interface NpcAssetPick {
  tokenImage: string;
  portrait?: string;
}

export function useNpcAssetPick(
  currentPortrait: string,
  apply: (next: NpcAssetPick) => void,
): (item: LibraryItem) => void {
  return (item) => {
    const follows =
      currentPortrait.trim() === "" || libraryAssetByImageUrl(currentPortrait) !== undefined;
    apply({ tokenImage: item.imageUrl, ...(follows ? { portrait: item.portraitUrl } : {}) });
  };
}
