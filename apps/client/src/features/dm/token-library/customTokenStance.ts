// ============================================================================
// CUSTOM TOKEN STANCE
// ============================================================================
// What a kind chip implies about where a token stands with the party, so the
// common case needs no second decision from the DM: a monster is something to
// fight, an ally is on your side, and everything else — a villager, a
// traveler, a wagon — is neither.
//
// Its own module, and not just to keep CustomTokenForm under the 350-line
// guard: this is a rule with a right answer, and a rule with a right answer
// is worth a test that does not have to render a form to reach it.

import type { NpcDisposition } from "@herobyte/shared";

/**
 * Only the KIND row moves the stance. The ancestry row says nothing about
 * whose side an elf is on, and neither does a word the DM typed that is not
 * one of these.
 */
const KIND_STANCES: Record<string, NpcDisposition> = {
  monster: "hostile",
  boss: "hostile",
  ally: "friendly",
  npc: "neutral",
  traveler: "neutral",
  villager: "neutral",
  prop: "neutral",
};

/**
 * The stance these tags imply, or undefined when none of them say anything.
 * The LAST one that speaks wins, so "monster" then "ally" ends on Ally — the
 * order the DM clicked them in is the order they read in.
 */
export function impliedStance(tags: readonly string[]): NpcDisposition | undefined {
  let implied: NpcDisposition | undefined;
  for (const tag of tags) implied = KIND_STANCES[tag] ?? implied;
  return implied;
}
