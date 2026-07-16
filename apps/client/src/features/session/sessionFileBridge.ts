// ============================================================================
// SESSION FILE BRIDGE
// ============================================================================
// The server's `session-file` reply lands at App's single-slot server-event
// switchboard. The code that knows what to do with it — and holds the filename
// the DM typed — is useSessionManagement, which lives down inside the DM menu
// (useDMContext). The two ends meet here.
//
// Why not drill a callback down instead: the path runs App -> MainLayout ->
// MainLayoutProps -> DMMenuContainer -> useDMContext, and every prop added to
// MainLayoutProps has to be threaded through four layout characterization
// fixtures. That is a lot of blast radius for routing one message.
//
// Module-scoped is honest here rather than lazy: there is exactly one WebSocket
// and one app per tab, the same assumption sfxEngine already makes. If that ever
// stops holding, this becomes a React context — the seam is small on purpose.
//
// Single-waiter by design: an export already in flight blocks a second one
// (useSessionManagement guards on its pending ref), so there is never a queue.

import type { SessionFile } from "@herobyte/shared";

let waiting: ((file: SessionFile) => void) | null = null;

/**
 * Register the handler for the next `session-file`. Returns an unsubscribe —
 * call it on unmount so a stale closure cannot receive a late reply.
 */
export function awaitSessionFile(handler: (file: SessionFile) => void): () => void {
  waiting = handler;
  return () => {
    if (waiting === handler) waiting = null;
  };
}

/**
 * Hand a `session-file` to whoever asked for it. A reply nobody is waiting for
 * is dropped: it means the DM navigated away or the export already timed out,
 * and downloading a file they no longer expect would be worse than nothing.
 */
export function deliverSessionFile(file: SessionFile): void {
  waiting?.(file);
}
