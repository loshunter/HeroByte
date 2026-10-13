// ============================================================================
// CHARACTER REFUSAL BRIDGE — tell "Creating..." the server said no, or say it gave up
// ============================================================================
// The server's `character-refused` lands at App's single-slot server-event
// switchboard (useServerEventHandlers), which toasts it and delivers it here:
// "Creating..." (useCharacterCreation) waits for the snapshot to show the new
// character, and a refused add would otherwise wait out its timeout in silence.
// The other way, a give-up with no answer at all is announced here and the
// switchboard toasts it. Module-scoped for the reason sessionBridge gives: one
// WebSocket and one app per tab.

import type { ServerMessage } from "@herobyte/shared";

type CharacterRefusal = Extract<ServerMessage, { t: "character-refused" }>;
const refusalListeners = new Set<(refusal: CharacterRefusal) => void>();
const noticeListeners = new Set<(message: string) => void>();

/** Listen for refusals; returns an unsubscribe for the effect cleanup. */
export function onCharacterRefusal(listener: (refusal: CharacterRefusal) => void): () => void {
  refusalListeners.add(listener);
  return () => {
    refusalListeners.delete(listener);
  };
}

export function deliverCharacterRefusal(refusal: CharacterRefusal): void {
  for (const listener of refusalListeners) listener(refusal);
}

/** Listen for notices to toast; returns an unsubscribe for the effect cleanup. */
export function onCharacterNotice(listener: (message: string) => void): () => void {
  noticeListeners.add(listener);
  return () => {
    noticeListeners.delete(listener);
  };
}

export function announceCharacterNotice(message: string): void {
  for (const listener of noticeListeners) listener(message);
}
