/**
 * The table's manual-initiative rule, in one place.
 *
 * `initiativeManualOverride` defaults to TRUE and the snapshot carries the key
 * ONLY when it is off, so the test is `!== false` — never `?? false`, and never
 * a bare truthiness check. Written either of those ways the DM's checkbox
 * renders unchecked on every table that has never touched the setting, and the
 * DM "fixes" it by writing an explicit value that was already the default.
 *
 * It is a named rule rather than an inline expression because two callers
 * derive it — the DM menu's checkbox and the initiative modal's gate — and
 * because the same intent is pinned on the server from the other side
 * (StatePersistence.test.ts, "reading an ABSENT key as ON").
 *
 * @module features/initiative/manualOverride
 */

/** The shape this rule needs, so a caller can pass a whole snapshot or null. */
interface ManualOverrideSource {
  initiativeManualOverride?: boolean;
}

/**
 * Whether players at this table may enter an initiative by hand.
 *
 * @param snapshot - The room snapshot, or null before one has arrived
 * @returns true unless the table has explicitly turned the setting off
 */
export function manualInitiativeEnabled(
  snapshot: ManualOverrideSource | null | undefined,
): boolean {
  return snapshot?.initiativeManualOverride !== false;
}

/**
 * Whether THIS viewer may enter an initiative by hand.
 *
 * A DM keeps hand-entry whatever the table setting says — turning the setting
 * off is a rule for the players, not a vow the DM takes. The server agrees:
 * `handleSetInitiative` gates a non-DM sender only.
 *
 * @param snapshot - The room snapshot, or null before one has arrived
 * @param isDM - Whether this viewer is the DM
 */
export function manualInitiativeAllowedFor(
  snapshot: ManualOverrideSource | null | undefined,
  isDM: boolean,
): boolean {
  return isDM || manualInitiativeEnabled(snapshot);
}
