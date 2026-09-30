// ============================================================================
// INITIATIVE MODAL COMPONENT
// ============================================================================
// Modal for setting character initiative with roll or manual entry options

import React, { useState, useCallback, useEffect } from "react";
import {
  EscapeRootProvider,
  useEscapeRoot,
  useEscapeOwner,
} from "../../interaction/useEscapeOwner";
import { createPortal } from "react-dom";
import { JRPGPanel, JRPGButton } from "../../../components/ui/JRPGPanel";
import { useInertPage, useOwnSave } from "./dialogGuards";
import type { SnapshotCharacter } from "@herobyte/shared";

interface InitiativeModalProps {
  character: SnapshotCharacter;
  onClose: () => void;
  onSetInitiative: (initiative: number, modifier: number) => void;
  /**
   * Ask the SERVER to roll. Carries the dial's current modifier, which the
   * server persists and rolls with — without it the roll would silently apply
   * whatever modifier was last stored and the dial would stop mattering.
   */
  onRollInitiative: (modifier: number) => void;
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
  isLoading?: boolean;
  error?: string | null;
}

export function InitiativeModal({
  character,
  onClose,
  onSetInitiative,
  onRollInitiative,
  manualEntryAllowed = true,
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

  const [modifier, setModifier] = useState(character.initiativeModifier ?? 0);
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

  // Handle modifier drag
  const handleModifierDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const element = e.currentTarget;
      const startX = e.clientX;
      const startModifier = modifier;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const change = Math.floor(deltaX / 10); // 10px = 1 point
        setModifier(Math.max(-20, Math.min(20, startModifier + change)));
      };

      const handlePointerUp = () => {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
        element.releasePointerCapture(e.pointerId);
      };

      element.setPointerCapture(e.pointerId);
      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
    },
    [modifier],
  );

  // Roll: the SERVER throws the die, on the same generator dice use, and the
  // result lands in the public roll log labelled with this character's name.
  //
  // This sends and closes rather than showing the number here first. That is
  // not a shortcut: the server APPLIES the value as it rolls, so there is
  // nothing left for a confirm press to confirm — a second press could only
  // re-send it down the manual path, which would log it a second time as
  // "(entered)" and strike the server's own roll through. The number is not
  // lost by closing; it appears in the roll log, which every seat can see.
  const handleRoll = useCallback(() => {
    onRollInitiative(modifier);
    onClose();
  }, [onRollInitiative, modifier, onClose]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && finalInitiative !== null && !own.saving) {
        handleSave();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [finalInitiative, handleSave, own.saving]);

  // PORTALLED for the same reason CharacterCreationModal is: this renders from
  // EntitiesPanel, whose root is a `position: fixed; zIndex: 100` STACKING
  // CONTEXT, so an overlay at 10000 inside it still painted under every
  // DraggableWindow (the roll log at 999, a settings window at 2500). The audit
  // caught the sibling modal; this one is the same defect one file over.
  //
  // The [data-mobile-surface] wrapper carries the 44px touch floor across the
  // portal, which lands outside every mobile surface. This modal is desktop-only
  // today — EntitiesPanel is not on the phone — so it is insurance.
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
          onClick={onClose}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <JRPGPanel
              title={`Initiative: ${character.name}`}
              style={{ width: "400px", maxWidth: "90vw" }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Initiative Modifier */}
                <div>
                  <label
                    className="jrpg-text-small"
                    style={{ display: "block", marginBottom: "8px" }}
                  >
                    Initiative Modifier
                  </label>
                  <div
                    data-testid="initiative-modifier-dial"
                    onPointerDown={handleModifierDrag}
                    style={{
                      padding: "12px",
                      background: "#111",
                      border: "2px solid var(--jrpg-border-gold)",
                      textAlign: "center",
                      fontSize: "24px",
                      fontWeight: "bold",
                      cursor: "ew-resize",
                      userSelect: "none",
                      color: modifier >= 0 ? "var(--jrpg-green)" : "var(--jrpg-red)",
                    }}
                  >
                    {modifier >= 0 ? "+" : ""}
                    {modifier}
                  </div>
                  <div
                    className="jrpg-text-small"
                    style={{ marginTop: "4px", textAlign: "center", opacity: 0.7 }}
                  >
                    Click and drag left/right to adjust
                  </div>
                </div>

                {/* Roll Options */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <JRPGButton variant="primary" onClick={handleRoll} style={{ flex: 1 }}>
                    Roll Initiative
                  </JRPGButton>
                  {manualEntryAllowed && (
                    <JRPGButton onClick={enterManualMode} style={{ flex: 1 }}>
                      Use Physical Dice
                    </JRPGButton>
                  )}
                </div>

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
                      onChange={handleManualValueChange}
                      placeholder="Enter roll..."
                      autoFocus
                      style={{
                        width: "100%",
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
                    {own.saving ? "Setting..." : "Save"}
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
