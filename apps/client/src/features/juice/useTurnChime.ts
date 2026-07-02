// ============================================================================
// useTurnChime
// ============================================================================
// Plays the "your turn" chime whenever the active combatant changes. Skips the
// first observation so loading into an in-progress combat is silent, and stays
// quiet when combat ends (id → undefined).

import { useEffect, useRef } from "react";
import { sfxEngine } from "./sfxEngine";

export function useTurnChime(currentTurnCharacterId: string | null | undefined): void {
  const prev = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const previous = prev.current;
    prev.current = currentTurnCharacterId;

    if (previous === undefined) return; // baseline on mount
    if (!currentTurnCharacterId) return; // combat ended / no active turn
    if (currentTurnCharacterId === previous) return;

    sfxEngine.play("turnAdvance");
  }, [currentTurnCharacterId]);
}
