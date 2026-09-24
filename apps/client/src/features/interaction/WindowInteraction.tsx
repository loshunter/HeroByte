import type { ReactNode, RefObject } from "react";
import type { EscapeRoot } from "./escapeTypes";
import type { FocusResolver } from "./dismissalFocus";
import { useExplicitDismissal } from "./useExplicitDismissal";
import { EscapeRootProvider, useEscapeOwner, useEscapeRoot } from "./useEscapeOwner";

type DismissibleWindow = "character" | "world" | "chat" | "dm";
interface Placement {
  containingRoot?: EscapeRoot;
  /** Actual layer band within an explicitly shared root; defaults to the frame band. */
  localBand?: number;
}
export type WindowInteractionOptions = Placement &
  (
    | { behavior: "context" | "block" }
    | {
        behavior: "close";
        panel: DismissibleWindow;
        resolveReturnFocus?: FocusResolver;
        /** Synchronous, Escape-only preparation; X retains its ordinary blur semantics. */
        beforeEscape?: () => void;
      }
  );
interface FrameProps {
  frameRef: RefObject<HTMLElement>;
  band: number;
  options?: WindowInteractionOptions;
  onClose?: () => void;
  children: (close: (() => void) | undefined) => ReactNode;
}
interface LayerProps {
  root: EscapeRoot;
  frameRef: RefObject<HTMLElement>;
  localBand: number;
  onClose?: () => void;
  children: FrameProps["children"];
}

function BlockingFrame({ root, frameRef, localBand, children, onClose }: LayerProps) {
  // A non-modal, non-closing content panel. Pending gestures keep first refusal;
  // localSiteEligible guards lower editors inside this SAME root (Dice → Result).
  useEscapeOwner(() => ({
    kind: "panel",
    name: "blocking-frame",
    active: true,
    root,
    anchor: frameRef.current,
    localBand,
  }));
  return <EscapeRootProvider value={root}>{children(onClose)}</EscapeRootProvider>;
}

function ClosingFrame({
  root,
  frameRef,
  localBand,
  panel,
  onClose,
  resolveReturnFocus,
  beforeEscape,
  children,
}: LayerProps & {
  panel: DismissibleWindow;
  onClose: () => void;
  resolveReturnFocus?: FocusResolver;
  beforeEscape?: () => void;
}) {
  // This child exists only for close opt-ins and renders before descendant autoFocus.
  const dismiss = useExplicitDismissal(frameRef, onClose, resolveReturnFocus);
  useEscapeOwner(() => ({
    kind: "panel",
    name: panel,
    active: true,
    root,
    anchor: frameRef.current,
    localBand,
    handle: () => {
      beforeEscape?.();
      dismiss();
    },
  }));
  return <EscapeRootProvider value={root}>{children(dismiss)}</EscapeRootProvider>;
}

export function WindowInteraction({ frameRef, band, options, onClose, children }: FrameProps) {
  const ownRoot = useEscapeRoot(frameRef, band);
  // A portal's logical parent does not define its paint root. Only explicit sharing does.
  const root = options?.containingRoot ?? ownRoot;
  const localBand = options?.localBand ?? (options?.containingRoot ? band : 0);
  if (options?.behavior === "close" && onClose) {
    return (
      <ClosingFrame
        root={root}
        frameRef={frameRef}
        localBand={localBand}
        panel={options.panel}
        onClose={onClose}
        resolveReturnFocus={options.resolveReturnFocus}
        beforeEscape={options.beforeEscape}
      >
        {children}
      </ClosingFrame>
    );
  }
  if (options && options.behavior !== "context") {
    return (
      <BlockingFrame root={root} frameRef={frameRef} localBand={localBand} onClose={onClose}>
        {children}
      </BlockingFrame>
    );
  }
  // Draw/Map palettes remain identity/context only; no owner, passive presence or focus hook.
  return <EscapeRootProvider value={root}>{children(onClose)}</EscapeRootProvider>;
}
