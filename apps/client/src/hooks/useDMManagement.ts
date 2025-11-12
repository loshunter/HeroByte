/**
 * useDMManagement Hook
 *
 * Encapsulates DM (Dungeon Master) privilege management logic.
 * Handles toggling DM status, including elevation and revocation workflows.
 *
 * Updated to use useDMElevation hook with proper state synchronization.
 * Replaces fire-and-forget pattern with modal-based UI flow.
 *
 * This hook handles:
 * - DM elevation via password authentication
 * - DM status revocation with confirmation
 * - Modal state management for elevation/revocation UI
 * - Toast notifications for status changes
 *
 * @module hooks/useDMManagement
 */

import { useCallback, useState } from "react";
import type { RoomSnapshot, ClientMessage } from "@shared";
import { useDMElevation } from "./useDMElevation";

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
   * Current snapshot state from the server.
   */
  snapshot: RoomSnapshot | null;

  /**
   * Current player's unique identifier.
   */
  uid: string;

  /**
   * WebSocket message sender for client-server communication.
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
   * Opens the DMElevationModal with appropriate mode.
   *
   * @param requestDM - True to request DM privileges, false to revoke them
   */
  handleToggleDM: (requestDM: boolean) => void;

  /**
   * Modal state management
   */
  modalState: {
    isOpen: boolean;
    mode: "elevate" | "revoke";
    isLoading: boolean;
    error: string | null;
    currentIsDM: boolean;
  };

  /**
   * Modal action handlers
   */
  modalActions: {
    onElevate: (password: string) => void;
    onRevoke: () => void;
    onClose: () => void;
  };
}

/**
 * Hook providing DM privilege management functionality.
 *
 * Manages the workflow for becoming DM (elevation) and stepping down from DM
 * (revocation). Uses DMElevationModal for proper state synchronization instead
 * of fire-and-forget pattern.
 *
 * @param options - Hook dependencies
 * @returns DM management action functions and modal state
 *
 * @example
 * ```tsx
 * const { handleToggleDM, modalState, modalActions } = useDMManagement({
 *   snapshot,
 *   uid,
 *   sendMessage,
 *   toast
 * });
 *
 * // Open modal to request DM elevation
 * handleToggleDM(true);
 *
 * // Open modal to revoke DM status
 * handleToggleDM(false);
 *
 * // Render the modal
 * <DMElevationModal {...modalState} {...modalActions} />
 * ```
 */
export function useDMManagement({
  snapshot,
  uid,
  sendMessage,
  toast,
}: UseDMManagementOptions): UseDMManagementReturn {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"elevate" | "revoke">("elevate");

  // Use the new useDMElevation hook for state-aware DM management
  const { isLoading, currentIsDM, elevate, revoke, error } = useDMElevation({
    snapshot,
    uid,
    send: sendMessage,
  });

  /**
   * Open modal to toggle DM status
   */
  const handleToggleDM = useCallback(
    (requestDM: boolean) => {
      if (requestDM && currentIsDM) {
        // Already DM, no action needed
        return;
      }

      setModalMode(requestDM ? "elevate" : "revoke");
      setIsModalOpen(true);
    },
    [currentIsDM],
  );

  /**
   * Handle DM elevation (called from modal)
   */
  const handleElevate = useCallback(
    (password: string) => {
      elevate(password);
      // Modal will close automatically on success via useEffect in DMElevationModal
    },
    [elevate],
  );

  /**
   * Handle DM revocation (called from modal)
   */
  const handleRevoke = useCallback(() => {
    revoke();
    // Show success toast on revocation
    toast.success("DM status revoked. You are now a player.", 3000);
    // Modal will close automatically on success via useEffect in DMElevationModal
  }, [revoke, toast]);

  /**
   * Close modal
   */
  const handleCloseModal = useCallback(() => {
    if (!isLoading) {
      setIsModalOpen(false);
    }
  }, [isLoading]);

  return {
    handleToggleDM,
    modalState: {
      isOpen: isModalOpen,
      mode: modalMode,
      isLoading,
      error,
      currentIsDM,
    },
    modalActions: {
      onElevate: handleElevate,
      onRevoke: handleRevoke,
      onClose: handleCloseModal,
    },
  };
}
