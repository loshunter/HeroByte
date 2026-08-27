// ============================================================================
// MOBILE DICE ROLLER
// ============================================================================
// Full-screen overlay dice roller optimized for touch devices.
//
// It shares useDiceBuild with the desktop roller, so the two cannot drift
// again — the previous copy-paste is why phones rolled in silence for months
// (no rattle, no crit sting) while the desktop had all of it. Advantage,
// visibility and macros land here in the same slice, not as a follow-up: the
// dock is a hardcoded 5-column grid and a new control has nowhere else to go.

import React from "react";
import { useDiceBuild } from "./useDiceBuild";
import { formulaFromBuild } from "./diceLogic";
import type { RollLogEntry } from "./rollLogTypes";
import type { DiceRollMode, DiceVisibility } from "./types";
import { DiceBar } from "./DiceBar";
import { BuildStrip } from "./BuildStrip";
import { MacroBar } from "./MacroBar";
import { MobileResultOverlay } from "./MobileResultOverlay";
import { HandEntry } from "./HandEntry";
import { RollOptions } from "./RollOptions";
import { JRPGButton } from "../ui/JRPGPanel";

interface MobileDiceRollerProps {
  onRoll?: (request: { formula: string; mode: DiceRollMode; visibility: DiceVisibility }) => void;
  latestOwnRoll?: RollLogEntry | null;
  /**
   * Record what was thrown on physical dice instead of asking the server to
   * roll. Absent hides the control entirely, so a surface that has not wired
   * it up shows nothing rather than a button that does nothing.
   */
  onEnterRoll?: (request: { total: number; formula?: string; visibility: DiceVisibility }) => void;
  /**
   * Correct the result the server just returned. Separate from onEnterRoll
   * because it rewrites a roll that exists rather than recording a new one —
   * the id is the roller's own `result`.
   */
  onOverrideRoll?: (rollId: string, total: number) => void;
  onClose: () => void;
}

export const MobileDiceRoller: React.FC<MobileDiceRollerProps> = ({
  onRoll,
  latestOwnRoll,
  onEnterRoll,
  onOverrideRoll,
  onClose,
}) => {
  const {
    build,
    setBuild,
    mode,
    setMode,
    visibility,
    setVisibility,
    result,
    setResult,
    isAnimating,
    error,
    addDie,
    addModifier,
    clearBuild,
    roll,
    rollFormula,
  } = useDiceBuild({ onRoll, latestOwnRoll });

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
          maxHeight: "100%",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
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

        {/* Advantage / disadvantage and who sees it */}
        <RollOptions
          mode={mode}
          onModeChange={setMode}
          visibility={visibility}
          onVisibilityChange={setVisibility}
          disabled={isAnimating}
          compact
        />

        {/* Saved macros */}
        <MacroBar
          onRollMacro={rollFormula}
          currentFormula={build.length > 0 ? formulaFromBuild(build) : ""}
          currentMode={mode}
          disabled={isAnimating}
          compact
        />

        {/* Why a roll was refused — see the desktop roller for the reasoning. */}
        {error && (
          <div
            role="alert"
            data-testid="dice-error"
            style={{ color: "var(--hero-danger, #FF6B6B)", fontSize: "12px", textAlign: "center" }}
          >
            {error}
          </div>
        )}

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
            onClick={roll}
            variant="primary"
            disabled={build.length === 0 || isAnimating}
            aria-label="Roll dice"
            style={{ flex: 2, padding: "16px", fontSize: "18px", fontWeight: "bold" }}
          >
            ⚂ ROLL!
          </JRPGButton>
        </div>

        {/* Same control as the desktop roller, same slice — the standing rule
            is that a feature ships its mobile surface with it. */}
        {onEnterRoll && (
          <div style={{ marginTop: "12px" }}>
            <HandEntry
              testId="mobile-roller-hand-entry"
              compact
              label="✋ I ROLLED IT"
              prompt={
                formulaFromBuild(build)
                  ? `What did ${formulaFromBuild(build)} come to?`
                  : "What did you roll?"
              }
              onSubmit={(total) =>
                onEnterRoll({ total, formula: formulaFromBuild(build) || undefined, visibility })
              }
            />
          </div>
        )}
      </div>

      {/* Result Overlay - full-screen centered card so the total is always visible */}
      <MobileResultOverlay
        result={result}
        onClose={() => setResult(null)}
        onEnterRoll={
          onOverrideRoll && result ? (total) => onOverrideRoll(result.id, total) : undefined
        }
      />
    </div>
  );
};
