// ============================================================================
// DICE ROLLER - Main orchestrator component
// ============================================================================

import React, { useState } from 'react';
import type { Build, DieType, RollResult } from './types';
import { rollBuild } from './diceLogic';
import { DiceBar } from './DiceBar';
import { BuildStrip } from './BuildStrip';
import { RollButton } from './RollButton';
import { ResultPanel } from './ResultPanel';
import { DraggableWindow } from './DraggableWindow';
import { JRPGPanel, JRPGButton } from '../ui/JRPGPanel';

// Safari-compatible UUID generator
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for Safari and older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface DiceRollerProps {
  onRoll?: (result: RollResult) => void;
  onClose?: () => void;
}

export const DiceRoller: React.FC<DiceRollerProps> = ({ onRoll, onClose }) => {
  const [build, setBuild] = useState<Build>([]);
  const [result, setResult] = useState<RollResult | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const addDie = (die: DieType) => {
    console.log('[DiceRoller] addDie called with:', die);
    // Check if die already exists in build
    const existing = build.find((t) => t.kind === 'die' && t.die === die);
    if (existing) {
      console.log('[DiceRoller] Incrementing existing die');
      // Increment quantity
      setBuild(
        build.map((t) =>
          t.id === existing.id && t.kind === 'die' ? { ...t, qty: t.qty + 1 } : t
        )
      );
    } else {
      console.log('[DiceRoller] Adding new die');
      // Add new die token
      setBuild([...build, { kind: 'die', die, qty: 1, id: generateUUID() }]);
    }
  };

  const addModifier = (value: number) => {
    console.log('[DiceRoller] addModifier called with:', value);
    setBuild([...build, { kind: 'mod', value, id: generateUUID() }]);
  };

  const handleRoll = () => {
    console.log('[DiceRoller] handleRoll called, build length:', build.length, 'isAnimating:', isAnimating);
    if (build.length === 0) return;

    setIsAnimating(true);
    console.log('[DiceRoller] Set isAnimating to true');

    // Roll after animation delay
    setTimeout(() => {
      console.log('[DiceRoller] Timeout callback executing');
      const rollResult = rollBuild(build);
      setResult(rollResult);
      setIsAnimating(false);
      console.log('[DiceRoller] Set isAnimating to false');

      // Notify parent component
      if (onRoll) {
        onRoll(rollResult);
      }
    }, 600); // Match animation duration
  };

  const clearBuild = () => {
    setBuild([]);
    setResult(null);
  };

  return (
    <DraggableWindow
      title="⚂ DICE ROLLER"
      onClose={onClose}
      initialX={100}
      initialY={100}
      width={600}
      minWidth={500}
      maxWidth={800}
      zIndex={1000}
    >
      <JRPGPanel variant="bevel" style={{ padding: '8px' }}>
        <div
          className="dice-roller"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* Header */}
          {build.length > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <JRPGButton
                onClick={clearBuild}
                variant="danger"
                style={{
                  padding: '6px 12px',
                  fontSize: '8px',
                }}
              >
                CLEAR
              </JRPGButton>
            </div>
          )}

        {/* Dice selection bar */}
        <DiceBar onAddDie={addDie} onAddModifier={addModifier} />

        {/* Build strip */}
        <JRPGPanel variant="simple" style={{ minHeight: '96px', padding: '8px' }}>
          <BuildStrip build={build} onUpdateBuild={setBuild} isAnimating={isAnimating} />
        </JRPGPanel>

        {/* Roll button */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <JRPGButton
            onClick={handleRoll}
            disabled={build.length === 0 || isAnimating}
            variant="primary"
            style={{
              padding: '12px 48px',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            ⚂ ROLL!
          </JRPGButton>
        </div>

        {/* Result panel */}
        {result && <ResultPanel result={result} onClose={() => setResult(null)} />}
        </div>
      </JRPGPanel>
    </DraggableWindow>
  );
};
