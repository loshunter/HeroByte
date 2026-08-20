// ============================================================================
// ROLL ENTRY - one row of the roll log
// ============================================================================
// Extracted from RollLog.tsx (2026-08-02), unchanged. It was ~195 of that
// file's 317 lines, and RollLog is not protected by the 350-LOC guard (the
// guard only fails on NEW violators), so the chat tab had ~32 lines of
// headroom to work with. Moving the roll-specific rendering out gives the
// shell room to host two tabs instead.

import React, { useState } from "react";
import { DIE_SYMBOLS } from "./types";
import { sanitizeText } from "../../utils/sanitize";
import type { RollLogEntry } from "./rollLogTypes";

/**
 * Check if a formula is "long" (likely to wrap or cause readability issues)
 * Consider it long if it has 5+ terms or is over 30 characters.
 */
function isLongFormula(roll: RollLogEntry): boolean {
  if (roll.perDie.length >= 5) return true;
  return roll.formula.length > 30;
}

/** ADV / DIS / who could see it — the two things a total alone cannot say. */
function badgesFor(roll: RollLogEntry): string[] {
  const badges: string[] = [];
  if (roll.mode === "advantage") badges.push("ADV");
  if (roll.mode === "disadvantage") badges.push("DIS");
  if (roll.visibility === "dm") badges.push("DM ONLY");
  if (roll.visibility === "self") badges.push("PRIVATE");
  return badges;
}

/**
 * Component for rendering a single roll entry
 * Handles both compact and expanded views for long formulas
 */
export const RollEntry: React.FC<{
  roll: RollLogEntry;
  onViewRoll: (roll: RollLogEntry) => void;
}> = ({ roll, onViewRoll }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  // The formula is the SERVER's canonical string now, and the breakdown
  // carries each term's die. Both used to be read off a `tokens` array that
  // history entries never had — which is why every row in this log rendered a
  // blank formula line in production.
  const isLong = isLongFormula(roll);
  const formulaText = roll.formula;
  const badges = badgesFor(roll);

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
          {/* What the roll was FOR, when the server said. Sits next to the
              roller rather than replacing them: a DM rolling for five goblins
              needs both "who pressed it" and "which creature this is". */}
          {roll.label ? (
            <span
              data-testid="roll-label"
              style={{
                marginLeft: "6px",
                color: "var(--jrpg-white)",
                fontWeight: "normal",
                opacity: 0.85,
              }}
            >
              {sanitizeText(roll.label)}
            </span>
          ) : null}
          {badges.map((badge) => (
            <span
              key={badge}
              data-testid="roll-badge"
              style={{
                marginLeft: "6px",
                padding: "1px 4px",
                fontSize: "8px",
                border: "1px solid var(--jrpg-border-gold)",
                color: "var(--jrpg-white)",
                opacity: 0.8,
              }}
            >
              {badge}
            </span>
          ))}
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
              {roll.perDie.map((term, idx) => {
                const qty = term.rolls?.length ?? 0;
                const negated = term.subtotal < 0;
                return (
                  <React.Fragment key={term.tokenId}>
                    {idx > 0 && <span style={{ opacity: 0.7 }}>{negated ? "−" : "+"}</span>}
                    {term.die ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "2px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span style={{ fontSize: "12px" }}>{DIE_SYMBOLS[term.die]}</span>
                        <span>{qty > 1 ? `${qty}${term.die}` : term.die}</span>
                      </span>
                    ) : (
                      <span style={{ whiteSpace: "nowrap" }}>{Math.abs(term.subtotal)}</span>
                    )}
                  </React.Fragment>
                );
              })}
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
