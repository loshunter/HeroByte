/** Mobile turn navigation stays independent of the dock's open surface. */
import { useCallback } from "react";
import type { SnapshotCharacter } from "@herobyte/shared";
import { TurnNavigationControls } from "../../features/initiative/components/TurnNavigationControls";
import type { MainLayoutProps } from "../props/MainLayoutProps";

interface MobileCombatStripProps {
  combatActive: boolean;
  sendMessage: MainLayoutProps["sendMessage"];
  /**
   * Whose turn it is (U8): the phone had prev/next and no turn mark anywhere.
   * Both read from the VIEWER's snapshot, which the server already filtered —
   * the turn of a hidden NPC, or of one outside the viewer's sight, arrives as no
   * pointer, and a hidden NPC's name never arrives.
   */
  characters: readonly SnapshotCharacter[];
  currentTurnCharacterId: string | undefined;
}

export function MobileCombatStrip({
  combatActive,
  sendMessage,
  characters,
  currentTurnCharacterId,
}: MobileCombatStripProps): JSX.Element | null {
  const nextTurn = useCallback(() => sendMessage({ t: "next-turn" }), [sendMessage]);
  const previousTurn = useCallback(() => sendMessage({ t: "previous-turn" }), [sendMessage]);

  if (!combatActive) return null;

  const holder = currentTurnCharacterId
    ? characters.find((character) => character.id === currentTurnCharacterId)
    : undefined;

  return (
    <div className="mobile-combat-strip">
      <TurnNavigationControls
        combatActive={true}
        onNextTurn={nextTurn}
        onPreviousTurn={previousTurn}
      />
      {/* BELOW the buttons: above them, the connection badge (fixed, top
          centre, z 200) painted over it — measured live at 375 px. */}
      <p className="mobile-combat-strip__turn" role="status">
        Turn: {holder ? holder.name : "—"}
      </p>
    </div>
  );
}
