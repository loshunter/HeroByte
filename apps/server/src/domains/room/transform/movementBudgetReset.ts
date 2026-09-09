/**
 * When a movement budget starts over. A character's counters reset when
 * THEIR turn begins (next-turn / previous-turn landing on them, or the turn
 * an auto-started fight opens on), and every character's reset when combat
 * starts or ends — on EVERY road combat starts by (the explicit button, the
 * first initiative value, a travel that suspends or resumes a fight) — so a
 * budget never carries from one fight into the next, and never ticks
 * outside one. A travel is not a turn boundary: the party arrives fresh.
 */

import { resetMovementBudget } from "@herobyte/shared";
import type { RoomState } from "../model.js";

export { resetMovementBudget };

export function resetAllMovementBudgets(state: RoomState): void {
  for (const character of state.characters) resetMovementBudget(character);
}
