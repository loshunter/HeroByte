// ============================================================================
// MOBILE ROW ACTIONS
// ============================================================================
// A phone Party row's action line: 🎯 FOCUS, ⚔️ INIT and ⚙️ EDIT. Split from
// MobilePlayerRow (U8), which sat near the 350-line guard, when INIT joined.
//
// INIT opens the ONE initiative dialog the desktop card's INIT opens
// (useInitiativeDialog) — before U8 a phone could not set a character's
// initiative at all. Its accessible name never starts "Edit": the row's
// "⚙️ EDIT" is found by /EDIT/i.

import type React from "react";
import { activatePanelLauncher } from "../../features/interaction/useExplicitDismissal";
import { JRPGButton } from "../ui/JRPGPanel";

/** A row's initiative: its value, whether it holds the turn, and — for a row
 *  the viewer may set (their own, or any for a DM) — the dialog's opener. */
export interface MobileRowInitiative {
  value: number | undefined;
  isTurn: boolean;
  onOpen?: () => void;
  /** Names the INIT button's successor when a reconnect re-renders the row, so
   *  the dialog's focus comes back to it (useInertPage). */
  focusKey: string;
}

interface MobileRowActionsProps {
  name: string;
  onFocus?: () => void;
  onOpenInitiative?: () => void;
  initiative: number | undefined;
  initiativeFocusKey?: string;
  /** Opens the row's settings sheet; absent where the viewer may not edit. */
  onEdit?: () => void;
}

const buttonStyle: React.CSSProperties = { flex: 1, padding: "4px 8px", fontSize: "11px" };

export function MobileRowActions({
  name,
  onFocus,
  onOpenInitiative,
  initiative,
  initiativeFocusKey,
  onEdit,
}: MobileRowActionsProps) {
  if (!onFocus && !onOpenInitiative && !onEdit) return null;
  return (
    <div style={{ display: "flex", gap: "8px" }}>
      {onFocus && (
        <JRPGButton
          onClick={onFocus}
          variant="default"
          aria-label={`Focus ${name}`}
          title="Show this character's token on the map"
          style={buttonStyle}
        >
          🎯 FOCUS
        </JRPGButton>
      )}
      {onOpenInitiative && (
        <JRPGButton
          onClick={onOpenInitiative}
          variant="default"
          aria-label={
            initiative === undefined
              ? `Set initiative for ${name}`
              : `Initiative ${initiative}: set for ${name}`
          }
          data-focus-key={initiativeFocusKey}
          style={buttonStyle}
        >
          ⚔️ INIT{initiative === undefined ? "" : ` ${initiative}`}
        </JRPGButton>
      )}
      {/* Your own row always, and every row for a DM — matching desktop,
          where a DM gets a settings button on every card. Without the DM
          case the phone had no way to reach the DM-only controls inside
          (S7's sight radius), so they shipped unreachable. */}
      {onEdit && (
        <JRPGButton
          onClick={(event) => activatePanelLauncher(event, onEdit)}
          variant="primary"
          style={buttonStyle}
        >
          ⚙️ EDIT
        </JRPGButton>
      )}
    </div>
  );
}
