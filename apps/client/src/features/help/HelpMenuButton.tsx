// ============================================================================
// HELP MENU BUTTON
// ============================================================================
// Self-contained header button that toggles the in-app manual. No props, so
// it drops into the toolbar without threading state through MainLayoutProps
// and its four layout fixtures.
//
// The popover is PORTALLED to document.body. The header is a fixed container
// at z-index 100, which makes it a stacking context: a child cannot paint
// above the entities panel, a later sibling at the same z-index. The manual is
// 500px and was being cut off exactly at the entities panel's top edge.
// Portalling also lets the panel size itself to the viewport instead of
// guessing with vh. (The Table menu is portalled for the same reason.)

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { JRPGButton, JRPGPanel } from "../../components/ui/JRPGPanel";
import { HelpPanel } from "./HelpPanel";
import { EscapeRootProvider, useEscapeOwner, useEscapeRoot } from "../interaction/useEscapeOwner";

interface Anchor {
  top: number;
  right: number;
  maxHeight: number;
}

/** Park the popover under the button, flush to its right edge. */
function anchorTo(el: HTMLElement | null): Anchor | null {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const top = rect.bottom + 6;
  return {
    top,
    right: Math.max(8, window.innerWidth - rect.right),
    maxHeight: Math.max(160, window.innerHeight - top - 12),
  };
}

export const HelpMenuButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const escapeRoot = useEscapeRoot(popRef, 2000);
  useEscapeOwner(() => ({
    kind: "popover",
    name: "Help",
    active: open && anchor !== null,
    root: escapeRoot,
    anchor: popRef.current,
    handle: () => setOpen(false),
  }));

  const toggle = useCallback(() => {
    setOpen((wasOpen) => {
      if (!wasOpen) setAnchor(anchorTo(wrapRef.current));
      return !wasOpen;
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    // The button lives in a wrapping toolbar, so a resize can move it under
    // the popover's feet. Re-measure rather than leaving it stranded.
    const reanchor = () => setAnchor(anchorTo(wrapRef.current));
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const inside =
        wrapRef.current?.contains(target) === true || popRef.current?.contains(target) === true;
      if (!inside) setOpen(false);
    };

    // A window resize is NOT the only way this button moves. The header is a
    // wrapping toolbar whose contents change — elevating to DM adds "🏗️ Build map"
    // and "👁 Player View", which can rewrap the row — and the header's bottom edge moves
    // with the public-table warning row appearing or disappearing. None of that fires
    // `resize`, and the popover is portalled to document.body, so it cannot
    // simply be positioned relative to its button. Observing the button's own
    // box catches every case: a rewrap changes where it is, and that is exactly
    // what an observer on it reports.
    const observer =
      typeof ResizeObserver === "undefined" || !wrapRef.current
        ? null
        : new ResizeObserver(reanchor);
    observer?.observe(wrapRef.current as Element);
    if (wrapRef.current?.parentElement) observer?.observe(wrapRef.current.parentElement);

    window.addEventListener("resize", reanchor);
    document.addEventListener("mousedown", onDocClick);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", reanchor);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <JRPGButton
        onClick={toggle}
        variant={open ? "primary" : "default"}
        style={{ fontSize: "8px", padding: "4px 10px" }}
        title="How HeroByte works: tools, dice, fog, and the full guides"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {/* Decorative: a screen reader announcing "question mark Help" is
            noise, and it keeps the accessible name identical to the mobile
            tool-sheet entry. */}
        <span aria-hidden="true">?</span> Help
      </JRPGButton>

      {open &&
        anchor &&
        createPortal(
          <EscapeRootProvider value={escapeRoot}>
            <div
              ref={popRef}
              role="dialog"
              aria-label="HeroByte help"
              style={{
                position: "fixed",
                top: anchor.top,
                right: anchor.right,
                zIndex: 2000,
                // Cap the OUTER box, not the panel: the frame's padding and
                // border are part of what has to fit on screen.
                maxHeight: anchor.maxHeight,
                display: "flex",
              }}
            >
              <JRPGPanel
                variant="bevel"
                style={{
                  padding: "10px",
                  width: "340px",
                  maxWidth: "calc(100vw - 16px)",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                  overflow: "hidden",
                  // The frame is now the height authority; the panel fills it
                  // and scrolls, so it must not also cap itself.
                  ["--help-panel-max-height" as string]: "none",
                }}
              >
                <HelpPanel />
              </JRPGPanel>
            </div>
          </EscapeRootProvider>,
          document.body,
        )}
    </div>
  );
};
