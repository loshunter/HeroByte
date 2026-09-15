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

import type { NpcDisposition } from "@herobyte/shared";
import { libraryAssetByImageUrl, type LibraryItem } from "../token-library/tokenCatalog";

/** The fields a pick changes; `portrait` absent means "leave the DM's alone". */
export interface NpcAssetPick {
  tokenImage: string;
  portrait?: string;
  disposition?: NpcDisposition;
}

/**
 * The STANCE, on the other hand, is the DM's on an existing NPC — re-skinning
 * an ogre with the baker's art does not make it friendly — with exactly one
 * exception: revealing a mimic. The guide tells DMs to set the closed chest
 * Neutral so the party sees a harmless prop, and 🎭 REVEAL MIMIC is the moment
 * that lie ends. Without this the chest grows teeth and its card still reads
 * Neutral in gold, which is the one panel the players are actually reading.
 */
export function useNpcAssetPick(
  currentPortrait: string,
  apply: (next: NpcAssetPick) => void,
): (item: LibraryItem) => void {
  return (item) => {
    const follows =
      currentPortrait.trim() === "" || libraryAssetByImageUrl(currentPortrait) !== undefined;
    apply({
      tokenImage: item.imageUrl,
      ...(follows ? { portrait: item.portraitUrl } : {}),
      ...(item.mimic === "revealed" ? { disposition: "hostile" as const } : {}),
    });
  };
}
