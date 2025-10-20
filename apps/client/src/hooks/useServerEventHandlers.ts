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

import { useCallback, useEffect, useState } from "react";
import type { ServerMessage } from "@shared";

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
   * Register handler for server events
   * Handles room password updates and DM elevation events
   */
  useEffect(() => {
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
        // DM elevation successful
        if (message.isDM) {
          toast.success("DM elevation successful! You are now the Dungeon Master.", 4000);
        }
      } else if ("t" in message && message.t === "dm-elevation-failed") {
        // DM elevation failed
        toast.error(`DM elevation failed: ${message.reason}`, 5000);
      }
    });
  }, [registerServerEventHandler, toast]);

  return {
    roomPasswordStatus,
    roomPasswordPending,
    dismissRoomPasswordStatus,
    startRoomPasswordUpdate,
  };
}
