/**
 * useDiceRolling Hook
 *
 * Manages dice rolling state and functionality including:
 * - Dice roller panel visibility
 * - Roll log panel visibility
 * - Roll history transformation from server snapshot
 * - Roll handling (formula generation and message sending)
 * - Viewing individual rolls from history
 *
 * Extracted from: apps/client/src/ui/App.tsx (lines 14-17, 59-62, 228-230, 235-249, 1017-1078)
 * Extraction date: 2025-10-20
 *
 * @module hooks/useDiceRolling
 */

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import type { RoomSnapshot, ClientMessage } from "@shared";
import type { RollResult, DieType } from "../components/dice/types";

/**
 * Options for the useDiceRolling hook
 */
export interface UseDiceRollingOptions {
  /** Current room snapshot containing dice rolls and player data */
  snapshot: RoomSnapshot | null;
  /** Function to send messages to the server */
  sendMessage: (message: ClientMessage) => void;
  /** Unique identifier for the current player */
  uid: string;
}

/**
 * Return value from the useDiceRolling hook
 */
export interface UseDiceRollingReturn {
  /** Whether the dice roller panel is open */
  diceRollerOpen: boolean;
  /** Whether the roll log panel is open */
  rollLogOpen: boolean;
  /** Currently viewing roll from history (null if not viewing) */
  viewingRoll: RollResult | null;
  /** Array of roll history entries transformed from snapshot */
  rollHistory: RollLogEntry[];
  /** Toggle the dice roller panel */
  toggleDiceRoller: (open: boolean) => void;
  /** Toggle the roll log panel */
  toggleRollLog: (open: boolean) => void;
  /** Handle a new dice roll from the dice roller */
  handleRoll: (result: RollResult) => void;
  /** Clear all roll history */
  handleClearLog: () => void;
  /** View a specific roll from history */
  handleViewRoll: (roll: RollResult | null) => void;
}

/**
 * Roll log entry format (extends RollResult with player name)
 */
export interface RollLogEntry extends RollResult {
  playerName: string;
  formula?: string; // Human-readable formula from server
}

/**
 * Hook for managing dice rolling functionality
 *
 * @example
 * ```tsx
 * const diceState = useDiceRolling({
 *   snapshot,
 *   sendMessage,
 *   uid: 'player-123'
 * });
 *
 * // Use in Header component
 * <Header
 *   diceRollerOpen={diceState.diceRollerOpen}
 *   rollLogOpen={diceState.rollLogOpen}
 *   onDiceRollerToggle={diceState.toggleDiceRoller}
 *   onRollLogToggle={diceState.toggleRollLog}
 *   // ... other props
 * />
 *
 * // Render panels conditionally
 * {diceState.diceRollerOpen && (
 *   <DiceRoller onRoll={diceState.handleRoll} onClose={() => diceState.toggleDiceRoller(false)} />
 * )}
 * ```
 */
export function useDiceRolling({
  snapshot,
  sendMessage,
  uid,
}: UseDiceRollingOptions): UseDiceRollingReturn {
  // -------------------------------------------------------------------------
  // STATE
  // -------------------------------------------------------------------------

  const [diceRollerOpen, setDiceRollerOpen] = useState(false);
  const [rollLogOpen, setRollLogOpen] = useState(false);
  const [viewingRoll, setViewingRoll] = useState<RollResult | null>(null);

  // Use ref to maintain stable callback for handleRoll
  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  // -------------------------------------------------------------------------
  // COMPUTED STATE
  // -------------------------------------------------------------------------

  /**
   * Transform dice rolls from server snapshot to client roll log format
   *
   * This transformation:
   * 1. Adds playerName to each roll
   * 2. Converts breakdown format (casts die field to DieType)
   * 3. Adds empty tokens array (not needed for display)
   */
  const rollHistory: RollLogEntry[] = useMemo(() => {
    return (snapshot?.diceRolls || []).map((roll) => ({
      id: roll.id,
      playerName: roll.playerName,
      formula: roll.formula, // Human-readable formula from server
      tokens: [], // Not needed for display
      perDie: roll.breakdown.map((b) => ({
        tokenId: b.tokenId,
        die: b.die as DieType | undefined,
        rolls: b.rolls,
        subtotal: b.subtotal,
      })),
      total: roll.total,
      timestamp: roll.timestamp,
    }));
  }, [snapshot?.diceRolls]);

  // -------------------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------------------

  /**
   * Toggle dice roller panel visibility
   */
  const toggleDiceRoller = useCallback((open: boolean) => {
    setDiceRollerOpen(open);
  }, []);

  /**
   * Toggle roll log panel visibility
   */
  const toggleRollLog = useCallback((open: boolean) => {
    setRollLogOpen(open);
  }, []);

  /**
   * Handle viewing a roll from history
   */
  const handleViewRoll = useCallback((roll: RollResult | null) => {
    setViewingRoll(roll);
  }, []);

  /**
   * Handle a new dice roll from the dice roller
   *
   * This function:
   * 1. Resolves player name from snapshot (or uses "Unknown")
   * 2. Builds formula string from roll tokens
   * 3. Sends dice-roll message to server
   */
  const handleRoll = useCallback(
    (result: RollResult) => {
      // Get player name from snapshot (using ref for stable callback)
      const me = snapshotRef.current?.players?.find((p) => p.uid === uid);
      const playerName = me?.name || "Unknown";

      // Build formula string from tokens
      const formula = result.tokens
        .map((t) => {
          if (t.kind === "die") {
            // For dice: show quantity if > 1 (e.g., "2d20" vs "d20")
            return t.qty > 1 ? `${t.qty}${t.die}` : t.die;
          } else {
            // For modifiers: show sign explicitly for positive values
            return t.value >= 0 ? `+${t.value}` : `${t.value}`;
          }
        })
        .join(" ");

      // Broadcast to server
      sendMessage({
        t: "dice-roll",
        roll: {
          id: result.id,
          playerUid: uid,
          playerName,
          formula,
          total: result.total,
          breakdown: result.perDie,
          timestamp: result.timestamp,
        },
      });
    },
    [uid, sendMessage],
  );

  /**
   * Clear all roll history
   */
  const handleClearLog = useCallback(() => {
    sendMessage({ t: "clear-roll-history" });
  }, [sendMessage]);

  // -------------------------------------------------------------------------
  // RETURN
  // -------------------------------------------------------------------------

  return {
    diceRollerOpen,
    rollLogOpen,
    viewingRoll,
    rollHistory,
    toggleDiceRoller,
    toggleRollLog,
    handleRoll,
    handleClearLog,
    handleViewRoll,
  };
}
