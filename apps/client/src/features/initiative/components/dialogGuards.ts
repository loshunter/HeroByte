// ============================================================================
// INITIATIVE DIALOG GUARDS
// ============================================================================
// What keeps an initiative dialog about ITS character and nothing else.

import { useEffect, useState } from "react";

/**
 * This dialog's own save.
 *
 * A layout has ONE initiative hook (useInitiativeSetting), so its `isSetting`
 * and `error` describe whatever was sent LAST — another character's clear,
 * another dialog's save. A dialog that read them raw opened as "Setting..."
 * with Save disabled while someone else's request was in flight, closed itself
 * when that request landed, and showed a timeout it never caused. Only after
 * this dialog's own Save do they speak for it (the hook's next send resets
 * both, so a stale error cannot follow the press).
 */
export function useOwnSave(isLoading: boolean, error: string | null) {
  const [awaiting, setAwaiting] = useState(false);
  return {
    awaiting,
    saving: awaiting && isLoading,
    error: awaiting ? error : null,
    start: () => setAwaiting(true),
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
