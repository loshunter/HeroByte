// ============================================================================
// ROLL LOG - Scrollable history of all rolls
// ============================================================================

import React from "react";
import type { RollResult } from "./types";
import { DIE_SYMBOLS } from "./types";
import { DraggableWindow } from "./DraggableWindow";
import { JRPGPanel, JRPGButton } from "../ui/JRPGPanel";

interface RollLogEntry extends RollResult {
  playerName: string;
}

interface RollLogProps {
  rolls: RollLogEntry[];
  onClearLog: () => void;
  onViewRoll: (roll: RollLogEntry) => void;
  onClose?: () => void;
}

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
                .map((roll) => (
                  <div
                    key={roll.id}
                    onClick={() => onViewRoll(roll)}
                    className="jrpg-frame-simple"
                    style={{
                      padding: "8px",
                      cursor: "pointer",
                      transition: "none",
                    }}
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
                        {roll.playerName}
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

                    {/* Roll formula */}
                    <div
                      className="jrpg-text-small"
                      style={{
                        color: "var(--jrpg-white)",
                        marginBottom: "4px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        flexWrap: "wrap",
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
                            <span>
                              {DIE_SYMBOLS[token.die]}{" "}
                              {token.qty > 1 ? `${token.qty}${token.die}` : token.die}
                            </span>
                          ) : (
                            <span>{Math.abs(token.value)}</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Total result */}
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
                  </div>
                ))
            )}
          </div>
        </JRPGPanel>
      </JRPGPanel>
    </DraggableWindow>
  );
};
