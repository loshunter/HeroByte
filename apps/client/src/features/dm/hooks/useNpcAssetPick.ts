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
 * exception: a mimic, which is the one pair of library entries that IS a lie
 * about whose side something is on.
 *
 * Both directions, because the guide promises both. It tells DMs to set the
 * closed chest Neutral so the party sees a harmless prop; 🎭 REVEAL MIMIC is
 * the moment that lie ends, and without the hostile stamp the chest grows
 * teeth while its card still reads Neutral in gold — the one panel the
 * players are actually reading. 🎭 DISGUISE is the same promise run
 * backwards, and it was one-way: the art went back to a closed chest and the
 * card stayed Enemy in red, which is the exact tell the Neutral instruction
 * exists to suppress, on a workflow the guide walks the DM straight into.
 */
const MIMIC_STANCE = { revealed: "hostile", disguised: "neutral" } as const;

export function useNpcAssetPick(
  currentPortrait: string,
  apply: (next: NpcAssetPick) => void,
): (item: LibraryItem) => void {
  return (item) => {
    const follows =
      currentPortrait.trim() === "" || libraryAssetByImageUrl(currentPortrait) !== undefined;
    const stance = item.mimic ? MIMIC_STANCE[item.mimic] : undefined;
    apply({
      tokenImage: item.imageUrl,
      ...(follows ? { portrait: item.portraitUrl } : {}),
      ...(stance ? { disposition: stance } : {}),
    });
  };
}
