// ============================================================================
// LOCK REFUSAL COPY — what the table says when the lock stopped you
// ============================================================================
// A locked token, prop or drawing cannot be moved or deleted by anyone, the DM
// included, until the DM unlocks it. The server sends the one who tried a
// `locked-refused` frame; a single action was refused, and `kept` marks a bulk
// action (Clear all drawings, REMOVE) that went ahead and left the locked pieces.
// The words for a refused action are the Delete key's own (useKeyboardShortcuts),
// so the table says one thing whichever road reached the lock.

import { LOCKED_CANNOT_DELETE, LOCKED_CANNOT_DELETE_DM } from "../../hooks/useKeyboardShortcuts";

export function lockRefusalMessage(count: number, kept: boolean, isDM: boolean): string {
  if (!kept) return isDM ? LOCKED_CANNOT_DELETE_DM : LOCKED_CANNOT_DELETE;
  const pieces = count === 1 ? "1 locked piece" : `${count} locked pieces`;
  const them = count === 1 ? "it" : "them";
  return isDM
    ? `${pieces} kept: 🔓 Unlock ${them}, then delete ${them}.`
    : `${pieces} kept: only the DM can unlock ${them}.`;
}
