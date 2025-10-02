// ============================================================================
// ROLL LOG - Scrollable history of all rolls
// ============================================================================

import React from 'react';
import type { RollResult } from './types';
import { formatRollText } from './diceLogic';
import { DIE_SYMBOLS } from './types';

interface RollLogEntry extends RollResult {
  playerName: string;
}

interface RollLogProps {
  rolls: RollLogEntry[];
  onClearLog: () => void;
  onViewRoll: (roll: RollLogEntry) => void;
}

export const RollLog: React.FC<RollLogProps> = ({ rolls, onClearLog, onViewRoll }) => {
  return (
    <div
      className="roll-log"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background:
          'repeating-conic-gradient(rgba(255,255,255,0.02) 0% 25%, transparent 0% 50%) 50% / 2px 2px, linear-gradient(180deg, #2a2845 0%, #1a1835 50%, #0f0e2a 100%)',
        border: '6px solid var(--hero-gold)',
        borderRadius: '12px',
        boxShadow:
          '0 0 0 2px var(--hero-navy-dark), 0 8px 16px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.1)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(90deg, var(--hero-gold) 0%, var(--hero-gold-light) 50%, var(--hero-gold) 100%)',
          padding: '12px 20px',
          color: 'var(--hero-navy-dark)',
          fontSize: '18px',
          fontWeight: 'bold',
          fontFamily: 'var(--font-pixel)',
          textAlign: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>⚂ ROLL LOG</span>
        {rolls.length > 0 && (
          <button
            onClick={onClearLog}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              background: 'var(--hero-danger)',
              border: '2px solid var(--hero-navy-dark)',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Roll entries */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {rolls.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--hero-text-dim)',
              fontSize: '14px',
              fontStyle: 'italic',
              padding: '20px',
            }}
          >
            No rolls yet...
          </div>
        ) : (
          rolls.slice().reverse().map((roll) => (
            <div
              key={roll.id}
              onClick={() => onViewRoll(roll)}
              style={{
                padding: '12px',
                background: 'rgba(0,0,0,0.3)',
                border: '2px solid rgba(240,226,195,0.2)',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--hero-gold)';
                e.currentTarget.style.background = 'rgba(0,0,0,0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(240,226,195,0.2)';
                e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
              }}
            >
              {/* Player name and timestamp */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: 'var(--hero-gold-light)',
                  }}
                >
                  {roll.playerName}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--hero-text-dim)',
                  }}
                >
                  {new Date(roll.timestamp).toLocaleTimeString()}
                </div>
              </div>

              {/* Roll formula */}
              <div
                style={{
                  fontSize: '13px',
                  color: 'var(--hero-text-light)',
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  flexWrap: 'wrap',
                }}
              >
                {roll.tokens.map((token, idx) => (
                  <React.Fragment key={token.id}>
                    {idx > 0 && token.kind === 'mod' && token.value >= 0 && (
                      <span style={{ color: 'var(--hero-text-dim)' }}>+</span>
                    )}
                    {idx > 0 && token.kind === 'mod' && token.value < 0 && (
                      <span style={{ color: 'var(--hero-text-dim)' }}>−</span>
                    )}
                    {token.kind === 'die' ? (
                      <span>
                        {DIE_SYMBOLS[token.die]} {token.qty > 1 ? `${token.qty}${token.die}` : token.die}
                      </span>
                    ) : (
                      <span>{Math.abs(token.value)}</span>
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Total result */}
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: 'var(--hero-gold)',
                  fontFamily: 'var(--font-pixel)',
                  textShadow: '0 0 8px rgba(255,195,77,0.6), 2px 2px 0 var(--hero-navy-dark)',
                }}
              >
                = {roll.total}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
