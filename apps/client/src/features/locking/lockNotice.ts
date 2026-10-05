// ============================================================================
// LOCK NOTICE — the client says the lock stopped you, before the server must
// ============================================================================
// A control the lock stops (a card's Delete, Place, an arrow key on a locked
// token, an eraser pass over a locked drawing) never reaches the server, so no
// `locked-refused` comes back to explain it. A `disabled` button answered a press
// with nothing at all — and a tooltip never shows on a phone. These say it here:
// App's server-event switchboard (useServerEventHandlers) listens and toasts, the
// same toast a server refusal gets. Module-scoped for the reason
// lockRefusalBridge gives: one app per tab.

import type { CSSProperties } from "react";

const listeners = new Set<(message?: string) => void>();

/** Listen for notices; returns an unsubscribe for the effect cleanup. */
export function onLockNotice(listener: (message?: string) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Say the lock stopped what the viewer just tried. With no message the viewer's
 * role picks the words (lockRefusalMessage: the DM is told to unlock it first, a
 * player that only the DM can).
 */
export function announceLocked(message?: string): void {
  for (const listener of listeners) listener(message);
}

/** A control the lock stops still LOOKS inert. */
const LOCKED_LOOK: CSSProperties = { opacity: 0.5, cursor: "not-allowed" };

/**
 * Props that stop a control while `locked` and say why when it is pressed:
 * aria-disabled (not `disabled`, which swallows the press and drops focus), the
 * reason as its tooltip and its toast, and the inert look over `style`. Spread
 * AFTER the control's own onClick and style, so these win while locked.
 */
export function lockGuard(
  locked: boolean,
  why: string,
  style?: CSSProperties,
): {
  "aria-disabled"?: true;
  title?: string;
  onClick?: () => void;
  style?: CSSProperties;
} {
  if (!locked) return {};
  return {
    "aria-disabled": true,
    title: why,
    onClick: () => announceLocked(why),
    style: { ...style, ...LOCKED_LOOK },
  };
}
