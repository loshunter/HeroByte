// ============================================================================
// NPC DISPOSITION — how a stance looks on a card
// ============================================================================
// The Entities panel called every NPC an Enemy, in a red card, because until
// the token pack arrived every NPC was one. Sixty townsfolk and a shelf of the
// table's own tokens later, a baker and a hired guard were reading as things
// to kill. One map, in its own module so NpcCard stays under the 350-line
// guard, and so the three palettes sit side by side where they can be judged
// against each other rather than three screens apart.
//
// Absent is deliberately not a key: `character.disposition ?? "hostile"` is
// the one place the default is written down.

import type { NpcDisposition } from "@herobyte/shared";

export interface DispositionLook {
  /** What the card's role line reads. */
  label: string;
  /** The portrait ring, and the token colour the card passes down. */
  ring: string;
  /** The card's background wash. */
  tint: string;
  /** Its outer glow. */
  glow: string;
}

export const NPC_DISPOSITION_LOOKS: Record<NpcDisposition, DispositionLook> = {
  // The shipped red, unchanged: an existing NPC must look exactly as it did.
  hostile: {
    label: "Enemy",
    ring: "#D63C53",
    tint: "rgba(40, 9, 15, 0.9)",
    glow: "rgba(214, 60, 83, 0.45)",
  },
  neutral: {
    label: "Neutral",
    ring: "#C9A24E",
    tint: "rgba(38, 30, 12, 0.9)",
    glow: "rgba(201, 162, 78, 0.35)",
  },
  friendly: {
    label: "Ally",
    ring: "#3FBF6F",
    tint: "rgba(9, 36, 20, 0.9)",
    glow: "rgba(63, 191, 111, 0.35)",
  },
};

/**
 * The look for a character's stance; absent means hostile, as it always did.
 *
 * TOTAL on purpose, including for a value the type says cannot exist. This is
 * read during render from a snapshot field, and a snapshot can carry whatever
 * a session file carried — `Record<Union, T>` indexing is a runtime
 * `undefined` the moment the value comes off a wire. There is no ErrorBoundary
 * between the Entities panel and the root, so a throw here replaces the whole
 * table for every client at it, not just the one that loaded the file.
 */
export function npcDispositionLook(disposition: NpcDisposition | undefined): DispositionLook {
  return NPC_DISPOSITION_LOOKS[disposition as NpcDisposition] ?? NPC_DISPOSITION_LOOKS.hostile;
}
