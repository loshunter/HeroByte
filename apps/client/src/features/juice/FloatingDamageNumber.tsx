// ============================================================================
// FLOATING DAMAGE NUMBER
// ============================================================================
// Rising combat text ("-7" / "+4") that floats up and fades. Rendered inside a
// position:relative container (e.g. a player/NPC card). Suppressed when the
// user has motion turned off.

import React from "react";

export type HpChangeKind = "damage" | "heal";

interface FloatingDamageNumberProps {
  /** Signed amount; negative renders as damage, positive as heal. */
  amount: number;
  kind: HpChangeKind;
  /** Bumping this key restarts the animation for a fresh hit. */
  animationKey: number;
}

export const FloatingDamageNumber: React.FC<FloatingDamageNumberProps> = ({
  amount,
  kind,
  animationKey,
}) => {
  const label = amount > 0 ? `+${amount}` : `${amount}`;
  return (
    <span
      key={animationKey}
      className={`juice-floating-number juice-floating-${kind}`}
      aria-hidden="true"
    >
      {label}
    </span>
  );
};
