// ============================================================================
// DICE ROLLER TYPES
// ============================================================================

export type DieType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

export type Token =
  | { kind: 'die'; die: DieType; qty: number; id: string }
  | { kind: 'mod'; value: number; id: string };

export type Build = Token[];

export type RollResult = {
  id: string;
  tokens: Build;
  perDie: {
    tokenId: string;
    die?: DieType;
    rolls?: number[];
    subtotal: number;
  }[];
  total: number;
  timestamp: number;
};

export const DIE_COLORS: Record<DieType, string> = {
  d4: '#FF6B6B',    // Red
  d6: '#4ECDC4',    // Cyan
  d8: '#95E1D3',    // Mint
  d10: '#FFD93D',   // Yellow
  d12: '#A8E6CF',   // Light green
  d20: '#447DF7',   // HeroByte blue
  d100: '#FF3C64E', // HeroByte gold
};

export const DIE_SYMBOLS: Record<DieType, string> = {
  d4: '▲',
  d6: '⬢',
  d8: '◆',
  d10: '⬟',
  d12: '⬣',
  d20: '◉',
  d100: '%',
};
