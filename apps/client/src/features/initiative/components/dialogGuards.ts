// ============================================================================
// INITIATIVE DIALOG GUARDS
// ============================================================================
// What keeps an initiative dialog about ITS character and nothing else.

import { useEffect, useRef, useState } from "react";

/**
 * This dialog's own save.
 *
 * A layout has ONE initiative hook (useInitiativeSetting), so its `isSetting`
 * and `error` describe whatever was sent LAST — another character's clear,
 * another dialog's save. A dialog that read them raw opened as "Setting..."
 * with Save disabled while someone else's request was in flight, closed itself
 * when that request landed, and showed a timeout it never caused. Only between
 * this dialog's Save and the end of THAT request do they speak for it: when it
 * ends — confirmed or failed — the dialog stops listening, and a failure's
 * message is kept as its own until the next Save.
 */
export function useOwnSave(isLoading: boolean, error: string | null) {
  const [awaiting, setAwaiting] = useState(false);
  const [ownError, setOwnError] = useState<string | null>(null);
  const sawLoading = useRef(false);
  useEffect(() => {
    if (!awaiting) return;
    if (isLoading) {
      sawLoading.current = true;
      return;
    }
    if (!sawLoading.current) return;
    sawLoading.current = false;
    setAwaiting(false);
    setOwnError(error);
  }, [awaiting, isLoading, error]);
  return {
    awaiting,
    saving: awaiting && isLoading,
    error: awaiting ? error : ownError,
    start: () => {
      sawLoading.current = false;
      setOwnError(null);
      setAwaiting(true);
    },
  };
}

/**
 * The page behind an open dialog is inert (§3.4: dialog focus is contained).
 * The dialog portals to <body>, outside the app's #root, so it stays live;
 * everything in #root — another card's INIT, the DM menu — can be neither
 * tabbed to nor pressed. Without this, Tab then Space on another character's
 * INIT re-rendered the open dialog for that character with the first one's
 * typed number, and Enter on a background button also saved the dialog.
 * A root that was already inert is left as it was found.
 */
export function useInertPage(): void {
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root || root.hasAttribute("inert")) return;
    root.setAttribute("inert", "");
    return () => root.removeAttribute("inert");
  }, []);
}
