// ============================================================================
// INITIATIVE DIALOG GUARDS
// ============================================================================
// What keeps an initiative dialog about ITS character and nothing else.

import { useState } from "react";

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
