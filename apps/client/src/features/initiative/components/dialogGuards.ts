// ============================================================================
// INITIATIVE DIALOG GUARDS
// ============================================================================
// What keeps an initiative dialog about ITS character and nothing else.

import { useEffect, useRef, useState, type RefObject } from "react";
import { canReturnFocus } from "../../interaction/dismissalFocus";

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
 * The page behind an open dialog is inert (§3.4: dialog focus is contained and
 * returned). EVERY child of <body> but the dialog's own portal: the app's #root
 * (another card's INIT, the DM menu) and the windows that portal to <body>
 * beside it (a character's ⚙ settings window, with its Clear Initiative; the
 * Help popover). Without this, Tab then Space on another character's INIT
 * re-rendered the open dialog for that character with the first one's typed
 * number, and a settings window's clear could land during this dialog's save.
 * Only what this dialog made inert is restored; focus moves into the dialog on
 * open and back to what had it (the INIT button, usually) on close.
 */
export function useInertPage(own: RefObject<HTMLElement>): void {
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const mine = own.current;
    const madeInert: Element[] = [];
    for (const child of Array.from(document.body.children)) {
      if (mine && child.contains(mine)) continue;
      if (child.hasAttribute("inert")) continue;
      child.setAttribute("inert", "");
      madeInert.push(child);
    }
    mine
      ?.querySelector<HTMLElement>("button:not([disabled]), input")
      ?.focus({ preventScroll: true });
    return () => {
      for (const child of madeInert) child.removeAttribute("inert");
      if (canReturnFocus(opener)) opener.focus({ preventScroll: true });
    };
  }, [own]);
}
