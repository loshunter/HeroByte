// ============================================================================
// TOKEN CATALOG TYPES
// ============================================================================
// The shape of the bundled token pack (tokenCatalog.generated.ts). Kept in its
// own module so the generated data and the accessors can both import it
// without importing each other.

import type { TokenSize } from "@herobyte/shared";

/** The pack's two halves: the bestiary, and the townsfolk. */
export type LibraryCategory = "monster" | "civilian";

/** A mimic pair has one of each; every other token has neither. */
export type LibraryMimicState = "disguised" | "revealed";

export interface LibraryFamily {
  /** The id every asset's `family` names ("Goblins", "tavern"). */
  id: string;
  /** What the library shows — the pack's own label ("Stirges & bats"). */
  label: string;
  category: LibraryCategory;
}

export interface LibraryAsset {
  /** Stable id, the pack's own. */
  id: string;
  category: LibraryCategory;
  /** A LIBRARY_FAMILIES id. */
  family: string;
  /**
   * The 1254px master's path under /tokens — the pack's own path minus its
   * `Pixel15/` prefix ("NPC/Enemies/Goblins/goblinClub.png"), so HeroByte and
   * the pack's gallery agree on every URL. Drawn on the map.
   */
  src: string;
  /** The 336px render, same origin and scale; the portrait. */
  medium: string;
  /** The 84px render — one pixel per pixel-15 cell; the picker's thumbnail. */
  thumb: string;
  /** The pack's title, relative to the family ("Mage") or the trade ("Baker"). */
  title: string;
  /**
   * Table-ready NPC name ("Goblin mage", "Dwarf blacksmith"), the pack's own,
   * at most 50 characters — the create-npc cap, which refuses a longer name
   * rather than trimming it.
   */
  name: string;
  /** The footprint a placed token starts with; the token's own size is editable after. */
  size: TokenSize;
  /** "humanoid", "undead", "fey"… — a search word and nothing more, today. */
  creatureType?: string;
  /** "melee", "caster", "leader", "civilian", "disguise"… — likewise. */
  role?: string;
  /** The pack's design blurb; searchable, shown as the thumbnail's tooltip. */
  description?: string;
  /** Free search words the pack attached ("townsfolk", "drunk", "kid"). */
  tags?: readonly string[];
  race?: string;
  gender?: string;
  age?: string;
  setting?: readonly string[];
  mimic?: LibraryMimicState;
  /** The other state of a mimic pair: a disguise's reveal, a reveal's disguise. */
  counterpartId?: string;
  /** Ids this token used to have; a saved reference to one resolves here. */
  legacyIds?: readonly string[];
  /** Master paths (under /tokens) this token used to be served at. */
  legacySrcs?: readonly string[];
}
