// ============================================================================
// PARTY INSPECTOR
// ============================================================================
// The one place the compact roster opens a character's details: the existing
// full card, beside the roster, with a named close. It is a content panel in
// the Escape ladder (§3.1): Escape closes it — after any open settings window
// or modal above it, and never ahead of a canvas gesture — and returns focus
// to its character's roster row, whatever held focus when it (re)mounted (the
// Cards/Roster toggle, say). The map stays usable while it is open.

import { useRef, type ReactNode } from "react";
import type { FocusResolver } from "../../../features/interaction/dismissalFocus";
import { WindowInteraction } from "../../../features/interaction/WindowInteraction";
import { sanitizeText } from "../../../utils/sanitize";

/** The Party panel's paint band (its root is `position: fixed; z-index: 100`). */
const PARTY_PANEL_BAND = 100;

interface PartyInspectorProps {
  id: string;
  name: string;
  onClose: () => void;
  /** Where focus goes when it closes: its character's roster row. */
  returnFocusTo: FocusResolver;
  children: ReactNode;
}

export function PartyInspector({
  id,
  name,
  onClose,
  returnFocusTo,
  children,
}: PartyInspectorProps): JSX.Element {
  const frameRef = useRef<HTMLElement>(null);
  const label = sanitizeText(name);
  return (
    <WindowInteraction
      frameRef={frameRef}
      band={PARTY_PANEL_BAND}
      floating
      options={{ behavior: "close", panel: "character", resolveReturnFocus: returnFocusTo }}
      onClose={onClose}
    >
      {(close) => (
        <section ref={frameRef} id={id} className="party-inspector" aria-label={`${label} details`}>
          <header className="party-inspector__header">
            <span className="party-inspector__title">{label}</span>
            <button
              type="button"
              className="party-inspector__close"
              aria-label={`Close ${label} details`}
              onClick={close ?? onClose}
            >
              ✕
            </button>
          </header>
          {children}
        </section>
      )}
    </WindowInteraction>
  );
}
