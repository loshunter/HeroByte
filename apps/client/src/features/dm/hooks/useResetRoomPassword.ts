// ============================================================================
// USE RESET ROOM PASSWORD HOOK
// ============================================================================
// Provides functionality to reset the table password back to the server's
// configured default. The client sends a secret-less set-room-password and the
// server substitutes its own default — the client never needs to know (or
// hard-code) that value, so this works on servers with a custom
// HEROBYTE_ROOM_SECRET too.

/**
 * Hook that provides a function to reset the table password to the server's
 * default value.
 *
 * @param onSetRoomPassword - Callback to invoke when resetting the password
 * @returns Object containing the reset function
 *
 * @example
 * ```tsx
 * const { resetToDefault } = useResetRoomPassword(onSetRoomPassword);
 *
 * <button onClick={resetToDefault}>
 *   Reset to Default
 * </button>
 * ```
 */
export function useResetRoomPassword(onSetRoomPassword?: (secret?: string) => void) {
  /**
   * Resets the table password to the server's configured default by omitting
   * the secret — the server resolves the actual value.
   */
  const resetToDefault = () => {
    if (!onSetRoomPassword) return;
    onSetRoomPassword();
  };

  return {
    resetToDefault,
  };
}
