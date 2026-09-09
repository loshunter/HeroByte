/**
 * When a movement budget starts over. A character's counters reset when
 * THEIR turn begins (next-turn / previous-turn landing on them), and every
 * character's reset when combat starts or ends — so a budget never carries
 * from one fight into the next, and never ticks outside one.
 */

import type { Character } from "@herobyte/shared";
import type { RoomState } from "../../domains/room/model.js";

export function resetMovementBudget(character: Character | undefined): void {
  if (!character) return;
  character.movementUsed = 0;
  character.movementDiagonals = 0;
}

export function resetAllMovementBudgets(state: RoomState): void {
  for (const character of state.characters) resetMovementBudget(character);
}
