// ============================================================================
// SESSION BRIDGE
// ============================================================================
// The seam between the app shell and the session feature. Two things cross it,
// both for the same reason: the shell holds them, and useSessionManagement needs
// them from down inside the DM menu (useDMContext).
//
//   1. The server's `session-file` reply, which lands at App's single-slot
//      server-event switchboard.
//   2. The room credentials, needed to re-upload a restored session's inlined
//      image assets (POST /assets is credential-gated).
//
// Why not drill callbacks down instead: the path runs App -> MainLayout ->
// MainLayoutProps -> DMMenuContainer -> useDMContext, and every prop added to
// MainLayoutProps has to be threaded through four layout characterization
// fixtures. That is a lot of blast radius for a message and an accessor.
//
// Module-scoped is honest here rather than lazy: there is exactly one WebSocket
// and one app per tab, the same assumption sfxEngine already makes. If that ever
// stops holding, this becomes a React context — the seam is small on purpose.
//
// Single-waiter by design: an export already in flight blocks a second one
// (useSessionManagement guards on its pending ref), so there is never a queue.

import type { SessionFile } from "@herobyte/shared";
import type { AssetUploadCredentials } from "../map-studio/uploads/assetUpload";

let waiting: ((file: SessionFile) => void) | null = null;
let credentialsProvider: (() => AssetUploadCredentials | null) | null = null;

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

/**
 * Let the shell publish the room credentials. Returns an unsubscribe so a
 * remount cannot leave a stale accessor behind.
 */
export function provideSessionCredentials(
  provider: () => AssetUploadCredentials | null,
): () => void {
  credentialsProvider = provider;
  return () => {
    if (credentialsProvider === provider) credentialsProvider = null;
  };
}

/**
 * The room credentials, or null if the shell has not published them (or the DM
 * is not authenticated). Null is handled: uploadAssetFile turns it into a
 * plain-English "join the room before uploading assets" rather than a crash.
 */
export function sessionCredentials(): AssetUploadCredentials | null {
  return credentialsProvider?.() ?? null;
}
