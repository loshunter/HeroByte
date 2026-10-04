export type FocusResolver = () => HTMLElement | null;

export function canReturnFocus(target: HTMLElement | null): target is HTMLElement {
  if (!target?.isConnected || target === target.ownerDocument.body) return false;
  if (target.matches(":disabled,[aria-disabled='true']")) return false;
  if (target.closest("[hidden],[inert],[aria-hidden='true']")) return false;
  const view = target.ownerDocument.defaultView;
  if (!view || target.getClientRects().length === 0) return false;
  for (let node: HTMLElement | null = target; node; node = node.parentElement) {
    const style = view.getComputedStyle(node);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse"
    ) {
      return false;
    }
  }
  return true;
}

interface Dismissal {
  frame: HTMLElement;
  close: () => void;
  resolveTarget: FocusResolver;
}

export function createDismissalFocus() {
  let pending: { frame: HTMLElement; cancel: () => void } | null = null;
  const invalidate = () => {
    pending?.cancel();
  };

  return {
    /** Explicit launcher activation, a newly committed frame, or a raw transition. */
    invalidate,
    request({ frame, close, resolveTarget }: Dismissal): boolean {
      if (!frame.isConnected || pending?.frame === frame) return false;
      invalidate();
      const document = frame.ownerDocument;
      const view = document.defaultView;
      if (!view) {
        close();
        return true;
      }
      const focusAtDismiss = document.activeElement;
      let animation: number | null = null;
      const ticket = {
        frame,
        cancel: () => {
          if (animation !== null) view.cancelAnimationFrame(animation);
          document.removeEventListener("pointerdown", cancelOnIntent, true);
          document.removeEventListener("focusin", cancelOnFocus, true);
          view.removeEventListener("blur", cancelOnIntent);
          if (pending === ticket) pending = null;
        },
      };
      function cancelOnIntent() {
        ticket.cancel();
      }
      function cancelOnFocus(event: FocusEvent) {
        // Removing the old focused frame may reset focus to the document itself.
        if (event.target !== document.body && event.target !== document.documentElement)
          ticket.cancel();
      }
      pending = ticket;
      document.addEventListener("pointerdown", cancelOnIntent, true);
      document.addEventListener("focusin", cancelOnFocus, true);
      view.addEventListener("blur", cancelOnIntent);
      try {
        close();
      } catch (error) {
        ticket.cancel();
        throw error;
      }
      if (pending !== ticket) return true;
      animation = view.requestAnimationFrame(() => {
        if (pending !== ticket) return;
        ticket.cancel(); // Exactly one attempt; no retry after an ignored/delayed close.
        if (frame.isConnected) return;
        const target = resolveTarget();
        if (!canReturnFocus(target) || target.ownerDocument !== document) return;
        const active = document.activeElement;
        if (active === target) return;
        if (
          active &&
          active !== document.body &&
          active !== document.documentElement &&
          active !== focusAtDismiss &&
          !frame.contains(active)
        )
          return;
        target.focus({ preventScroll: true });
      });
      return true;
    },
  };
}

export type DismissalFocus = ReturnType<typeof createDismissalFocus>;
export const dismissalFocus = createDismissalFocus();
