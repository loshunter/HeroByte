// ============================================================================
// ROLL RESULT CONTENT - shared breakdown/total body for roll result surfaces
// ============================================================================
// Rendered inside DraggableWindow on desktop (ResultPanel) and inside the
// mobile overlay card (MobileResultOverlay).

import React from "react";
import type { RollResult } from "./types";
import { DIE_SYMBOLS } from "./types";
import { detectRollFlavor } from "../../features/juice";
import { HandEntry } from "./HandEntry";

interface RollResultContentProps {
  result: RollResult;
  /** Cap the breakdown at 400px with its own scroller (desktop window mode).
   *  Pass false when the host surface owns scrolling (mobile overlay). */
  constrainHeight?: boolean;
  /**
   * Rewrite this roll with what was actually thrown. Absent hides the control —
   * a viewer who may not correct THIS roll is not shown a button that the
   * server would refuse. The server enforces the same rule regardless.
   */
  onEnterRoll?: (total: number) => void;
}

export const RollResultContent: React.FC<RollResultContentProps> = ({
  result,
  constrainHeight = true,
  onEnterRoll,
}) => {
  const flavor = detectRollFlavor(result);
  const totalFlourish =
    flavor === "crit" ? " juice-crit" : flavor === "fumble" ? " juice-fumble" : "";

  return (
    <div style={{ animation: "panelSlideIn 300ms ease-out" }}>
      {/* Breakdown */}
      <div
        style={{
          padding: "20px",
          ...(constrainHeight
            ? {
                maxHeight: "400px",
                overflowY: "auto" as const,
                overscrollBehavior: "contain" as const,
              }
            : {}),
        }}
      >
        {result.perDie.map((roll) => {
          // Rendered from the breakdown ALONE. This used to pair perDie[i]
          // with a `tokens[i]` from the build that produced the roll — which
          // no history entry has, so every roll opened from the log bailed out
          // here and showed a bare total. The server sends the die and its
          // faces on the entry itself; nothing else is needed.
          const qty = roll.rolls?.length ?? 0;
          const negated = roll.subtotal < 0;

          return (
            <div
              key={roll.tokenId}
              style={{
                padding: "12px",
                marginBottom: "8px",
                background: "rgba(0,0,0,0.3)",
                border: "2px solid rgba(240,226,195,0.2)",
                borderRadius: "6px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {/* Term label */}
                {roll.die ? (
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: "bold",
                      color: "var(--hero-gold-light)",
                    }}
                  >
                    {DIE_SYMBOLS[roll.die]} {negated ? "−" : ""}
                    {qty > 1 ? `${qty}${roll.die}` : roll.die}
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: "16px",
                      fontWeight: "bold",
                      color: "var(--hero-gold)",
                    }}
                  >
                    {roll.subtotal >= 0 ? `+${roll.subtotal}` : roll.subtotal}
                  </div>
                )}

                {/* Rolls breakdown */}
                {roll.rolls && roll.rolls.length > 0 && (
                  <div style={{ fontSize: "14px", color: "var(--hero-text-dim)" }}>
                    [{roll.rolls.join(" + ")}]
                  </div>
                )}

                {/* What advantage/disadvantage threw away */}
                {roll.dropped && roll.dropped.length > 0 && (
                  <div
                    data-testid="roll-dropped"
                    title={
                      result.handEntered
                        ? "Superseded by a hand-entered result"
                        : "Discarded by advantage/disadvantage"
                    }
                    style={{
                      fontSize: "14px",
                      color: "var(--hero-text-dim)",
                      opacity: 0.6,
                      textDecoration: "line-through",
                    }}
                  >
                    [{roll.dropped.join(" + ")}]
                  </div>
                )}
              </div>

              {/* Subtotal */}
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: "bold",
                  color: "var(--hero-gold)",
                  minWidth: "60px",
                  textAlign: "right",
                }}
              >
                {roll.subtotal}
              </div>
            </div>
          );
        })}

        {/* Divider */}
        <div
          style={{
            height: "3px",
            background:
              "linear-gradient(90deg, transparent 0%, var(--hero-gold) 50%, transparent 100%)",
            margin: "16px 0",
          }}
        />

        {/* Crit / fumble banner */}
        {flavor === "crit" && (
          <div className="juice-roll-banner juice-roll-banner--crit" data-testid="roll-banner-crit">
            ★ CRITICAL! ★
          </div>
        )}
        {flavor === "fumble" && (
          <div
            className="juice-roll-banner juice-roll-banner--fumble"
            data-testid="roll-banner-fumble"
          >
            ✖ FUMBLE! ✖
          </div>
        )}

        {/* Total */}
        <div
          className={`juice-total${totalFlourish}`}
          style={{
            position: "relative",
            padding: "16px",
            background:
              "linear-gradient(135deg, rgba(68,125,247,0.2) 0%, rgba(255,195,77,0.2) 100%)",
            border: "3px solid var(--hero-gold)",
            borderRadius: "8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 0 20px rgba(240,226,195,0.3)",
            animation: "totalGlow 1s ease-out",
          }}
        >
          <div
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: "var(--hero-gold-light)",
              fontFamily: "var(--font-pixel)",
            }}
          >
            {result.handEntered ? "ENTERED" : "TOTAL"}
          </div>
          <div
            style={{
              fontSize: "36px",
              fontWeight: "bold",
              color: "var(--hero-gold)",
              fontFamily: "var(--font-pixel)",
              textShadow: "0 0 12px rgba(255,195,77,0.8), 2px 2px 0 var(--hero-navy-dark)",
            }}
            data-testid="roll-result-total"
          >
            {result.handEntered && result.supersededTotal !== undefined ? (
              <span
                data-testid="roll-result-superseded"
                style={{
                  fontSize: "20px",
                  textDecoration: "line-through",
                  opacity: 0.55,
                  marginRight: "10px",
                  textShadow: "none",
                }}
              >
                {result.supersededTotal}
              </span>
            ) : null}
            {result.total}
          </div>
        </div>

        {/* The after-the-fact half of the feature: the server rolled, the table
            rolled too, and the table's number is the real one. Rewrites the row
            in place rather than appending — one row showing both, which is what
            "record the original and strike it out" means. */}
        {onEnterRoll && (
          <div style={{ marginTop: "12px", display: "flex", justifyContent: "center" }}>
            <HandEntry
              testId="result-hand-entry"
              label={result.handEntered ? "✋ CHANGE IT AGAIN" : "✋ THAT'S NOT WHAT I ROLLED"}
              prompt="What did you actually roll?"
              onSubmit={onEnterRoll}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// Add animations to CSS
const style = document.createElement("style");
style.textContent = `
  @keyframes panelSlideIn {
    from {
      opacity: 0;
      transform: scale(0.9) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  @keyframes totalGlow {
    0%, 100% {
      box-shadow: 0 0 20px rgba(240,226,195,0.3);
    }
    50% {
      box-shadow: 0 0 40px rgba(240,226,195,0.8);
    }
  }

  @keyframes diceBounce {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-8px);
    }
  }

  @keyframes diceSpin {
    0% {
      transform: rotate(0deg) scale(1);
    }
    25% {
      transform: rotate(90deg) scale(1.1);
    }
    50% {
      transform: rotate(180deg) scale(1);
    }
    75% {
      transform: rotate(270deg) scale(1.1);
    }
    100% {
      transform: rotate(360deg) scale(1);
    }
  }

  .dice-token.animating {
    animation: diceBounce 400ms ease-in-out, diceSpin 600ms ease-in-out;
  }

  .dice-token.mod.animating {
    animation: diceBounce 400ms ease-in-out;
  }
`;
document.head.appendChild(style);
