// ============================================================================
// INITIATIVE MODAL COMPONENT
// ============================================================================
// Modal for setting character initiative with roll or manual entry options

import React, { useState, useCallback, useEffect } from "react";
import "./initiativeModal.css";
import {
  EscapeRootProvider,
  useEscapeRoot,
  useEscapeOwner,
} from "../../interaction/useEscapeOwner";
import { createPortal } from "react-dom";
import { JRPGPanel, JRPGButton } from "../../../components/ui/JRPGPanel";
import { useFollowedModifier, useInertPage, useOwnSave } from "./dialogGuards";
import type { SnapshotCharacter } from "@herobyte/shared";
import { InitiativeModifierDial } from "./InitiativeModifierDial";

interface InitiativeModalProps {
  character: SnapshotCharacter;
  onClose: () => void;
  onSetInitiative: (initiative: number, modifier: number) => void;
  /**
   * Ask the SERVER to roll. Carries the dial's modifier once the viewer has
   * touched it (the server persists and rolls with it); untouched, none, and the
   * server rolls with the stored one — never an old value written back over it.
   */
  onRollInitiative: (modifier?: number) => void;
  /**
   * Whether entering a number by hand is offered at all.
   *
   * The table setting `initiativeManualOverride` decides this for players; a DM
   * always keeps it. Defaults TRUE so a caller that has not threaded it through
   * gets the permissive shape rather than silently losing the control.
   *
   * Gating the CONTROL matters because the server refuses a gated manual entry
   * without telling anyone: it returns no-broadcast/no-save and no error, so a
   * player who got this far would watch "Setting..." for five seconds and then
   * be told the update timed out.
   */
  manualEntryAllowed?: boolean;
  /**
   * Whether a fight is running. Required: with none running, the server starts
   * one on any initiative saved — on THIS character's turn — and the
   * dialog says so before the press, rather than the table finding out after.
   */
  combatActive: boolean;
  isLoading?: boolean;
  error?: string | null;
}

