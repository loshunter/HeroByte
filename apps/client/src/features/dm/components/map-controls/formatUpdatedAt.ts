/**
 * Short last-edited stamp for the map-document picker.
 *
 * Extracted from MapStudioControl so that file stays under the 350 LOC
 * structural guardrail.
 *
 * Today and yesterday get a time, because the case that actually happens is
 * two documents created in the SAME session — a bare date would render both
 * identically and leave them as indistinguishable as the duplicate names this
 * exists to disambiguate.
 */
export function formatUpdatedAt(updatedAt: number): string {
  const when = new Date(updatedAt);
  if (Number.isNaN(when.getTime())) return "unknown";

  const now = new Date();
  const sameDay = when.toDateString() === now.toDateString();
  const time = when.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return time;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (when.toDateString() === yesterday.toDateString()) return `yesterday ${time}`;

  return when.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
