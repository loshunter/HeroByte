import { useRef, type ReactNode, type RefObject } from "react";
import { WindowInteraction } from "../../features/interaction/WindowInteraction";

interface MobileSheetProps {
  title: string;
  label: string;
  surface: "tools" | "help";
  onClose: () => void;
  rootRef?: RefObject<HTMLDivElement>;
  children: ReactNode;
}

export function MobileSheet({
  title,
  label,
  surface,
  onClose,
  rootRef,
  children,
}: MobileSheetProps) {
  const ownRef = useRef<HTMLDivElement>(null);
  const frameRef = rootRef ?? ownRef;
  return (
    <WindowInteraction
      frameRef={frameRef}
      band={1600}
      options={{ behavior: "block" }}
      onClose={onClose}
    >
      {(close) => (
        <div
          ref={frameRef}
          className={surface === "tools" ? "mobile-tool-sheet" : "mobile-help-sheet"}
          role="dialog"
          aria-label={label}
          data-mobile-surface={surface}
        >
          <div className="mobile-tool-sheet__header">
            <strong>{title}</strong>
            <button
              type="button"
              className="mobile-tool-sheet__close"
              onClick={close ?? onClose}
              aria-label={`Close ${surface}`}
            >
              ✕
            </button>
          </div>
          {children}
        </div>
      )}
    </WindowInteraction>
  );
}
