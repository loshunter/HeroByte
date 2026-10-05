// ============================================================================
// LOCK REFUSAL BRIDGE — tell a waiting action that the lock refused it
// ============================================================================
// The server's `locked-refused` lands at App's single-slot server-event
// switchboard (useServerEventHandlers), which toasts it. A few actions down in
// the DM menu (deleting an NPC, placing its token) wait for the snapshot to
// confirm and time out after 5 s: refused, they waited out a false "timed out".
// They listen here and stop waiting. Module-scoped for the reason sessionBridge
// gives: one WebSocket and one app per tab.

import type { ServerMessage } from "@herobyte/shared";

type LockRefusal = Extract<ServerMessage, { t: "locked-refused" }>;
const listeners = new Set<(refusal: LockRefusal) => void>();

/** Listen for refusals; returns an unsubscribe for the effect cleanup. */
export function onLockRefusal(listener: (refusal: LockRefusal) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function deliverLockRefusal(refusal: LockRefusal): void {
  for (const listener of listeners) listener(refusal);
}
