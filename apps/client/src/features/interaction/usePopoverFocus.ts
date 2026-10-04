// ============================================================================
// POPOVER FOCUS (the header's Table menu and Help)
// ============================================================================
// The owner's contract (U10b, Q5), the same for both popovers:
//   1. opening takes focus INTO the popover;
//   2. focus goes back to the launcher ONLY on Escape or the toggle button. A
//      click elsewhere leaves focus where the person clicked, and an item that
//      opens something else (Table settings…, Enter DM mode) hands focus to that
//      thing, so those paths close with plain `setOpen(false)`;
//   3. Tab is never trapped: past the last control the popover closes and focus
//      carries on after the launcher; Shift+Tab off the first control lands on it.
//
// Both popovers are PORTALLED to document.body, so the browser's own Tab order
// would leave them for the end of the page. The keydown handler is what keeps
// "the next Tab" next to the launcher.

import { useCallback, useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import { isEditableTarget } from "../../utils/isEditableTarget";
import { deltaForKey } from "../movement/keyboardMovement";

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function tabbablesIn(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE)).filter((el) => !el.hidden);
}

interface PopoverFocusOptions {
  open: boolean;
  /** The portalled popover; it needs `tabIndex={-1}` as the fallback focus target. */
  popRef: RefObject<HTMLElement>;
  /** The launcher's wrapper; its button is where focus returns. */
  wrapRef: RefObject<HTMLElement>;
  setOpen: (open: boolean) => void;
}

export function usePopoverFocus({ open, popRef, wrapRef, setOpen }: PopoverFocusOptions) {
  const launcher = useCallback(
    () => wrapRef.current?.querySelector<HTMLElement>("button") ?? null,
    [wrapRef],
  );

  // Focus was inside the popover and its control was then REMOVED (the Table menu swaps its role
  // controls when the connection blips and the role goes unknown): the browser drops focus to the
  // page, where this popover's Tab handling can no longer see a key. Take it back. (A click
  // elsewhere or a Tab out closes the popover, which ends this.)
  const hadFocus = useRef(false);

  useEffect(() => {
    const pop = popRef.current;
    if (!open || !pop) return;
    (tabbablesIn(pop)[0] ?? pop).focus();
    // The focus the popover gives itself fires before the listener below exists, and it is the
    // control most likely to be removed (the first one, a role button): arm the recovery here.
    hadFocus.current = pop.contains(document.activeElement);
  }, [open, popRef]);

  useEffect(() => {
    const pop = popRef.current;
    if (!open || !pop) {
      hadFocus.current = false;
      return;
    }
    const onIn = () => {
      hadFocus.current = true;
    };
    pop.addEventListener("focusin", onIn);
    return () => pop.removeEventListener("focusin", onIn);
  }, [open, popRef]);
  // After every render of the host (no dependency list on purpose: the removal is a render).
  useEffect(() => {
    const pop = popRef.current;
    if (open && pop && hadFocus.current && document.activeElement === document.body) pop.focus();
  });

  /** Escape and the toggle button: close, and put focus back on the launcher. */
  const closeToLauncher = useCallback(() => {
    setOpen(false);
    launcher()?.focus();
  }, [launcher, setOpen]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      // The movement keys (arrows, WASD, QEZC) pressed here belong to the popover: reading a help
      // list with the down arrow must not step the player's token, and the movement hook listens
      // on window. A text field keeps its own keys, and a modified key is somebody else's shortcut.
      if (
        deltaForKey(event.nativeEvent) &&
        !isEditableTarget(event.target) &&
        !(event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)
      ) {
        event.stopPropagation();
        return;
      }
      const pop = popRef.current;
      const from = launcher();
      if (event.key !== "Tab" || !pop || !from) return;
      const items = tabbablesIn(pop);
      if (items.length === 0) return;
      const active = document.activeElement;
      // The container holds focus after a click on its text (or when it had nothing tabbable):
      // Shift+Tab from there is "before the first control" too.
      if (event.shiftKey && (active === items[0] || active === pop)) {
        event.preventDefault();
        closeToLauncher();
      } else if (!event.shiftKey && active === items[items.length - 1]) {
        event.preventDefault();
        const outside = tabbablesIn(document.body).filter((el) => !pop.contains(el));
        const next = outside[outside.indexOf(from) + 1] ?? from;
        setOpen(false);
        next.focus();
      }
    },
    [closeToLauncher, launcher, popRef, setOpen],
  );

  return { closeToLauncher, onKeyDown };
}
