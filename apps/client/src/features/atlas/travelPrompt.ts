// ============================================================================
// TRAVEL PROMPT — what Travel here says it does to the scene on the table
// ============================================================================
// The server suspends the outgoing scene under its own map, but only when that
// map is still in the library; a scene whose map was deleted is erased, and a
// table with no map at all has nothing to suspend (its pieces stay put on a
// first visit, or give way to the destination's saved scene). The confirm says
// which, in the words every other table-moving action uses.

import { sceneLossWarning, type TableSceneFate } from "../map-studio/tableMapIdentity";

export function travelPrompt(
  destination: string,
  fate: TableSceneFate,
  hasBackground: boolean,
): string {
  const ask = `Travel the whole table to "${destination}"?`;
  if (fate === "kept") return `${ask} The current scene is suspended exactly as it stands.`;
  const warning = sceneLossWarning(fate);
  if (warning) return `${ask}\n\n${warning}`;
  const pieces = hasBackground
    ? "its background image, NPCs, props and drawings"
    : "its NPCs, props and drawings";
  return (
    `${ask}\n\nThe table has no saved map, so nothing is suspended. On a first visit ` +
    `${pieces} stay and become part of "${destination}"; if the party has been there ` +
    "before, its saved scene replaces them."
  );
}
