/**
 * TurnNavigationControls Component
 *
 * Provides Previous/Next turn navigation arrows for DMs during combat.
 * Only visible when combat is active.
 *
 * Features:
 * - Previous/Next turn navigation buttons
 * - Auto-disable buttons at start/end of turn order
 * - JRPG-styled UI matching the rest of the app
 *
 * Part of Phase 15 Initiative Tracker - Turn Navigation (Task 2)
 */

import React from "react";
import { JRPGButton } from "../../../components/ui/JRPGPanel";

export interface TurnNavigationControlsProps {
  /** Whether combat/initiative tracking is currently active */
  combatActive: boolean;
  /** Handler to advance to the next turn */
  onNextTurn: () => void;
  /** Handler to go back to the previous turn */
  onPreviousTurn: () => void;
  /** Optional: Whether currently at the first turn (disables Previous) */
  isFirstTurn?: boolean;
  /** Optional: Whether currently at the last turn (disables Next) */
  isLastTurn?: boolean;
}

/**
 * Turn navigation controls for combat management
 */
export const TurnNavigationControls: React.FC<TurnNavigationControlsProps> = ({
  combatActive,
  onNextTurn,
  onPreviousTurn,
  isFirstTurn = false,
  isLastTurn = false,
}) => {
  // Don't render anything if combat is not active
  if (!combatActive) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        alignItems: "center",
        justifyContent: "center",
        padding: "8px",
      }}
    >
      <JRPGButton
        onClick={onPreviousTurn}
        disabled={isFirstTurn}
        variant="default"
        style={{
          padding: "6px 12px",
          fontSize: "12px",
        }}
        aria-label="Previous turn"
      >
        ◄ PREV
      </JRPGButton>

      <span
        className="jrpg-text-command"
        style={{
          color: "var(--jrpg-gold)",
          fontSize: "10px",
          fontWeight: "bold",
          textTransform: "uppercase",
        }}
      >
        Turn
      </span>

      <JRPGButton
        onClick={onNextTurn}
        disabled={isLastTurn}
        variant="default"
        style={{
          padding: "6px 12px",
          fontSize: "12px",
        }}
        aria-label="Next turn"
      >
        NEXT ►
      </JRPGButton>
    </div>
  );
};
