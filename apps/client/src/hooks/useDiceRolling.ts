/**
 * useDiceRolling Hook
 *
 * Manages dice rolling state and functionality including:
 * - Dice roller panel visibility
 * - Roll log panel visibility
 * - Roll history read from the server snapshot
 * - Sending roll REQUESTS (the server does the rolling)
 * - Viewing individual rolls from history
 *
 * Extracted from: apps/client/src/ui/App.tsx (lines 14-17, 59-62, 228-230, 235-249, 1017-1078)
 * Extraction date: 2025-10-20
 *
 * @module hooks/useDiceRolling
 */

import { useCallback, useMemo, useState } from "react";
import type {
  RoomSnapshot,
  ClientMessage,
  ChatMessage,
  DiceRollMode,
  DiceVisibility,
} from "@herobyte/shared";
import type { RollLogEntry } from "../components/dice/rollLogTypes";
import type { DieType, RollResult } from "../components/dice/types";

/** What the roller asks the server to roll. Deliberately carries no result. */
export interface DiceRollRequest {
  /** Dice notation, e.g. "2d6 + 3". The server parses and rolls it. */
  formula: string;
  mode: DiceRollMode;
  visibility: DiceVisibility;
}

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
  viewingRoll: RollLogEntry | null;
  /** Array of roll history entries transformed from snapshot */
  rollHistory: RollLogEntry[];
  /**
   * The newest roll in history authored by THIS player, or null.
   *
   * How the roller learns its own result: it sends a formula and the answer
   * arrives asynchronously in the next snapshot. Correlating on "my newest
   * roll" rather than an id works because the roll button is disabled while a
   * request is in flight, so a player can only ever have one outstanding.
   */
  latestOwnRoll: RollLogEntry | null;
  /**
   * Chat visible to THIS player, straight off the snapshot. Whispers meant
   * for other people were already dropped server-side, so there is nothing
   * to filter here — and deliberately no client-side filtering, because a
   * renderer that hides messages it received is not secrecy.
   */
  chatMessages: ChatMessage[];
  /** Send a chat message. Omit `to` for the whole table. */
  handleSendChat: (text: string, to?: string) => void;
  /** Toggle the dice roller panel */
  toggleDiceRoller: (open: boolean) => void;
  /** Toggle the roll log panel */
  toggleRollLog: (open: boolean) => void;
  /** Ask the server to roll. It answers through the snapshot. */
  handleRoll: (request: DiceRollRequest) => void;
  /** Clear all roll history */
  handleClearLog: () => void;
  /** View a specific roll from history */
  handleViewRoll: (roll: RollLogEntry | null) => void;
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
 * <DiceRoller
 *   onRoll={diceState.handleRoll}
 *   latestOwnRoll={diceState.latestOwnRoll}
 *   onClose={() => diceState.toggleDiceRoller(false)}
 * />
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
  const [viewingRoll, setViewingRoll] = useState<RollLogEntry | null>(null);

  // -------------------------------------------------------------------------
  // COMPUTED STATE
  // -------------------------------------------------------------------------

  /**
   * The server's roll history, as the log renders it.
   *
   * Every field here comes off the wire. There is no local reconstruction and
   * no `tokens` array: the breakdown carries its own die and faces, and the
   * formula is the string the server actually rolled.
   *
   * Nothing is filtered here — rolls another player marked private were never
   * serialized to this client. A renderer that hides rolls it received would
   * not be secrecy.
   */
  const rollHistory: RollLogEntry[] = useMemo(() => {
    const rolls = snapshot?.diceRolls;
    if (!Array.isArray(rolls)) return [];
    return rolls.map((roll) => ({
      id: roll.id,
      playerUid: roll.playerUid,
      playerName: roll.playerName,
      // Coerced, for the same reason the breakdown is array-guarded below: a
      // roll with no formula reaches RollEntry's isLongFormula, which reads
      // `.length` on it inside the render path.
      formula: typeof roll.formula === "string" ? roll.formula : "",
      // This mapper enumerates what it copies, so a field added to the wire
      // type reaches the log only by being named here. Adding `label` to the
      // client type alone leaves TypeScript green and renders undefined for
      // ever — and a test built on a hand-made RollLogEntry passes vacuously.
      label: roll.label,
      // Array-guarded, not `|| []`: a session file a DM was handed can carry a
      // truthy non-array here (load-session checks entries are objects, not
      // their field shapes), and this runs inside a render-path useMemo where
      // a TypeError takes the whole table's UI down.
      perDie: (Array.isArray(roll.breakdown) ? roll.breakdown : []).map((b) => ({
        tokenId: b.tokenId,
        die: b.die as DieType | undefined,
        rolls: b.rolls,
        dropped: b.dropped,
        subtotal: b.subtotal,
      })),
      total: roll.total,
      mode: roll.mode,
      visibility: roll.visibility,
      // Named here for the reason the comment above gives, and this pair is the
      // costliest possible omission: dropping them does not blank a row, it
      // renders a number a person typed as though the server had rolled it.
      handEntered: roll.handEntered,
      supersededTotal: roll.supersededTotal,
      timestamp: roll.timestamp,
    }));
  }, [snapshot]);

  const latestOwnRoll = useMemo(() => {
    for (let i = rollHistory.length - 1; i >= 0; i--) {
      const roll = rollHistory[i];
      if (roll && roll.playerUid === uid) return roll;
    }
    return null;
  }, [rollHistory, uid]);

  /** Already recipient-filtered by the server; passed through as-is. */
  const chatMessages: ChatMessage[] = useMemo(() => snapshot?.chatLog ?? [], [snapshot]);

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
  const handleViewRoll = useCallback((roll: RollLogEntry | null) => {
    setViewingRoll(roll);
  }, []);

  /**
   * Ask the server to roll a formula.
   *
   * Note what is NOT sent: a total, a breakdown, an id, a timestamp, a uid or
   * a name. The server rolls the dice and stamps the author from the
   * connection, so there is nothing here for a tampered client to lie about
   * (arc defect D2). This used to send a fully-formed roll, and the server
   * stored it verbatim.
   */
  const handleRoll = useCallback(
    ({ formula, mode, visibility }: DiceRollRequest) => {
      if (!formula.trim()) return;
      const message: ClientMessage = { t: "dice-roll", formula };
      if (mode !== "normal") message.mode = mode;
      if (visibility !== "public") message.visibility = visibility;
      sendMessage(message);
    },
    [sendMessage],
  );

  /**
   * Clear all roll history
   */
  const handleClearLog = useCallback(() => {
    sendMessage({ t: "clear-roll-history" });
  }, [sendMessage]);

  /**
   * Send a chat message.
   *
   * Like handleRoll above, it carries no author field: the server stamps
   * identity from the connection.
   */
  const handleSendChat = useCallback(
    (text: string, to?: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      sendMessage(to ? { t: "chat", text: trimmed, to } : { t: "chat", text: trimmed });
    },
    [sendMessage],
  );

  // -------------------------------------------------------------------------
  // RETURN
  // -------------------------------------------------------------------------

  return {
    diceRollerOpen,
    rollLogOpen,
    viewingRoll,
    rollHistory,
    latestOwnRoll,
    chatMessages,
    toggleDiceRoller,
    toggleRollLog,
    handleRoll,
    handleClearLog,
    handleViewRoll,
    handleSendChat,
  };
}

export type { RollLogEntry, RollResult };
