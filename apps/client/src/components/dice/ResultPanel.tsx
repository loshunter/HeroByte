// ============================================================================
// RESULT PANEL - SNES-style breakdown window
// ============================================================================

import React from 'react';
import type { RollResult } from './types';
import { formatRollText } from './diceLogic';
import { DIE_SYMBOLS } from './types';
import { DraggableWindow } from './DraggableWindow';

interface ResultPanelProps {
  result: RollResult | null;
  onClose: () => void;
}

export const ResultPanel: React.FC<ResultPanelProps> = ({ result, onClose }) => {
  if (!result) return null;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(formatRollText(result));
  };

  return (
    <DraggableWindow
      title="⚂ ROLL RESULT ⚂"
      onClose={onClose}
      initialX={200}
      initialY={150}
      width={500}
      minWidth={400}
      maxWidth={600}
      zIndex={1001}
    >
      <div style={{ animation: 'panelSlideIn 300ms ease-out' }}>

        {/* Breakdown */}
        <div
          style={{
            padding: '20px',
            maxHeight: '400px',
            overflowY: 'auto',
          }}
        >
          {result.perDie.map((roll, index) => {
            // Defensive check: ensure token exists at this index
            if (index >= result.tokens.length) {
              console.warn(`Token missing for roll at index ${index}`);
              return null;
            }
            const token = result.tokens[index];
            if (!token) return null;

            return (
              <div
                key={roll.tokenId}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '2px solid rgba(240,226,195,0.2)',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Token label */}
                  {token.kind === 'die' ? (
                    <div
                      style={{
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: 'var(--hero-gold-light)',
                      }}
                    >
                      {DIE_SYMBOLS[token.die]} {token.qty > 1 ? `${token.qty}${token.die}` : token.die}
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: 'var(--hero-gold)',
                      }}
                    >
                      {token.value >= 0 ? `+${token.value}` : token.value}
                    </div>
                  )}

                  {/* Rolls breakdown */}
                  {roll.rolls && roll.rolls.length > 0 && (
                    <div style={{ fontSize: '14px', color: 'var(--hero-text-dim)' }}>
                      [{roll.rolls.join(' + ')}]
                    </div>
                  )}
                </div>

                {/* Subtotal */}
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: 'var(--hero-gold)',
                    minWidth: '60px',
                    textAlign: 'right',
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
              height: '3px',
              background: 'linear-gradient(90deg, transparent 0%, var(--hero-gold) 50%, transparent 100%)',
              margin: '16px 0',
            }}
          />

          {/* Total */}
          <div
            style={{
              padding: '16px',
              background: 'linear-gradient(135deg, rgba(68,125,247,0.2) 0%, rgba(255,195,77,0.2) 100%)',
              border: '3px solid var(--hero-gold)',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 0 20px rgba(240,226,195,0.3)',
              animation: 'totalGlow 1s ease-out',
            }}
          >
            <div
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: 'var(--hero-gold-light)',
                fontFamily: 'var(--font-pixel)',
              }}
            >
              TOTAL
            </div>
            <div
              style={{
                fontSize: '36px',
                fontWeight: 'bold',
                color: 'var(--hero-gold)',
                fontFamily: 'var(--font-pixel)',
                textShadow: '0 0 12px rgba(255,195,77,0.8), 2px 2px 0 var(--hero-navy-dark)',
              }}
            >
              {result.total}
            </div>
          </div>

          {/* Copy button */}
          <button
            onClick={copyToClipboard}
            className="btn"
            style={{
              width: '100%',
              marginTop: '16px',
              padding: '12px',
              fontSize: '14px',
            }}
          >
            📋 Copy as Text
          </button>
        </div>
      </div>
    </DraggableWindow>
  );
};

// Add animations to CSS
const style = document.createElement('style');
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
