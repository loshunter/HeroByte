/**
 * useServerEventHandlers Hook
 *
 * Handles server event messages related to room password updates and DM elevation.
 * Manages state for room password operations and displays toast notifications for
 * DM elevation events.
 *
 * Extracted from: /apps/client/src/ui/App.tsx (lines 228-229, 269-293, 425-427)
 * Extraction date: 2025-10-20
 *
 * @module hooks/useServerEventHandlers
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, ServerMessage } from "@shared";

/**
 * Status of a room password update operation
 */
export type RoomPasswordStatus = {
  type: "success" | "error";
  message: string;
};

/**
 * Toast notification interface
 * Matches the return type of useToast hook
 */
export interface ToastNotifications {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  dismiss: (id: string) => void;
  messages: Array<{ id: string; type: string; message: string; duration?: number }>;
}

/**
 * Options for useServerEventHandlers hook
 */
export interface UseServerEventHandlersOptions {
  /**
   * Function to register a server event handler
   * The handler will be called for every server message received
   */
  registerServerEventHandler: (handler: (message: ServerMessage) => void) => void;

  /**
   * Toast notification functions for displaying user feedback
   */
  toast: ToastNotifications;

  /**
   * WebSocket message sender for client-server communication
   */
  sendMessage: (msg: ClientMessage) => void;
}

/**
 * Return value from useServerEventHandlers hook
 */
export interface UseServerEventHandlersReturn {
  /**
   * Current status of room password update operation
   * Null when no operation is in progress or completed
   */
  roomPasswordStatus: RoomPasswordStatus | null;

  /**
   * Whether a room password update is currently pending
   */
  roomPasswordPending: boolean;

  /**
   * Clears the room password status message
   */
  dismissRoomPasswordStatus: () => void;

  /**
   * Sets the room password update to pending state
   * Should be called when initiating a password update
   */
  startRoomPasswordUpdate: () => void;

  /**
   * Sets the room password
   * Initiates a password update and sends the message to the server
   *
   * @param nextSecret - The new room password
   */
  handleSetRoomPassword: (nextSecret: string) => void;
}

/**
 * Hook to handle server events for room password updates and DM elevation
 *
 * Listens to the following server message types:
 * - `room-password-updated`: Room password was successfully updated
 * - `room-password-update-failed`: Room password update failed
 * - `dm-status`: DM elevation status update (shows toast when isDM=true)
 * - `dm-elevation-failed`: DM elevation failed (shows error toast)
 *
 * @example
 * ```tsx
 * const {
 *   roomPasswordStatus,
 *   roomPasswordPending,
 *   dismissRoomPasswordStatus,
 *   startRoomPasswordUpdate
 * } = useServerEventHandlers({
 *   registerServerEventHandler,
 *   toast
 * });
 * ```
 *
 * @param options - Configuration options
 * @returns Server event handler state and functions
 */
export function useServerEventHandlers({
  registerServerEventHandler,
  toast,
  sendMessage,
}: UseServerEventHandlersOptions): UseServerEventHandlersReturn {
  // State for room password operations
  const [roomPasswordStatus, setRoomPasswordStatus] = useState<RoomPasswordStatus | null>(null);
  const [roomPasswordPending, setRoomPasswordPending] = useState(false);

  /**
   * Clears the room password status message
   */
  const dismissRoomPasswordStatus = useCallback(() => {
    setRoomPasswordStatus(null);
  }, []);

  /**
   * Starts a room password update operation
   * Sets pending state to true and clears any existing status
   */
  const startRoomPasswordUpdate = useCallback(() => {
    setRoomPasswordPending(true);
    setRoomPasswordStatus(null);
  }, []);

  /**
   * Sets the room password
   * Initiates a password update and sends the message to the server
   */
  const handleSetRoomPassword = useCallback(
    (nextSecret: string) => {
      startRoomPasswordUpdate();
      sendMessage({ t: "set-room-password", secret: nextSecret });
    },
    [sendMessage, startRoomPasswordUpdate],
  );

  const lastDmStatusRef = useRef<boolean | null>(null);
  const { success: toastSuccess, error: toastError } = toast;

  /**
   * Register handler for server events
   * Handles room password updates and DM elevation events
   */
  useEffect(() => {
    lastDmStatusRef.current = null;

    registerServerEventHandler((message: ServerMessage) => {
      if ("t" in message && message.t === "room-password-updated") {
        setRoomPasswordPending(false);
        setRoomPasswordStatus({
          type: "success",
          message: "Room password updated successfully.",
        });
      } else if ("t" in message && message.t === "room-password-update-failed") {
        setRoomPasswordPending(false);
        setRoomPasswordStatus({
          type: "error",
          message: message.reason ?? "Unable to update room password.",
        });
      } else if ("t" in message && message.t === "dm-status") {
        const previousStatus = lastDmStatusRef.current;
        lastDmStatusRef.current = message.isDM;

        // DM elevation successful (only toast on transition to DM)
        if (message.isDM && previousStatus !== true) {
          toastSuccess("DM elevation successful! You are now the Dungeon Master.", 4000);
        }
      } else if ("t" in message && message.t === "dm-elevation-failed") {
        // DM elevation failed
        toastError(`DM elevation failed: ${message.reason}`, 5000);
      } else if ("t" in message && message.t === "dm-password-updated") {
        // DM password updated successfully
        toastSuccess("DM password updated successfully!", 3000);
      } else if ("t" in message && message.t === "dm-password-update-failed") {
        // DM password update failed
        toastError(`DM password update failed: ${message.reason}`, 5000);
      }
    });
  }, [registerServerEventHandler, toastSuccess, toastError]);

  return {
    roomPasswordStatus,
    roomPasswordPending,
    dismissRoomPasswordStatus,
    startRoomPasswordUpdate,
    handleSetRoomPassword,
  };
}
