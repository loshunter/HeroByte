import { isEditableTarget } from "../../utils/isEditableTarget";
import {
  currentEntries,
  focusedCanvasEligible,
  hasForegroundModal,
  localSiteEligible,
  orderedOwner,
  pickEscape,
} from "./escapePolicy";
import type { CancelReason, EscapeRoot, LocalSite, ReadOwner } from "./escapeTypes";

export type DispatchResult = "ignored" | "unhandled" | "handled" | "blocked" | "ambiguous";

function eventElement(event: KeyboardEvent, fallbackWindow?: Window): HTMLElement | null {
  const target = event.target;
  if (target instanceof HTMLElement) return target;
  const active = (event.view ?? fallbackWindow)?.document.activeElement;
  return active instanceof HTMLElement ? active : null;
}

function consume(event: KeyboardEvent): void {
  event.preventDefault();
  event.stopImmediatePropagation();
}

export function createEscapeRegistry(
  getWindow: () => Window | undefined = () => (typeof window === "undefined" ? undefined : window),
  onAmbiguous: () => void = () => console.warn("Escape owners have an unresolved priority tie"),
) {
  const owners = new Map<symbol, ReadOwner>();
  const visibleFrames = new Map<symbol, () => EscapeRoot | null>();
  const subscribers = new Set<() => void>();
  let listeningWindow: Window | undefined;
  let composing = false;
  let refreshing = false;
  let pendingLabel: string | null = null;
  const live = () => currentEntries(owners);
  const roots = () =>
    Array.from(visibleFrames.values(), (read) => read()).filter((root): root is EscapeRoot =>
      Boolean(root?.node()?.isConnected),
    );

  const retainsNativeEscape = (event: KeyboardEvent): boolean => {
    const target = eventElement(event, listeningWindow ?? getWindow());
    return (
      event.key !== "Escape" ||
      event.defaultPrevented ||
      event.isComposing ||
      composing ||
      event.keyCode === 229 ||
      Boolean(target?.closest("select"))
    );
  };

  const publish = () => {
    const chosen = orderedOwner(live(), "gesture");
    const next =
      chosen.state === "one" && chosen.value.owner.kind === "gesture"
        ? (chosen.value.owner.label ?? "Cancel gesture")
        : null;
    if (next === pendingLabel) return;
    pendingLabel = next;
    for (const subscriber of subscribers) subscriber();
  };

  const cancelAll = (reason: Extract<CancelReason, "foreground-modal" | "transition">): number => {
    let cancelled = 0;
    for (const { id } of live()) {
      // Re-read after each cancellation; several registrations may observe the same refs.
      const owner = owners.get(id)?.();
      if (owner?.kind === "gesture" && owner.active) {
        owner.handle(reason);
        cancelled += 1;
      }
    }
    return cancelled;
  };

  const refresh = (): void => {
    if (refreshing) return;
    refreshing = true;
    try {
      if (hasForegroundModal(live(), roots())) cancelAll("foreground-modal");
      publish();
    } finally {
      refreshing = false;
    }
  };

  const dispatch = (event: KeyboardEvent): DispatchResult => {
    if (retainsNativeEscape(event)) return "ignored";
    refresh(); // Reconcile a live modal edge before its Escape handler can close it.
    const chosen = pickEscape(
      live(),
      isEditableTarget(eventElement(event, listeningWindow ?? getWindow())),
      roots(),
    );
    if (chosen.state === "none") return "unhandled";
    consume(event);
    if (chosen.state === "blocked") return "blocked";
    if (chosen.state === "ambiguous") {
      onAmbiguous();
      return "ambiguous";
    }
    // Consume a loading modal even with no close action. No fallback afterwards.
    chosen.value.owner.handle?.("escape");
    refresh();
    return "handled";
  };

  const onKeyDown = (event: KeyboardEvent) => {
    dispatch(event);
  };
  const onCompositionStart = () => {
    composing = true;
  };
  const onCompositionEnd = () => {
    composing = false;
  };
  const detach = () => {
    listeningWindow?.removeEventListener("keydown", onKeyDown);
    listeningWindow?.removeEventListener("compositionstart", onCompositionStart, true);
    listeningWindow?.removeEventListener("compositionend", onCompositionEnd, true);
    listeningWindow?.removeEventListener("blur", onCompositionEnd);
    listeningWindow = undefined;
    composing = false;
  };
  const attach = () => {
    if (listeningWindow) return;
    listeningWindow = getWindow();
    listeningWindow?.addEventListener("keydown", onKeyDown);
    listeningWindow?.addEventListener("compositionstart", onCompositionStart, true);
    listeningWindow?.addEventListener("compositionend", onCompositionEnd, true);
    listeningWindow?.addEventListener("blur", onCompositionEnd);
  };

  return {
    /** Paint presence only: no frame-specific key handler, close action, or focus action. */
    observeFrame(read: () => EscapeRoot | null): () => void {
      const id = Symbol("escape-visible-frame");
      visibleFrames.set(id, read);
      attach();
      refresh();
      return () => {
        if (!visibleFrames.delete(id)) return;
        if (!owners.size && !visibleFrames.size) detach();
        refresh();
      };
    },
    register(read: ReadOwner): () => void {
      const id = Symbol("escape-owner");
      owners.set(id, read);
      attach();
      refresh();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        owners.delete(id);
        if (!owners.size && !visibleFrames.size) detach();
        refresh();
      };
    },
    dispatch,
    refresh,
    canHandleLocalEscape(event: KeyboardEvent, site: LocalSite): boolean {
      return !retainsNativeEscape(event) && localSiteEligible(live(), site, roots());
    },
    /** Key-independent. History passes its intended owner site, not the event target. */
    isForeground(site: LocalSite): boolean {
      return localSiteEligible(live(), site, roots());
    },
    /** History/delete belong to the intended canvas site, never a focused panel button. */
    canHandleShortcut(
      event: KeyboardEvent,
      site: LocalSite,
      options: { allowFocusedCanvas?: boolean } = {},
    ): boolean {
      const target = eventElement(event, listeningWindow ?? getWindow());
      const focusedCanvas =
        options.allowFocusedCanvas &&
        !site.root &&
        site.anchor?.isConnected &&
        target === site.anchor &&
        site.anchor.ownerDocument.activeElement === site.anchor;
      return (
        !event.defaultPrevented &&
        !event.isComposing &&
        !composing &&
        event.keyCode !== 229 &&
        !isEditableTarget(target) &&
        (focusedCanvas
          ? focusedCanvasEligible(live(), roots())
          : localSiteEligible(live(), site, roots()))
      );
    },
    cancelForTransition(): number {
      const count = cancelAll("transition");
      refresh();
      return count;
    },
    cancelPending(): boolean {
      const chosen = orderedOwner(live(), "gesture");
      const owner = chosen.state === "one" ? chosen.value.owner : null;
      const canCancel = owner?.kind === "gesture";
      if (canCancel) owner.handle("cancel-control");
      refresh();
      return canCancel;
    },
    getPendingLabel: (): string | null => pendingLabel,
    subscribe(listener: () => void): () => void {
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
      };
    },
  };
}

export type EscapeRegistry = ReturnType<typeof createEscapeRegistry>;
