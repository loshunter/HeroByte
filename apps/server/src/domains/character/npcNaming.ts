/**
 * Naming for bulk-created and duplicated NPCs.
 *
 * Lives on the server because the server owns character creation: if the
 * client picked names, two DMs adding goblins at the same moment would each
 * number from the state they last saw and collide. One caller, one authority.
 *
 * @module domains/character/npcNaming
 */

/**
 * Split "Goblin 3" into its base and number, "Goblin" into a base with none.
 *
 * Duplicating an already-numbered NPC must continue that NPC's series rather
 * than starting "Goblin 3 2" — so the number is stripped before allocating.
 */
export function splitNumberedName(name: string): { base: string; index?: number } {
  const match = /^(.*?)\s+(\d+)$/.exec(name.trim());
  if (!match) return { base: name.trim() };
  const index = Number(match[2]);
  // "Goblin 007" is a name, not an index — round-tripping it would rewrite it.
  if (!Number.isSafeInteger(index) || String(index) !== match[2]) {
    return { base: name.trim() };
  }
  return { base: match[1], index };
}

/**
 * Highest number already in use for a base name, treating a bare "Goblin" as 1
 * so that duplicating it yields "Goblin 2" rather than a second "Goblin".
 */
function highestIndexFor(existingNames: readonly string[], base: string): number {
  let highest = 0;
  for (const name of existingNames) {
    const parsed = splitNumberedName(name);
    if (parsed.base !== base) continue;
    highest = Math.max(highest, parsed.index ?? 1);
  }
  return highest;
}

/**
 * Allocate `count` names for `baseName` that do not collide with `existingNames`.
 *
 * The rule, and why:
 *
 * - Creating ONE NPC whose name is free leaves it exactly as typed. That keeps
 *   the existing "+ Add NPC" button's behaviour identical — it sends "New NPC"
 *   with no count — so this change is invisible until a DM asks for more than
 *   one or reuses a name.
 * - Otherwise names are numbered, continuing PAST what already exists. Adding
 *   five goblins and then three more gives Goblin 1–5 then Goblin 6–8, not two
 *   sets of the same numbers. Telling Goblin 3 from Goblin 5 is the entire
 *   point of the feature; handing back duplicates would defeat it.
 * - Allocation is cumulative within one call, so a single batch cannot collide
 *   with itself.
 */
export function allocateNpcNames(
  existingNames: readonly string[],
  baseName: string,
  count: number,
): string[] {
  const requested = Math.max(1, Math.floor(count));
  const { base, index } = splitNumberedName(baseName);
  // `base` is only empty when the caller's name was entirely whitespace, which
  // validateCreateNpcMessage admits (" " is one character). Fall back to the
  // name AS GIVEN rather than to its trimmed form: trimming would turn " " into
  // "", and an NPC with no name at all renders as a blank nameplate. Before
  // this function existed such a name was stored verbatim, and it still is.
  const safeBase = base.length > 0 ? base : baseName;

  const taken = new Set(existingNames);
  // The as-typed shortcut requires that the caller did NOT hand us a numbered
  // name. Duplicating "Goblin 7" asks to continue that series; returning the
  // bare "Goblin" because it happens to be free would both rename the copy and
  // drop it out of the series it came from.
  if (requested === 1 && index === undefined && !taken.has(safeBase)) {
    return [safeBase];
  }

  const names: string[] = [];
  let next = highestIndexFor(existingNames, safeBase) + 1;
  while (names.length < requested) {
    const candidate = `${safeBase} ${next}`;
    next += 1;
    // UNREACHABLE TODAY, and kept deliberately. If `${safeBase} ${n}` already
    // existed then splitNumberedName would have parsed it as (safeBase, n), so
    // highestIndexFor would have returned at least n and `next` would already
    // be past it. A sabotage removing this line leaves every test green, which
    // is recorded here rather than papered over with a test that only pretends
    // to reach it. It stays because it makes the no-duplicates invariant local
    // to this loop instead of a property inherited from highestIndexFor at a
    // distance — if that function ever stops scanning every name, this is what
    // keeps the bug from becoming two identically-named goblins.
    if (taken.has(candidate)) continue;
    taken.add(candidate);
    names.push(candidate);
  }
  return names;
}
