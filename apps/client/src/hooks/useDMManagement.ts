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
import type { RoomSnapshot, ClientMessage } from "@herobyte/shared";
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
   * Route a server-side `dm-elevation-failed` into the modal. When the table
   * has no DM password yet, the modal flips to bootstrap mode (set a password
   * and claim the DM seat); any other reason shows inline in the modal.
   */
  onElevationFailed: (reason: string) => void;

  /**
   * Modal state management
   */
  modalState: {
    isOpen: boolean;
    mode: "elevate" | "revoke" | "bootstrap";
    isLoading: boolean;
    error: string | null;
    currentIsDM: boolean;
  };

  /**
   * Modal action handlers
   */
  modalActions: {
    onElevate: (password: string) => void;
    onBootstrap: (password: string) => void;
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
  const [modalMode, setModalMode] = useState<"elevate" | "revoke" | "bootstrap">("elevate");

  // Use the new useDMElevation hook for state-aware DM management
  const { isLoading, currentIsDM, elevate, bootstrap, notifyElevationFailed, revoke, error } =
    useDMElevation({
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
   * Handle first-time DM password setup (called from modal in bootstrap mode).
   * The server stores the password and auto-promotes the sender to DM.
   */
  const handleBootstrap = useCallback(
    (password: string) => {
      bootstrap(password);
    },
    [bootstrap],
  );

  /**
   * Server said elevation failed. The "no DM password yet" case is not a dead
   * end — it flips the modal into bootstrap mode so the user can mint the
   * password on the spot. Every other reason surfaces inline in the modal.
   */
  const handleElevationFailed = useCallback(
    (reason: string) => {
      if (reason.includes("No DM password configured")) {
        setModalMode("bootstrap");
        setIsModalOpen(true);
        notifyElevationFailed(null);
      } else {
        notifyElevationFailed(reason);
      }
    },
    [notifyElevationFailed],
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
      // A dismissed bootstrap offer shouldn't stick: reopening the toggle
      // starts back at the normal elevate prompt.
      setModalMode((mode) => (mode === "bootstrap" ? "elevate" : mode));
    }
  }, [isLoading]);

  return {
    handleToggleDM,
    onElevationFailed: handleElevationFailed,
    modalState: {
      isOpen: isModalOpen,
      mode: modalMode,
      isLoading,
      error,
      currentIsDM,
    },
    modalActions: {
      onElevate: handleElevate,
      onBootstrap: handleBootstrap,
      onRevoke: handleRevoke,
      onClose: handleCloseModal,
    },
  };
}
