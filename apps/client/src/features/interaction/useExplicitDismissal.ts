import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import { dismissalFocus, type DismissalFocus, type FocusResolver } from "./dismissalFocus";

function captureLauncher(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : null;
}

export function useExplicitDismissal(
  frame: RefObject<HTMLElement>,
  close: () => void,
  resolveTarget?: FocusResolver,
  focus: DismissalFocus = dismissalFocus,
): () => void {
  // Initial render precedes descendant autoFocus and layout effects. Never recapture.
  const opener = useRef(captureLauncher());
  const committed = useRef({ close, resolveTarget });
  useLayoutEffect(() => {
    committed.current = { close, resolveTarget };
  });
  useLayoutEffect(() => {
    focus.invalidate(); // A newly committed/reopened opt-in frame supersedes old tickets.
    // No cleanup focus/invalidation: an explicit ticket must survive this frame's unmount.
  }, [focus]);
  return useCallback(() => {
    const node = frame.current;
    if (!node) return;
    focus.request({
      frame: node,
      close: committed.current.close,
      resolveTarget: committed.current.resolveTarget ?? (() => opener.current),
    });
  }, [focus, frame]);
}

/** Specific launch buttons call this before their existing open callback. */
export function activatePanelLauncher(
  event: { currentTarget: HTMLElement },
  open: () => void,
  focus: DismissalFocus = dismissalFocus,
): void {
  focus.invalidate();
  event.currentTarget.focus({ preventScroll: true });
  open();
}
