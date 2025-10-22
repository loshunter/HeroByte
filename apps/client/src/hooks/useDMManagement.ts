/**
 * useDMManagement Hook
 *
 * Encapsulates DM (Dungeon Master) privilege management logic.
 * Handles toggling DM status, including elevation and revocation workflows.
 *
 * Extracted from: apps/client/src/ui/App.tsx (lines 519-550)
 * Extraction date: 2025-10-20
 *
 * This hook handles:
 * - DM elevation via password authentication
 * - DM status revocation with confirmation
 * - User interaction (prompts and confirmations)
 * - Toast notifications for status changes
 *
 * @module hooks/useDMManagement
 */

import { useCallback } from "react";
import type { ClientMessage } from "@shared";

/**
 * Toast notification interface for displaying status messages.
 * Matches the return type of useToast hook.
 */
export interface ToastManager {
  /**
   * Display a success toast notification
   * @param message - The message to display
   * @param duration - Optional duration in milliseconds (default: 3000)
   */
  success: (message: string, duration?: number) => void;

  /**
   * Display an error toast notification
   * @param message - The message to display
   * @param duration - Optional duration in milliseconds (default: 3000)
   */
  error: (message: string, duration?: number) => void;

  /**
   * Display an info toast notification
   * @param message - The message to display
   * @param duration - Optional duration in milliseconds (default: 3000)
   */
  info: (message: string, duration?: number) => void;

  /**
   * Display a warning toast notification
   * @param message - The message to display
   * @param duration - Optional duration in milliseconds (default: 3000)
   */
  warning: (message: string, duration?: number) => void;
}

/**
 * Dependencies required by the useDMManagement hook.
 */
export interface UseDMManagementOptions {
  /**
   * Current DM status of the user.
   * True if the user has DM privileges, false otherwise.
   */
  isDM: boolean;

  /**
   * Function to attempt DM elevation with a password.
   * Called when a user wants to become DM.
   *
   * @param password - The DM password to validate
   */
  elevateToDM: (password: string) => void;

  /**
   * WebSocket message sender for client-server communication.
   * Used to send revoke-dm messages to the server.
   */
  sendMessage: (msg: ClientMessage) => void;

  /**
   * Toast notification manager for displaying status messages.
   */
  toast: ToastManager;
}

/**
 * DM management action functions returned by the hook.
 */
export interface UseDMManagementReturn {
  /**
   * Toggle DM status - either elevate to DM or revoke DM privileges.
   *
   * Behavior depends on requestDM parameter:
   * - If requestDM is false: Revokes current DM status (with confirmation)
   * - If requestDM is true and user is not DM: Prompts for password and elevates
   * - If requestDM is true and user is already DM: No action taken
   *
   * @param requestDM - True to request DM privileges, false to revoke them
   */
  handleToggleDM: (requestDM: boolean) => void;
}

/**
 * Hook providing DM privilege management functionality.
 *
 * Manages the workflow for becoming DM (elevation) and stepping down from DM
 * (revocation). Includes user interaction flows with prompts and confirmations,
 * as well as appropriate feedback via toast notifications.
 *
 * @param options - Hook dependencies
 * @returns DM management action functions
 *
 * @example
 * ```tsx
 * const dmActions = useDMManagement({
 *   isDM,
 *   elevateToDM,
 *   sendMessage,
 *   toast
 * });
 *
 * // Request DM elevation (prompts for password)
 * dmActions.handleToggleDM(true);
 *
 * // Revoke DM status (asks for confirmation)
 * dmActions.handleToggleDM(false);
 * ```
 */
export function useDMManagement({
  isDM,
  elevateToDM,
  sendMessage,
  toast,
}: UseDMManagementOptions): UseDMManagementReturn {
  /**
   * Toggle DM status based on requestDM parameter.
   *
   * Revocation flow:
   * 1. Confirms user wants to revoke DM status
   * 2. Sends revoke-dm message to server
   * 3. Displays success notification
   *
   * Elevation flow:
   * 1. Prompts for DM password
   * 2. Calls elevateToDM with the password
   * 3. elevateToDM handles the server communication and notifications
   */
  const handleToggleDM = useCallback(
    (requestDM: boolean) => {
      if (!requestDM) {
        // Revoking DM mode
        const confirmed = window.confirm(
          "Are you sure you want to revoke your DM status? Another player will be able to become DM with the password.",
        );
        if (!confirmed) {
          return;
        }

        // Send revoke-dm message
        sendMessage({ t: "revoke-dm" });
        toast.success("DM status revoked. You are now a player.", 3000);
        return;
      }

      if (isDM) {
        // Already DM
        return;
      }

      // Prompt for DM password
      const dmPassword = window.prompt("Enter DM password to elevate:");
      if (!dmPassword) {
        return; // User cancelled
      }

      elevateToDM(dmPassword.trim());
    },
    [isDM, elevateToDM, sendMessage, toast],
  );

  return {
    handleToggleDM,
  };
}
