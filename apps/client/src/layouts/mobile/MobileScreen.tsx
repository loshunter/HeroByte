// ============================================================================
// MOBILE SCREEN
// ============================================================================
// The full-height surface for things you READ (redesign §1): Party, Log and —
// from M4b — the DM menu. Sheets are for things operated AGAINST the map; a
// Screen covers the whole shell, dock included, and Back is the way out.
//
// The ✕ is the contract, the drag-down is the affordance (§1b): dismissal by
// dragging the header never touches the canvas, so it costs none of M2's
// gesture budget — but it is progressive enhancement over a button that
// always works, because M3 paid twice for a panel whose only exit could
// become unreachable.

import React, { useEffect, useRef } from "react";
import { registerOpenPanel } from "../../components/effects/panelPresence";
import type { MobileSurface } from "../../hooks/useMobileSurface";

/** Past this the release dismisses; short of it the screen snaps back. */
const DISMISS_DRAG_PX = 96;

interface MobileScreenProps {
  title: string;
  surface: Exclude<MobileSurface, "none">;
  onClose: () => void;
  children: React.ReactNode;
}

export function MobileScreen({
  title,
  surface,
  onClose,
  children,
}: MobileScreenProps): JSX.Element {
  const rootRef = useRef<HTMLElement | null>(null);
  const dragStartY = useRef<number | null>(null);

  // A Screen is a panel in the CRT filter's sense: the filter softens over it
  // and restores over the map. DraggableWindow used to announce the log; the
  // screen that replaced it keeps the announcement.
  useEffect(() => registerOpenPanel(), []);

  const settle = () => {
    dragStartY.current = null;
    if (rootRef.current) rootRef.current.style.transform = "";
  };

  const onTouchStart = (event: React.TouchEvent) => {
    // A second finger is the camera's escape everywhere else in the shell;
    // here it simply isn't a drag.
    dragStartY.current = event.touches.length === 1 ? event.touches[0].clientY : null;
  };

  const onTouchMove = (event: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const dy = event.touches[0].clientY - dragStartY.current;
    // Direct manipulation, not an animation — the screen follows the finger,
    // so there is nothing for [data-motion="off"] to switch off.
    if (rootRef.current) {
      rootRef.current.style.transform = dy > 0 ? `translateY(${dy}px)` : "";
    }
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const dy = event.changedTouches[0].clientY - dragStartY.current;
    settle();
    if (dy > DISMISS_DRAG_PX) onClose();
  };

  return (
    <section
      ref={rootRef}
      className="mobile-screen"
      role="dialog"
      aria-label={title}
      data-mobile-surface={surface}
    >
      <header
        className="mobile-screen__header"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={settle}
      >
        <h2 className="mobile-screen__title">{title}</h2>
        <button
          type="button"
          className="jrpg-button jrpg-button-danger mobile-screen__close"
          onClick={onClose}
          aria-label={`Close ${title}`}
        >
          ✕
        </button>
      </header>
      <div className="mobile-screen__body">{children}</div>
    </section>
  );
}
