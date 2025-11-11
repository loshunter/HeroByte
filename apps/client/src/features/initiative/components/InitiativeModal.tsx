// ============================================================================
// INITIATIVE MODAL COMPONENT
// ============================================================================
// Modal for setting character initiative with roll or manual entry options

import React, { useState, useCallback, useEffect } from "react";
import { JRPGPanel, JRPGButton } from "../../../components/ui/JRPGPanel";
import type { Character } from "@shared";

interface InitiativeModalProps {
  character: Character;
  onClose: () => void;
  onSetInitiative: (initiative: number, modifier: number) => void;
}

export function InitiativeModal({ character, onClose, onSetInitiative }: InitiativeModalProps) {
  // State for initiative modifier and rolled value
  const [modifier, setModifier] = useState(character.initiativeModifier ?? 0);
  const [rolledValue, setRolledValue] = useState<number | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState<string>("");

  // Calculate final initiative
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

  // Roll d20
  const rollD20 = useCallback(() => {
    const roll = Math.floor(Math.random() * 20) + 1;
    setRolledValue(roll);
    setManualMode(false);
    setManualValue("");
  }, []);

  // Switch to manual entry mode
  const enterManualMode = useCallback(() => {
    setManualMode(true);
    setRolledValue(null);
    setManualValue("");
  }, []);

  // Handle manual value change
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

  // Handle save
  const handleSave = useCallback(() => {
    if (finalInitiative !== null) {
      console.log("[InitiativeModal] Saving initiative:", {
        finalInitiative,
        modifier,
        character: character.name,
      });
      onSetInitiative(finalInitiative, modifier);
      onClose();
    }
  }, [finalInitiative, modifier, onSetInitiative, onClose, character.name]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter" && finalInitiative !== null) {
        handleSave();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, finalInitiative, handleSave]);

  return (
    <div
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
              <label className="jrpg-text-small" style={{ display: "block", marginBottom: "8px" }}>
                Initiative Modifier
              </label>
              <div
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
              <JRPGButton variant="primary" onClick={rollD20} style={{ flex: 1 }}>
                Roll Initiative
              </JRPGButton>
              <JRPGButton onClick={enterManualMode} style={{ flex: 1 }}>
                Use Physical Dice
              </JRPGButton>
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
                <div style={{ fontSize: "32px", fontWeight: "bold", color: "var(--jrpg-gold)" }}>
                  Initiative: {finalInitiative}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <JRPGButton onClick={onClose} style={{ flex: 1 }}>
                Cancel
              </JRPGButton>
              <JRPGButton
                variant="success"
                onClick={handleSave}
                disabled={finalInitiative === null}
                style={{ flex: 1 }}
              >
                Save
              </JRPGButton>
            </div>
          </div>
        </JRPGPanel>
      </div>
    </div>
  );
}