export function InitiativeModal({
  character,
  onClose,
  onSetInitiative,
  onRollInitiative,
  manualEntryAllowed = true,
  combatActive,
  isLoading = false,
  error = null,
}: InitiativeModalProps) {
  const modalRef = React.useRef<HTMLDivElement>(null);
  const escapeRoot = useEscapeRoot(modalRef, 10000);
  // This dialog's OWN save: `isLoading` / `error` are the layout's one hook's,
  // which another character's save or clear drives too (dialogGuards.ts).
  const own = useOwnSave(isLoading, error);
  useInertPage(modalRef);
  useEscapeOwner(() => ({
    kind: "modal",
    name: "InitiativeModal",
    active: true,
    root: escapeRoot,
    anchor: modalRef.current,
    handle: own.saving ? undefined : onClose,
  }));

  const [modifier, setModifier, modifierTouched] = useFollowedModifier(
    character.initiativeModifier ?? 0,
  );
  const [rolledValue, setRolledValue] = useState<number | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState<string>("");
  const [wasLoading, setWasLoading] = useState(false);
  // The table can turn hand entry off while this is open (or a DM leave DM
  // mode over their own character): the server then refuses a typed value
  // without a word, so the field goes rather than time out.
  useEffect(() => {
    if (manualEntryAllowed) return;
    setManualMode(false);
    setManualValue("");
    setRolledValue(null);
  }, [manualEntryAllowed]);

  const finalInitiative = rolledValue !== null ? rolledValue + modifier : null;

  // Roll: the SERVER throws the die and APPLIES the value as it rolls, so this
  // sends and closes — a confirm press could only re-send it by hand, logging a
  // BY HAND entry that strikes the server's own roll through. The number lands
  // in the roll log (the DM's alone for a concealed NPC). An untouched dial sends
  // no modifier: the server rolls with the stored one, even one changed elsewhere
  // a moment ago.
  const handleRoll = useCallback(() => {
    onRollInitiative(modifierTouched ? modifier : undefined);
    onClose();
  }, [onRollInitiative, modifierTouched, modifier, onClose]);

  const enterManualMode = useCallback(() => {
    setManualMode(true);
    setRolledValue(null);
    setManualValue("");
  }, []);

  const handleManualValueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setManualValue(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 1 && numValue <= 20) {
      setRolledValue(numValue);
    } else {
      setRolledValue(null);
    }
  }, []);

  const handleSave = useCallback(() => {
    if (finalInitiative !== null) {
      own.start();
      onSetInitiative(finalInitiative, modifier);
      // Don't call onClose here - let the parent handle closing after the message is sent
    }
  }, [finalInitiative, modifier, onSetInitiative, own]);

  useEffect(() => {
    if (own.awaiting && wasLoading && !isLoading && !error) {
      onClose();
    }
    setWasLoading(isLoading);
  }, [own.awaiting, isLoading, wasLoading, error, onClose]);

  // PORTALLED for the same reason CharacterCreationModal is: this renders from
  // EntitiesPanel, whose root is a `position: fixed; zIndex: 100` STACKING
  // CONTEXT, so an overlay at 10000 inside it still painted under every
  // DraggableWindow (the roll log at 999, a settings window at 2500). The audit
  // caught the sibling modal; this one is the same defect one file over.
  //
  // The [data-mobile-surface] wrapper carries the 44px touch floor across the
  // portal, which lands outside every mobile surface: since U8 the phone's
  // Party INIT and Encounter open this dialog too, so the floor depends on it.
  //
  // It is not quite free, and the effect is the one we want: the floor rules are
  // `(pointer: coarse)`-scoped, so a mouse desktop is untouched, but a coarse
  // pointer wider than 1024px takes the DESKTOP layout (see MOBILE_LAYOUT_QUERY)
  // and does pick them up — growing this modal's number input from 37px to 44px
  // on a touch monitor or a tablet in landscape.
  return createPortal(
    <EscapeRootProvider value={escapeRoot}>
      <div style={{ display: "contents" }} data-mobile-surface="modal">
        <div
          ref={modalRef}
          data-modal-overlay=""
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          onClick={own.saving ? undefined : onClose}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <JRPGPanel
              title={`Initiative: ${character.name}`}
              style={{ width: "400px", maxWidth: "90vw" }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <InitiativeModifierDial
                  modifier={modifier}
                  onChange={setModifier}
                  disabled={own.saving}
                />

                {/* Roll Options */}
                {/* The commit vocabulary (U8, §3.4): "now" rolls at once; a
                    hand entry waits for Save initiative. */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <JRPGButton
                    variant="primary"
                    onClick={handleRoll}
                    disabled={own.saving}
                    style={{ flex: 1 }}
                  >
                    Roll d20 now
                  </JRPGButton>
                  {manualEntryAllowed && (
                    <JRPGButton onClick={enterManualMode} disabled={own.saving} style={{ flex: 1 }}>
                      Enter a roll by hand
                    </JRPGButton>
                  )}
                </div>
                {!manualEntryAllowed && (
                  <p className="initiative-modal__note">
                    Entering a roll by hand is off at this table. The DM can allow it in DM Menu →
                    Session.
                  </p>
                )}
                {!combatActive && (
                  <p className="initiative-modal__note">
                    {`No fight is running: saving an initiative starts combat, on ${character.name}'s turn.`}
                  </p>
                )}

                {/* Manual Entry */}
                {manualMode && (
                  <div>
                    <label
                      className="jrpg-text-small"
                      style={{ display: "block", marginBottom: "8px" }}
                    >
                      Enter d20 Roll (1-20)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={manualValue}
                      readOnly={own.saving}
                      onChange={handleManualValueChange}
                      // Enter saves from HERE only, never from a focused button.
                      onKeyDown={(e) => {
                        if (e.key !== "Enter" || finalInitiative === null || own.saving) return;
                        e.preventDefault();
                        handleSave();
                      }}
                      placeholder="Enter roll..."
                      autoFocus
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "8px",
                        background: "#111",
                        color: "var(--jrpg-white)",
                        border: "2px solid var(--jrpg-border-gold)",
                        fontSize: "18px",
                        textAlign: "center",
                      }}
                    />
                  </div>
                )}

                {/* Result Display */}
                {rolledValue !== null && (
                  <div
                    style={{
                      padding: "16px",
                      background: "rgba(255, 215, 0, 0.1)",
                      border: "2px solid var(--jrpg-gold)",
                      borderRadius: "4px",
                      textAlign: "center",
                    }}
                  >
                    <div className="jrpg-text-small" style={{ marginBottom: "8px", opacity: 0.8 }}>
                      d20 Roll: {rolledValue} {modifier >= 0 ? "+" : ""} {modifier}
                    </div>
                    <div
                      style={{ fontSize: "32px", fontWeight: "bold", color: "var(--jrpg-gold)" }}
                    >
                      Initiative: {finalInitiative}
                    </div>
                  </div>
                )}

                {/* Error Display */}
                {own.error && (
                  <div
                    style={{
                      padding: "12px",
                      background: "rgba(232, 154, 156, 0.12)",
                      border: "2px solid var(--jrpg-red)",
                      borderRadius: "4px",
                      color: "var(--jrpg-red)",
                      fontFamily: "var(--font-body)",
                      lineHeight: 1.45,
                      textAlign: "center",
                    }}
                  >
                    {own.error}
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  <JRPGButton onClick={onClose} disabled={own.saving} style={{ flex: 1 }}>
                    Cancel
                  </JRPGButton>
                  <JRPGButton
                    variant="success"
                    onClick={handleSave}
                    disabled={finalInitiative === null || own.saving}
                    style={{ flex: 1 }}
                  >
                    {own.saving ? "Setting..." : "Save initiative"}
                  </JRPGButton>
                </div>
              </div>
            </JRPGPanel>
          </div>
        </div>
      </div>
    </EscapeRootProvider>,
    document.body,
  );
}
