// ============================================================================
// ROLL LOG - Scrollable history of all rolls
// ============================================================================

import React, { useState } from "react";
import type { RollResult } from "./types";
import { DIE_SYMBOLS } from "./types";
import { DraggableWindow } from "./DraggableWindow";
import { JRPGPanel, JRPGButton } from "../ui/JRPGPanel";
import { sanitizeText } from "../../utils/sanitize";

interface RollLogEntry extends RollResult {
  playerName: string;
}

interface RollLogProps {
  rolls: RollLogEntry[];
  onClearLog: () => void;
  onViewRoll: (roll: RollLogEntry) => void;
  onClose?: () => void;
}

/**
 * Helper to format a roll formula as compact text
 * Example: "2d20 + 3d6 + 5"
 */
function formatFormulaCompact(tokens: RollResult["tokens"]): string {
  const parts: string[] = [];
  for (const token of tokens) {
    if (token.kind === "die") {
      parts.push(token.qty > 1 ? `${token.qty}${token.die}` : token.die);
    } else {
      if (parts.length === 0) {
        // First token is a modifier
        parts.push(`${token.value}`);
      } else {
        parts.push(token.value >= 0 ? `+${token.value}` : `${token.value}`);
      }
    }
  }
  return parts.join(" ");
}

/**
 * Check if a formula is "long" (likely to wrap or cause readability issues)
 * Consider it long if it has 5+ tokens or estimated character length > 30
 */
function isLongFormula(tokens: RollResult["tokens"]): boolean {
  if (tokens.length >= 5) return true;
  const formulaText = formatFormulaCompact(tokens);
  return formulaText.length > 30;
}

/**
 * Component for rendering a single roll entry
 * Handles both compact and expanded views for long formulas
 */
const RollEntry: React.FC<{
  roll: RollLogEntry;
  onViewRoll: (roll: RollLogEntry) => void;
}> = ({ roll, onViewRoll }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = isLongFormula(roll.tokens);
  const formulaText = formatFormulaCompact(roll.tokens);

  return (
    <div
      onClick={() => onViewRoll(roll)}
      className="jrpg-frame-simple"
      style={{
        padding: "8px",
        cursor: "pointer",
        transition: "none",
      }}
      data-testid="roll-log-entry"
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--jrpg-border-highlight)";
        e.currentTarget.style.boxShadow =
          "0 0 8px var(--jrpg-border-highlight), inset 0 0 0 1px var(--jrpg-border-shadow), 0 2px 0 var(--jrpg-border-shadow)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--jrpg-border-gold)";
        e.currentTarget.style.boxShadow =
          "inset 0 0 0 1px var(--jrpg-border-shadow), 0 2px 0 var(--jrpg-border-shadow)";
      }}
    >
      {/* Player name and timestamp */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "6px",
        }}
      >
        <div
          className="jrpg-text-small"
          style={{
            fontWeight: "bold",
            color: "var(--jrpg-gold)",
          }}
        >
          {sanitizeText(roll.playerName)}
        </div>
        <div
          className="jrpg-text-small"
          style={{
            color: "var(--jrpg-white)",
            opacity: 0.6,
          }}
        >
          {new Date(roll.timestamp).toLocaleTimeString()}
        </div>
      </div>

      {/* Roll formula - improved formatting for long formulas */}
      <div
        className="jrpg-text-small"
        style={{
          color: "var(--jrpg-white)",
          marginBottom: "4px",
          position: "relative",
        }}
        title={isLong ? formulaText : undefined}
      >
        {isLong && !isExpanded ? (
          // Compact view for long formulas: show text format with expand button
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {formulaText}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(true);
              }}
              style={{
                background: "transparent",
                border: "1px solid var(--jrpg-border-gold)",
                color: "var(--jrpg-gold)",
                padding: "2px 6px",
                fontSize: "10px",
                cursor: "pointer",
                flexShrink: 0,
              }}
              title="Expand formula"
            >
              ⋯
            </button>
          </div>
        ) : (
          // Full view with symbols (for short formulas or expanded long ones)
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                flexWrap: "wrap",
                lineHeight: "1.6",
              }}
            >
              {roll.tokens.map((token, idx) => (
                <React.Fragment key={token.id}>
                  {idx > 0 && token.kind === "mod" && token.value >= 0 && (
                    <span style={{ opacity: 0.7 }}>+</span>
                  )}
                  {idx > 0 && token.kind === "mod" && token.value < 0 && (
                    <span style={{ opacity: 0.7 }}>−</span>
                  )}
                  {token.kind === "die" ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "2px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ fontSize: "12px" }}>{DIE_SYMBOLS[token.die]}</span>
                      <span>{token.qty > 1 ? `${token.qty}${token.die}` : token.die}</span>
                    </span>
                  ) : (
                    <span style={{ whiteSpace: "nowrap" }}>{Math.abs(token.value)}</span>
                  )}
                </React.Fragment>
              ))}
            </div>
            {isLong && isExpanded && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(false);
                }}
                style={{
                  background: "transparent",
                  border: "1px solid var(--jrpg-border-gold)",
                  color: "var(--jrpg-gold)",
                  padding: "2px 6px",
                  fontSize: "10px",
                  cursor: "pointer",
                  marginTop: "4px",
                }}
                title="Collapse formula"
              >
                Collapse
              </button>
            )}
          </div>
        )}
      </div>

      {/* Total result with breakdown hint for complex formulas */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          className="jrpg-text-command"
          style={{
            fontSize: "16px",
            color: "var(--jrpg-gold)",
            textShadow: "2px 2px 0 var(--jrpg-border-shadow)",
          }}
        >
          = {roll.total}
        </div>
        {isLong && (
          <div
            className="jrpg-text-small"
            style={{
              color: "var(--jrpg-white)",
              opacity: 0.5,
              fontSize: "9px",
            }}
          >
            Click for breakdown
          </div>
        )}
      </div>
    </div>
  );
};

export const RollLog: React.FC<RollLogProps> = ({ rolls, onClearLog, onViewRoll, onClose }) => {
  return (
    <DraggableWindow
      title="⚂ ROLL LOG"
      onClose={onClose}
      initialX={window.innerWidth - 420}
      initialY={100}
      width={400}
      minWidth={350}
      maxWidth={500}
      height={600}
      storageKey="roll-log"
      zIndex={999}
    >
      <JRPGPanel
        variant="bevel"
        style={{ padding: "8px", height: "100%", display: "flex", flexDirection: "column" }}
      >
        {/* Clear button */}
        {rolls.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
            <JRPGButton
              onClick={onClearLog}
              variant="danger"
              style={{ fontSize: "8px", padding: "6px 12px" }}
            >
              CLEAR
            </JRPGButton>
          </div>
        )}

        {/* Roll entries */}
        <JRPGPanel variant="simple" style={{ flex: 1, overflow: "auto", padding: "8px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {rolls.length === 0 ? (
              <div
                className="jrpg-text-small"
                style={{
                  textAlign: "center",
                  color: "var(--jrpg-white)",
                  opacity: 0.5,
                  padding: "20px",
                }}
              >
                No rolls yet...
              </div>
            ) : (
              rolls
                .slice()
                .reverse()
                .map((roll) => <RollEntry key={roll.id} roll={roll} onViewRoll={onViewRoll} />)
            )}
          </div>
        </JRPGPanel>
      </JRPGPanel>
    </DraggableWindow>
  );
};
