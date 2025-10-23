// ============================================================================
// USE RESET ROOM PASSWORD HOOK
// ============================================================================
// Provides functionality to reset the room password back to the default
// development fallback value. This bypasses client-side validation since
// the default password ("Fun1") is shorter than the typical 6-char minimum.

/**
 * Default room password that matches the server's DEV_FALLBACK_SECRET.
 * This must be kept in sync with apps/server/src/config/auth.ts
 */
const DEFAULT_ROOM_PASSWORD = "Fun1";

/**
 * Hook that provides a function to reset the room password to the default value.
 *
 * @param onSetRoomPassword - Callback to invoke when resetting the password
 * @returns Object containing the reset function and default password value
 *
 * @example
 * ```tsx
 * const { resetToDefault, defaultPassword } = useResetRoomPassword(onSetRoomPassword);
 *
 * <button onClick={resetToDefault}>
 *   Reset to Default
 * </button>
 * ```
 */
export function useResetRoomPassword(onSetRoomPassword?: (secret: string) => void) {
  /**
   * Resets the room password to the default development value.
   * This bypasses client-side validation since the default password
   * is shorter than the typical minimum length requirement.
   */
  const resetToDefault = () => {
    if (!onSetRoomPassword) return;
    onSetRoomPassword(DEFAULT_ROOM_PASSWORD);
  };

  return {
    resetToDefault,
    defaultPassword: DEFAULT_ROOM_PASSWORD,
  };
}
