// ============================================================================
// MONSTER CATALOG TYPES
// ============================================================================
// The shape of the bundled token pack (monsterCatalog.generated.ts). Kept in
// its own module so the generated data and the accessors can both import it
// without importing each other.

/** A mimic pair has one of each; every other token has neither. */
export type MonsterMimicState = "disguised" | "revealed";

export interface MonsterFamily {
  /** The folder under /tokens/monsters and the id every asset's `family` names. */
  id: string;
  /** What the library shows ("Flying Pests" for FlyingPests). */
  label: string;
}

export interface MonsterAsset {
  /** Stable id; also the PNG's filename inside its family folder. */
  id: string;
  /** A MONSTER_FAMILIES id. */
  family: string;
  /** The pack's role title, relative to the family ("Mage", "Club brute"). */
  title: string;
  /**
   * Table-ready NPC name ("Goblin mage"), at most 50 characters — the
   * create-npc cap, which refuses a longer name rather than trimming it.
   */
  name: string;
  mimic?: MonsterMimicState;
  /** The other state of a mimic pair: a disguise's reveal, a reveal's disguise. */
  counterpartId?: string;
}
