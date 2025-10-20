import { useCallback } from "react";
import type { ClientMessage } from "@shared";

/**
 * Options for useStatusEffects hook
 */
export interface UseStatusEffectsOptions {
  /**
   * Function to send WebSocket messages to the server
   */
  sendMessage: (msg: ClientMessage) => void;
}

/**
 * Return value from useStatusEffects hook
 */
export interface UseStatusEffectsReturn {
  /**
   * Update the active status effects for the current player
   * @param effects - Array of status effect strings (e.g., ["poisoned", "stunned"])
   */
  setStatusEffects: (effects: string[]) => void;
}

/**
 * Hook for managing player status effects
 *
 * Provides a callback to update the active status effects for the current player.
 * Status effects are displayed in the player panel and can be used to track
 * conditions like "poisoned", "stunned", "blessed", etc.
 *
 * @param options - Configuration options
 * @returns An object containing the setStatusEffects callback
 *
 * @example
 * ```tsx
 * function PlayerPanel() {
 *   const { sendMessage } = useWebSocket();
 *   const { setStatusEffects } = useStatusEffects({ sendMessage });
 *
 *   return (
 *     <StatusEffectsEditor
 *       effects={playerEffects}
 *       onChange={setStatusEffects}
 *     />
 *   );
 * }
 * ```
 */
export function useStatusEffects(
  options: UseStatusEffectsOptions,
): UseStatusEffectsReturn {
  const { sendMessage } = options;

  const setStatusEffects = useCallback(
    (effects: string[]) => {
      sendMessage({ t: "set-status-effects", effects });
    },
    [sendMessage],
  );

  return { setStatusEffects };
}
