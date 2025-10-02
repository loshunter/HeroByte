// ============================================================================
// DICE LOGIC - SECURE RNG ENGINE
// ============================================================================

import type { Build, DieType, RollResult } from './types';

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

/**
 * Secure random integer generator using crypto API
 * Returns integer in range [min, max] inclusive
 */
export function rngIntSecure(min: number, max: number): number {
  const range = max - min + 1;
  const buf = new Uint32Array(1);
  let x: number;

  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= Math.floor(0xffffffff / range) * range);

  return min + (x % range);
}

const DIE_FACES: Record<DieType, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100: 100,
};

/**
 * Roll a complete build and return detailed results
 */
export function rollBuild(build: Build): RollResult {
  const perDie: RollResult['perDie'] = [];
  let total = 0;

  for (const token of build) {
    if (token.kind === 'die') {
      const faces = DIE_FACES[token.die];
      const rolls = Array.from({ length: token.qty }, () => rngIntSecure(1, faces));
      const subtotal = rolls.reduce((a, b) => a + b, 0);

      perDie.push({
        tokenId: token.id,
        die: token.die,
        rolls,
        subtotal,
      });

      total += subtotal;
    } else {
      // Modifier
      perDie.push({
        tokenId: token.id,
        subtotal: token.value,
      });

      total += token.value;
    }
  }

  return {
    id: generateUUID(),
    tokens: build,
    perDie,
    total,
    timestamp: Date.now(),
  };
}

/**
 * Format roll result as copyable text
 * Example: "1d20 + 3d4 + 3 → 26"
 */
export function formatRollText(result: RollResult): string {
  const parts: string[] = [];

  for (const token of result.tokens) {
    if (token.kind === 'die') {
      parts.push(token.qty > 1 ? `${token.qty}${token.die}` : token.die);
    } else {
      parts.push(token.value >= 0 ? `+${token.value}` : `${token.value}`);
    }
  }

  return `${parts.join(' ')} → ${result.total}`;
}
