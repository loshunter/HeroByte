import type { CSSProperties } from "react";
import { escapeRegistry, usePendingGestureLabel } from "./useEscapeOwner";

interface CancelGestureButtonProps {
  idleLabel: "Cancel stroke" | "Cancel placement";
  dock?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function CancelGestureButton({
  idleLabel,
  dock = false,
  className = "jrpg-button",
  style,
}: CancelGestureButtonProps) {
  const pendingLabel = usePendingGestureLabel();
  const label = pendingLabel ?? idleLabel;
  return (
    <button
      type="button"
      className={className}
      style={{ ...style, minWidth: 44, minHeight: 44 }}
      disabled={!pendingLabel}
      aria-label={label}
      title={pendingLabel ?? "No unfinished gesture to cancel"}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        escapeRegistry.cancelPending();
      }}
      onClick={(event) => {
        event.stopPropagation();
        // Pointer activation already ran on press, including a second touch
        // that generates no click. A compatibility click must not cancel a new stroke.
        if (event.detail === 0) escapeRegistry.cancelPending();
      }}
    >
      {dock ? (
        <>
          <span className="mobile-dock-button__icon" aria-hidden="true">
            ⨯
          </span>
          Stop
        </>
      ) : (
        label
      )}
    </button>
  );
}
