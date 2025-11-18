// ============================================================================
// HP VALIDATION UTILITIES
// ============================================================================
// Utility functions for validating and normalizing HP values across
// characters, NPCs, and players.

/**
 * Result of HP normalization
 */
export interface NormalizedHP {
  hp: number;
  maxHp: number;
}

/**
 * Normalize HP and Max HP values with automatic Max HP adjustment.
 *
 * Quality of Life behavior:
 * - If HP exceeds Max HP, Max HP is automatically set to match HP
 * - This prevents rejected updates when users enter HP before Max HP
 * - Both values are clamped to be >= 0
 * - Max HP minimum is 1 (can't have 0 max HP)
 *
 * @param hp - Current hit points (will be clamped to >= 0)
 * @param maxHp - Maximum hit points (will be clamped to >= 1)
 * @returns Normalized HP values with Max HP auto-adjusted if needed
 *
 * @example
 * // User sets HP to 34 while Max HP is still 10
 * normalizeHPValues(34, 10) // => { hp: 34, maxHp: 34 }
 *
 * @example
 * // Normal case: HP within Max HP
 * normalizeHPValues(25, 50) // => { hp: 25, maxHp: 50 }
 *
 * @example
 * // Negative values are clamped
 * normalizeHPValues(-5, 20) // => { hp: 0, maxHp: 20 }
 */
export function normalizeHPValues(hp: number, maxHp: number): NormalizedHP {
  // Clamp HP to minimum of 0
  const clampedHp = Math.max(0, hp);

  // Clamp Max HP to minimum of 1
  const clampedMaxHp = Math.max(1, maxHp);

  // If HP exceeds Max HP, auto-adjust Max HP to match HP
  // This is the QoL feature requested by the user
  if (clampedHp > clampedMaxHp) {
    return {
      hp: clampedHp,
      maxHp: clampedHp,
    };
  }

  // Otherwise, return the clamped values as-is
  return {
    hp: clampedHp,
    maxHp: clampedMaxHp,
  };
}

/**
 * Validate and parse HP input from user input (string or number).
 * Returns 0 for invalid inputs.
 *
 * @param value - User input value (string from input field or number)
 * @param defaultValue - Value to return if parsing fails (default: 0)
 * @returns Parsed number or default value
 */
export function parseHPInput(value: string | number, defaultValue: number = 0): number {
  const numeric = typeof value === "string" ? Number.parseInt(value, 10) : value;
  return Number.isFinite(numeric) ? numeric : defaultValue;
}

/**
 * Validate and parse Max HP input from user input (string or number).
 * Returns 1 for invalid inputs (can't have 0 max HP).
 *
 * @param value - User input value (string from input field or number)
 * @param defaultValue - Value to return if parsing fails (default: 1)
 * @returns Parsed number or default value (minimum 1)
 */
export function parseMaxHPInput(value: string | number, defaultValue: number = 1): number {
  const numeric = typeof value === "string" ? Number.parseInt(value, 10) : value;
  return Number.isFinite(numeric) && numeric > 0 ? numeric : defaultValue;
}
