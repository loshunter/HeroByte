// ============================================================================
// MOBILE DICE ROLLER
// ============================================================================
// Full-screen overlay dice roller optimized for touch devices.

import React, { useState } from "react";
import type { Build, DieType, RollResult } from "./types";
import { rollBuild } from "./diceLogic";
import { DiceBar } from "./DiceBar";
import { BuildStrip } from "./BuildStrip";
import { ResultPanel } from "./ResultPanel";
import { JRPGButton } from "../ui/JRPGPanel";
import { generateUUID } from "../../utils/uuid";

interface MobileDiceRollerProps {
  onRoll?: (result: RollResult) => void;
  onClose: () => void;
}

export const MobileDiceRoller: React.FC<MobileDiceRollerProps> = ({ onRoll, onClose }) => {
  const [build, setBuild] = useState<Build>([]);
  const [result, setResult] = useState<RollResult | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const addDie = (die: DieType) => {
    const existing = build.find((t) => t.kind === "die" && t.die === die);
    if (existing) {
      setBuild(
        build.map((t) => (t.id === existing.id && t.kind === "die" ? { ...t, qty: t.qty + 1 } : t)),
      );
    } else {
      setBuild([...build, { kind: "die", die, qty: 1, id: generateUUID() }]);
    }
  };

  const addModifier = (value: number) => {
    setBuild([...build, { kind: "mod", value, id: generateUUID() }]);
  };

  const handleRoll = () => {
    if (build.length === 0) return;

    setIsAnimating(true);
    setTimeout(() => {
      const rollResult = rollBuild(build);
      setResult(rollResult);
      setIsAnimating(false);
      if (onRoll) {
        onRoll(rollResult);
      }
    }, 600);
  };

  const clearBuild = () => {
    setBuild([]);
    setResult(null);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      data-testid="dice-roller"
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        zIndex: 2000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        touchAction: "none", // Prevent scroll on map
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          position: "relative",
          pointerEvents: "auto",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ color: "var(--hero-gold)", margin: 0, fontSize: "1.5rem" }}>
            ⚂ Dice Roller
          </h2>
          <JRPGButton
            onClick={onClose}
            variant="danger"
            style={{ padding: "8px 16px", fontSize: "14px" }}
          >
            ✕ CLOSE
          </JRPGButton>
        </div>

        {/* Dice Selection */}
        <div style={{ overflowX: "auto", paddingBottom: "4px" }}>
          <DiceBar onAddDie={addDie} onAddModifier={addModifier} />
        </div>

        {/* Build Area */}
        <div
          style={{
            background: "rgba(0, 0, 0, 0.5)",
            border: "1px solid var(--hero-gold)",
            borderRadius: "8px",
            padding: "12px",
            minHeight: "100px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {build.length === 0 ? (
            <div
              style={{
                color: "rgba(255, 255, 255, 0.5)",
                textAlign: "center",
                fontStyle: "italic",
              }}
            >
              Select dice to roll...
            </div>
          ) : (
            <BuildStrip build={build} onUpdateBuild={setBuild} isAnimating={isAnimating} />
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "12px" }}>
          <JRPGButton
            onClick={clearBuild}
            variant="danger"
            disabled={build.length === 0}
            style={{ flex: 1, padding: "16px", fontSize: "14px" }}
          >
            CLEAR
          </JRPGButton>
          <JRPGButton
            onClick={handleRoll}
            variant="primary"
            disabled={build.length === 0 || isAnimating}
            style={{ flex: 2, padding: "16px", fontSize: "18px", fontWeight: "bold" }}
          >
            ⚂ ROLL!
          </JRPGButton>
        </div>

        {/* Result Overlay */}
        {result && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 10,
              width: "100%",
            }}
          >
            <ResultPanel result={result} onClose={() => setResult(null)} />
          </div>
        )}
      </div>
    </div>
  );
};
