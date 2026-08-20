// ============================================================================
// DICE ROLLER TYPES
// ============================================================================
// Two shapes live here, and the split matters: `Build` is what the roller's
// UI holds while you are ASSEMBLING a roll, and `RollResult` is a SETTLED roll
// that came back from the server. Nothing turns one into the other on this
// side — the client sends a formula and the server sends back the numbers
// (S5). Before that, `rollBuild` did the conversion here and the server stored
// whatever it was handed (arc defect D2).

import type { DiceRollMode, DiceVisibility, DieType } from "@herobyte/shared";

// Re-exported rather than redeclared: the die list is the roller's contract
// with the server's parser, and two copies of it would eventually disagree.
export type { DieType, DiceRollMode, DiceVisibility };

export type Token =
  | { kind: "die"; die: DieType; qty: number; id: string }
  | { kind: "mod"; value: number; id: string };

export type Build = Token[];

/**
 * A settled roll, exactly as the server recorded it.
 *
 * `perDie` is in formula order and carries its own die/quantity information,
 * so nothing here needs the `Build` that produced it. It used to, positionally
 * — which is why every roll read back from history rendered with no breakdown
 * at all: history entries have no tokens.
 */
export type RollResult = {
  id: string;
  /** Who rolled it. Bound by the server from the connection. */
  playerUid?: string;
  /** Canonical notation the server rolled, e.g. "2d20 + 5". */
  formula: string;
  /**
   * What the roll was FOR, when it was not a bare `/roll` — e.g. "Goblin A —
   * initiative". Server-set; absent on an ordinary dice roll.
   *
   * `playerUid`/`playerName` answer "who rolled", which for initiative is not
   * the interesting question: a DM rolling five goblins would otherwise get
   * five identical rows under their own name.
   */
  label?: string;
  perDie: {
    tokenId: string;
    die?: DieType;
    rolls?: number[];
    /** Under advantage/disadvantage, the set that was thrown away. */
    dropped?: number[];
    subtotal: number;
  }[];
  total: number;
  mode?: DiceRollMode;
  visibility?: DiceVisibility;
  timestamp: number;
};

export const DIE_COLORS: Record<DieType, string> = {
  d4: "#FF6B6B", // Red
  d6: "#4ECDC4", // Cyan
  d8: "#95E1D3", // Mint
  d10: "#FFD93D", // Yellow
  d12: "#A8E6CF", // Light green
  d20: "#447DF7", // HeroByte blue
  d100: "#F3C64E", // HeroByte gold
};

export const DIE_SYMBOLS: Record<DieType, string> = {
  d4: "▲",
  d6: "⬢",
  d8: "◆",
  d10: "⬟",
  d12: "⬣",
  d20: "◉",
  d100: "%",
};
