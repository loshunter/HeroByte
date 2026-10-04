// ============================================================================
// RECONNECT PHASE — the gate says why the table is not answering
// ============================================================================
// When the socket drops, the app stays mounted behind AuthenticationGate. The gate
// used to paint a fixed "Reconnecting…" banner for that, at the top right of the
// screen, over whatever happened to be there: the header's own controls once the
// header moved up, the phone's connection chip. Nothing owned that space.
//
// Now the gate only says WHY it is waiting (this context), and each host puts the
// words in its own layout (ReconnectNotice): the header hangs them under its
// bottom edge, the phone's top stack gives them a place in its column.

import { createContext, useContext } from "react";

/** Reconnecting to the server, or connected and proving who we are again; null when neither. */
export type ReconnectPhase = "reconnecting" | "reauthenticating" | null;

export const ReconnectPhaseContext = createContext<ReconnectPhase>(null);

export function useReconnectPhase(): ReconnectPhase {
  return useContext(ReconnectPhaseContext);
}
