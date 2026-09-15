// ============================================================================
// TOKEN CATALOG TYPES
// ============================================================================
// The shape of the bundled token pack (tokenCatalog.generated.ts). Kept in its
// own module so the generated data and the accessors can both import it
// without importing each other.

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
   * The image's path under /tokens — the pack's own path minus its `Pixel15/`
   * prefix ("NPC/Enemies/Goblins/goblinClub.png"), so HeroByte and the pack's
   * gallery agree on every URL.
   */
  src: string;
  /** The pack's title, relative to the family ("Mage") or the trade ("Baker"). */
  title: string;
  /**
   * Table-ready NPC name ("Goblin mage", "Dwarf blacksmith"), at most 50
   * characters — the create-npc cap, which refuses a longer name rather than
   * trimming it.
   */
  name: string;
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
}
