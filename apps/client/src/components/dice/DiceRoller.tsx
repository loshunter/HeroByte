// ============================================================================
// DICE ROLLER - Main orchestrator component
// ============================================================================
// The build strip, the options, and the macros. It does NOT roll: it asks the
// server to, and shows the answer the snapshot brings back (S5). All of that
// lives in useDiceBuild, shared with MobileDiceRoller.

import React from "react";
import { useDiceBuild } from "./useDiceBuild";
import { formulaFromBuild } from "./diceLogic";
import type { RollLogEntry } from "./rollLogTypes";
import type { DiceRollMode, DiceVisibility } from "./types";
import { DiceBar } from "./DiceBar";
import { BuildStrip } from "./BuildStrip";
import { MacroBar } from "./MacroBar";
import { ResultPanel } from "./ResultPanel";
import { RollOptions } from "./RollOptions";
import { HandEntry } from "./HandEntry";
import { DraggableWindow } from "./DraggableWindow";
import { JRPGPanel, JRPGButton } from "../ui/JRPGPanel";

interface DiceRollerProps {
  /** Ask the server to roll. The result returns through `latestOwnRoll`. */
  onRoll?: (request: { formula: string; mode: DiceRollMode; visibility: DiceVisibility }) => void;
  /** Newest roll in history authored by this player. */
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
  onClose?: () => void;
}

export const DiceRoller: React.FC<DiceRollerProps> = ({
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

  return (
    <DraggableWindow
      title="⚂ DICE ROLLER"
      onClose={onClose}
      initialX={100}
      initialY={100}
      width={600}
      minWidth={500}
      maxWidth={800}
      storageKey="dice-roller"
      zIndex={1000}
    >
      <JRPGPanel variant="bevel" style={{ padding: "8px" }}>
        <div
          className="dice-roller"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {/* Header */}
          {build.length > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <JRPGButton
                onClick={clearBuild}
                variant="danger"
                style={{
                  padding: "6px 12px",
                  fontSize: "8px",
                }}
              >
                CLEAR
              </JRPGButton>
            </div>
          )}

          {/* Dice selection bar */}
          <DiceBar onAddDie={addDie} onAddModifier={addModifier} />

          {/* Build strip */}
          <JRPGPanel variant="simple" style={{ minHeight: "96px", padding: "8px" }}>
            <BuildStrip build={build} onUpdateBuild={setBuild} isAnimating={isAnimating} />
          </JRPGPanel>

          {/* Advantage / disadvantage and who sees it */}
          <RollOptions
            mode={mode}
            onModeChange={setMode}
            visibility={visibility}
            onVisibilityChange={setVisibility}
            disabled={isAnimating}
          />

          {/* Saved macros */}
          <MacroBar
            onRollMacro={rollFormula}
            currentFormula={build.length > 0 ? formulaFromBuild(build) : ""}
            currentMode={mode}
            disabled={isAnimating}
          />

          {/* Why a roll was refused. The build strip can assemble more dice or
              more terms than the server accepts; saying so beats a roll that
              silently never happens. */}
          {error && (
            <div
              role="alert"
              data-testid="dice-error"
              style={{
                color: "var(--hero-danger, #FF6B6B)",
                fontSize: "10px",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          {/* Roll button */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <JRPGButton
              onClick={roll}
              disabled={build.length === 0 || isAnimating}
              variant="primary"
              aria-label="Roll dice"
              style={{
                padding: "12px 48px",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              ⚂ ROLL!
            </JRPGButton>
          </div>

          {/* Typing a result is NOT gated on a build: "I rolled 17, put it on
              the table" is the fastest path at a physical table, and the server
              makes the total its own notation when no dice were named. */}
          {onEnterRoll && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: "8px" }}>
              <HandEntry
                testId="roller-hand-entry"
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

          {/* Result panel */}
          {result && (
            <ResultPanel
              result={result}
              onClose={() => setResult(null)}
              onEnterRoll={
                onOverrideRoll && result ? (total) => onOverrideRoll(result.id, total) : undefined
              }
            />
          )}
        </div>
      </JRPGPanel>
    </DraggableWindow>
  );
};
