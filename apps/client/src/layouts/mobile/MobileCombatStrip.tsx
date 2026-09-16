/** Mobile turn navigation stays independent of the dock's open surface. */
import { useCallback } from "react";
import { TurnNavigationControls } from "../../features/initiative/components/TurnNavigationControls";
import type { MainLayoutProps } from "../props/MainLayoutProps";

interface MobileCombatStripProps {
  combatActive: boolean;
  sendMessage: MainLayoutProps["sendMessage"];
}

export function MobileCombatStrip({
  combatActive,
  sendMessage,
}: MobileCombatStripProps): JSX.Element | null {
  const nextTurn = useCallback(() => sendMessage({ t: "next-turn" }), [sendMessage]);
  const previousTurn = useCallback(() => sendMessage({ t: "previous-turn" }), [sendMessage]);

  if (!combatActive) return null;

  return (
    <div className="mobile-combat-strip">
      <TurnNavigationControls
        combatActive={true}
        onNextTurn={nextTurn}
        onPreviousTurn={previousTurn}
      />
    </div>
  );
}
