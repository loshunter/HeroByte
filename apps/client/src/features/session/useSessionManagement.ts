/**
 * useSessionManagement Hook
 *
 * Encapsulates the session save/load workflow: exporting a complete session to
 * a JSON file, and importing one back.
 *
 * SAVE IS A ROUND TRIP, not a local serialize. The client cannot build a
 * complete session on its own: its snapshot carries the map only as derived
 * output (compiledScene/mapTerrain/mapElements) plus a `liveMapDocumentId`
 * pointer, while the authored MapDocuments live server-side. So save ASKS the
 * server to bundle a SessionFile (`session-export`) and downloads the reply.
 * That is also why the whole thing is DM-only — the file is built from the DM's
 * view and contains secret doors, hidden NPCs and GM notes.
 *
 * @module features/session/useSessionManagement
 */

import { useCallback, useEffect, useRef } from "react";
import type { ClientMessage, SessionFile } from "@herobyte/shared";
import { saveSessionFile, loadSession } from "../../utils/sessionPersistence";
import { awaitSessionFile } from "./sessionFileBridge";

/**
 * Toast notification interface for displaying status messages.
 */
export interface ToastManager {
  info: (message: string, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
}

export interface UseSessionManagementOptions {
  /** Whether a snapshot has arrived yet — save needs a live connection. */
  hasSnapshot: boolean;
  sendMessage: (msg: ClientMessage) => void;
  toast: ToastManager;
}

export interface UseSessionManagementReturn {
  /** Ask the server for a complete session bundle and download it. */
  handleSaveSession: (name: string) => void;
  /** Read a session file and send it to the server. */
  handleLoadSession: (file: File) => Promise<void>;
  /** Feed the server's `session-file` reply back in (wired by the app shell). */
  onSessionFile: (file: SessionFile) => void;
}

/** How long to wait for the server's bundle before admitting it isn't coming. */
const EXPORT_TIMEOUT_MS = 15_000;

export function useSessionManagement({
  hasSnapshot,
  sendMessage,
  toast,
}: UseSessionManagementOptions): UseSessionManagementReturn {
  // The name the DM typed, held until the server's bundle arrives. Non-null
  // means "an export is in flight" — a second click is ignored rather than
  // racing a second download.
  const pendingName = useRef<string | null>(null);
  const timeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPending = useCallback(() => {
    pendingName.current = null;
    if (timeoutId.current !== null) {
      clearTimeout(timeoutId.current);
      timeoutId.current = null;
    }
  }, []);

  // A pending export must not outlive the component, or the timeout fires a
  // toast into an unmounted tree.
  useEffect(() => clearPending, [clearPending]);

  const handleSaveSession = useCallback(
    (name: string) => {
      if (!hasSnapshot) {
        toast.warning("No session data available to save yet.");
        return;
      }
      if (pendingName.current !== null) {
        toast.info("A session export is already in progress...");
        return;
      }
      pendingName.current = name;
      toast.info("Preparing session file...");
      // Say so rather than hang: without this the DM watches a toast that never
      // resolves and has no idea whether to click again.
      timeoutId.current = setTimeout(() => {
        clearPending();
        toast.error("Save failed: the server did not return a session file.", 5000);
      }, EXPORT_TIMEOUT_MS);

      sendMessage({ t: "session-export" });
    },
    [hasSnapshot, sendMessage, toast, clearPending],
  );

  const onSessionFile = useCallback(
    (file: SessionFile) => {
      const name = pendingName.current;
      if (name === null) return; // nobody asked (or the export already timed out)
      clearPending();
      try {
        saveSessionFile(file, name);
        const maps = file.mapDocuments.length;
        toast.success(
          `Session "${name}" saved — ${maps} map${maps === 1 ? "" : "s"} included.`,
          4000,
        );
      } catch (err) {
        console.error("Failed to save session", err);
        toast.error(
          err instanceof Error
            ? `Save failed: ${err.message}`
            : "Failed to save session. Check console for details.",
          5000,
        );
      }
    },
    [toast, clearPending],
  );

  const handleLoadSession = useCallback(
    async (file: File) => {
      try {
        toast.info(`Loading session from ${file.name}...`);
        const session = await loadSession(file);

        const warnings: string[] = [];
        if (!session.snapshot.sceneObjects || session.snapshot.sceneObjects.length === 0) {
          warnings.push("no scene objects");
        }
        if (!session.snapshot.characters || session.snapshot.characters.length === 0) {
          warnings.push("no characters");
        }
        // Worth saying out loud: the table will render but the map cannot be
        // edited, and the live binding gets cleared rather than left dangling.
        if (session.liveMapDocumentId && session.mapDocuments.length === 0) {
          warnings.push("no map documents — the map will load read-only");
        }

        sendMessage({
          t: "load-session",
          snapshot: session.snapshot,
          mapDocuments: session.mapDocuments,
          liveMapDocumentId: session.liveMapDocumentId,
        });

        if (warnings.length > 0) {
          toast.warning(`Session loaded with warnings: ${warnings.join(", ")}`, 5000);
        } else {
          toast.success(`Session "${file.name}" loaded successfully!`, 4000);
        }
      } catch (err) {
        console.error("Failed to load session", err);
        toast.error(
          err instanceof Error
            ? `Load failed: ${err.message}`
            : "Failed to load session. File may be corrupted.",
          5000,
        );
      }
    },
    [sendMessage, toast],
  );

  // The reply arrives at App's switchboard, which has no way to reach this hook
  // directly. Registering here (rather than being handed the file as a prop)
  // keeps the round trip's two halves in one file, where the pending-name
  // invariant is visible.
  useEffect(() => awaitSessionFile(onSessionFile), [onSessionFile]);

  return { handleSaveSession, handleLoadSession, onSessionFile };
}

export default useSessionManagement;
