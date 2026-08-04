// ============================================================================
// MACRO BAR — the rolls you make every session, one tap away
// ============================================================================
// Shared by both roller surfaces. Built-ins are always present; saved macros
// are client-local (see diceMacros.ts for why) and can be removed.

import React, { useCallback, useState } from "react";
import type { DiceRollMode } from "@herobyte/shared";
import { JRPGButton } from "../ui/JRPGPanel";
import { BUILTIN_MACROS, deleteMacro, loadMacros, saveMacro, type DiceMacro } from "./diceMacros";

interface MacroBarProps {
  /** Roll a macro. Its own mode wins over whatever the panel has selected. */
  onRollMacro: (formula: string, mode: DiceRollMode) => void;
  /** The formula the build strip currently describes, or "" when it is empty. */
  currentFormula: string;
  currentMode: DiceRollMode;
  disabled?: boolean;
  compact?: boolean;
}

export const MacroBar: React.FC<MacroBarProps> = ({
  onRollMacro,
  currentFormula,
  currentMode,
  disabled = false,
  compact = false,
}) => {
  const [saved, setSaved] = useState<DiceMacro[]>(() => loadMacros());
  const [naming, setNaming] = useState(false);
  const [label, setLabel] = useState("");

  const commitSave = useCallback(() => {
    if (!currentFormula || !label.trim()) {
      setNaming(false);
      setLabel("");
      return;
    }
    setSaved(saveMacro(label, currentFormula, currentMode));
    setNaming(false);
    setLabel("");
  }, [currentFormula, currentMode, label]);

  const buttonStyle = compact
    ? { padding: "10px 12px", fontSize: "11px" }
    : { padding: "6px 10px", fontSize: "8px" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div
        role="group"
        aria-label="Dice macros"
        style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}
      >
        {[...BUILTIN_MACROS, ...saved].map((macro) => (
          <span key={macro.id} style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
            <JRPGButton
              onClick={() => onRollMacro(macro.formula, macro.mode)}
              disabled={disabled}
              title={`Roll ${macro.formula}${macro.mode === "normal" ? "" : ` (${macro.mode})`}`}
              style={buttonStyle}
            >
              {macro.label}
            </JRPGButton>
            {!macro.id.startsWith("builtin-") && (
              <button
                type="button"
                aria-label={`Delete macro ${macro.label}`}
                onClick={() => setSaved(deleteMacro(macro.id))}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--hero-text-dim)",
                  cursor: "pointer",
                  fontSize: "10px",
                  padding: "2px",
                }}
              >
                ✕
              </button>
            )}
          </span>
        ))}

        {currentFormula && !naming && (
          <JRPGButton
            onClick={() => setNaming(true)}
            disabled={disabled}
            title={`Save "${currentFormula}" as a macro on this device`}
            style={buttonStyle}
          >
            + SAVE
          </JRPGButton>
        )}
      </div>

      {naming && (
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <input
            autoFocus
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitSave();
              if (event.key === "Escape") {
                setNaming(false);
                setLabel("");
              }
            }}
            maxLength={24}
            aria-label="Macro name"
            placeholder={currentFormula}
            style={{
              flex: 1,
              minWidth: 0,
              padding: compact ? "10px" : "6px",
              fontSize: compact ? "12px" : "10px",
              background: "rgba(0,0,0,0.4)",
              border: "1px solid var(--hero-gold)",
              color: "var(--jrpg-white)",
            }}
          />
          <JRPGButton onClick={commitSave} variant="primary" style={buttonStyle}>
            SAVE
          </JRPGButton>
        </div>
      )}
    </div>
  );
};
