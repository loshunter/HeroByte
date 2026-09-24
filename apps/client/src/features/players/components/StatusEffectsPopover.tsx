import { useRef, type ReactNode, type RefObject } from "react";
import type { EscapeRoot } from "../../interaction/escapeTypes";
import { useEscapeOwner, useEscapeRootContext } from "../../interaction/useEscapeOwner";

function PickerOwner({
  root,
  anchor,
  onClose,
}: {
  root: EscapeRoot;
  anchor: RefObject<HTMLDivElement>;
  onClose: () => void;
}) {
  useEscapeOwner(() => ({
    kind: "popover",
    name: "character-status-effects",
    active: true,
    root,
    anchor: anchor.current,
    localBand: 1000,
    handle: onClose,
  }));
  return null;
}

export function StatusEffectsPopover({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  const root = useEscapeRootContext();
  const anchor = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={anchor}
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        marginTop: "4px",
        maxHeight: "300px",
        overflowY: "auto",
        background: "rgba(12, 18, 40, 0.98)",
        border: "2px solid var(--jrpg-border-gold)",
        borderRadius: "6px",
        padding: "8px",
        zIndex: 1000,
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.5)",
      }}
    >
      {root && <PickerOwner root={root} anchor={anchor} onClose={onClose} />}
      {children}
    </div>
  );
}
