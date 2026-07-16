// ============================================================================
// useTurnChime
// ============================================================================
// Plays the "your turn" chime whenever the active combatant changes.
//
// It takes the SNAPSHOT, not the id, and that is deliberate. There are three
// states, and the difference between the last two is the whole design:
//
//   no snapshot   — pre-connect, or the socket dropped and useWebSocket cleared
//                   it. NO INFORMATION. Observe nothing: don't take the
//                   baseline, and above all don't touch `prev`.
//   no active turn— a snapshot is here and names no turn this player can
//                   resolve: combat ended, OR it is a hidden/fogged NPC's turn,
//                   which the server withholds (see toSnapshot). A REAL
//                   observation; the next visible turn must still chime.
//   an id         — the active combatant.
//
// Passing `snapshot?.currentTurnCharacterId` would collapse the first two into
// one `undefined` and reintroduce the bug, so the mapping lives in here where
// the tests cover it rather than at a call site where it reads as a needless
// long-hand and invites "simplification."
//
// Why `prev` must survive a missing snapshot: a reconnect goes id → gap → the
// SAME id. Recording the gap makes that look like a change and chimes for a turn
// that never advanced — on every network blip. Skipping it means the id compares
// equal across the gap and stays silent, while a turn that really did advance
// mid-drop still chimes.

import { useEffect, useRef } from "react";
import type { RoomSnapshot } from "@herobyte/shared";
import { sfxEngine } from "./sfxEngine";

export function useTurnChime(
  snapshot: Pick<RoomSnapshot, "currentTurnCharacterId"> | null | undefined,
): void {
  const prev = useRef<string | null>(null);
  const observed = useRef(false);
  // null = asked and answered (no turn). undefined = never asked (no snapshot).
  const turn = snapshot ? (snapshot.currentTurnCharacterId ?? null) : undefined;

  useEffect(() => {
    if (turn === undefined) return; // no snapshot: learn nothing, record nothing

    const previous = prev.current;
    const hasObserved = observed.current;
    prev.current = turn;
    observed.current = true;

    if (!hasObserved) return; // first real snapshot is the baseline, never a chime
    if (!turn) return; // no active turn (ended, or not ours to see)
    if (turn === previous) return;

    sfxEngine.play("turnAdvance");
  }, [turn]);
}
