// ============================================================================
// REDACTED HP BADGE (S4)
// ============================================================================
// What a roster card shows when the server withheld a monster's numbers
// (the room's monsterHpDisplay). In "bloodied" mode a coarse badge rode along
// on the wire; in "hidden" mode the player learns nothing beyond the
// monster's existence. Its own module so NpcCard stays under the size guard.

import type { HpBadge } from "@herobyte/shared";

export function RedactedHpBadge({ badge }: { badge?: HpBadge }): JSX.Element {
  return (
    <div
      className="jrpg-text-small"
      data-testid="npc-hp-redacted"
      style={{
        padding: "2px 6px",
        color: badge === "bloodied" ? "var(--jrpg-red, #d63c53)" : "var(--jrpg-gold)",
      }}
    >
      {badge === "bloodied" ? "🩸 Bloodied" : badge === "healthy" ? "Healthy" : "HP: ???"}
    </div>
  );
}
