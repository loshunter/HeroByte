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

import { deliverLockRefusal } from "../features/locking/lockRefusalBridge";
import { lockRefusalMessage } from "../features/locking/lockRefusalCopy";
import { colorAdjustedMessage } from "../features/players/components/colorPicker/colorPickerControl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, ServerMessage } from "@herobyte/shared";
import { deliverSessionFile, deliverSessionRefusal } from "../features/session/sessionBridge";
import { onLockNotice } from "../features/locking/lockNotice";
import { announceLockedDoor } from "../features/map/lockedDoor";
import { characterRefusalMessage } from "../features/players/characterCap";
import {
  deliverCharacterRefusal,
  onCharacterNotice,
} from "../features/players/characterRefusalBridge";

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

  /**
   * When provided, `dm-elevation-failed` reasons are routed here (for the
   * elevation modal to display or redirect) instead of raising an error toast.
   */
  onDMElevationFailed?: (reason: string) => void;

  /** Whether the viewer is the DM now: a lock refusal names the DM's way out (🔓 Unlock). */
  viewerIsDM?: boolean;

  /**
   * Replies to fork-table. Routed here rather than via
   * registerServerEventHandler because that is single-subscriber and this hook
   * owns it once the user is authenticated — which is exactly when a fork runs.
   */
  onTableForkMessage?: (message: ServerMessage) => void;

  onMapStudioMessage?: (
    message: Extract<
      ServerMessage,
      {
        t:
          | "map-studio-documents"
          | "map-studio-document"
          | "map-studio-deleted"
          | "map-studio-error";
      }
    >,
  ) => void;

  /**
   * Called beside the atlas-error toast, so a pending kick can match its
   * nodeId. Routed here because registerServerEventHandler is single-
   * subscriber and this hook owns the subscription.
   */
  onAtlasError?: (message: Extract<ServerMessage, { t: "atlas-error" }>) => void;
}

/** What the DM reads when the server refused a REMOVE (Table → Players at this table). */
export const REMOVE_PLAYER_REFUSAL_COPY: Record<
  Extract<ServerMessage, { t: "remove-player-refused" }>["reason"],
  string
> = {
  self: "You cannot remove your own seat.",
  connected:
    "That player still has a browser open — a login screen, or another table, counts. Ask them to close it, then try again.",
  recent: "That player was here less than a minute ago — wait a moment, then try again.",
  nothing: "There was nothing left at the table for that player.",
};

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
   * @param nextSecret - The new room password; omit to reset to the server's
   * configured default
   */
  handleSetRoomPassword: (nextSecret?: string) => void;
}

/**
 * App's server-event switchboard: the control messages no snapshot carries (password
 * and DM replies, refusals said to the one who tried, replies routed on to a feature).
 * Every type it handles must also pass MessageRouter's isControlMessage guard.
 */
export function useServerEventHandlers({
  registerServerEventHandler,
  toast,
  sendMessage,
  onDMElevationFailed,
  onTableForkMessage,
  onMapStudioMessage,
  onAtlasError,
  viewerIsDM = false,
}: UseServerEventHandlersOptions): UseServerEventHandlersReturn {
  // Read when a refusal arrives, so the handler is not re-registered on every role change.
  const viewerIsDMRef = useRef(viewerIsDM);
  viewerIsDMRef.current = viewerIsDM;
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
    (nextSecret?: string) => {
      startRoomPasswordUpdate();
      // Omitting the secret asks the server to reset to its configured default.
      sendMessage(
        nextSecret === undefined
          ? { t: "set-room-password" }
          : { t: "set-room-password", secret: nextSecret },
      );
    },
    [sendMessage, startRoomPasswordUpdate],
  );

  const lastDmStatusRef = useRef<boolean | null>(null);
  const { success: toastSuccess, error: toastError, info: toastInfo } = toast;

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
          message: "Table password updated successfully.",
        });
      } else if ("t" in message && message.t === "room-password-update-failed") {
        setRoomPasswordPending(false);
        setRoomPasswordStatus({
          type: "error",
          message: message.reason ?? "Unable to update table password.",
        });
      } else if ("t" in message && message.t === "dm-status") {
        const previousStatus = lastDmStatusRef.current;
        lastDmStatusRef.current = message.isDM;

        // Entered DM mode (only toast on transition to DM); the leave toast says "DM mode" too
        if (message.isDM && previousStatus !== true) {
          toastSuccess("You are in DM mode. The DM tools are on.", 4000);
        }
      } else if ("t" in message && message.t === "dm-elevation-failed") {
        // DM elevation failed — the modal shows the reason (and offers
        // first-time password setup) when it is wired in; otherwise toast.
        if (onDMElevationFailed) {
          onDMElevationFailed(message.reason ?? "Unknown reason");
        } else {
          toastError(`DM elevation failed: ${message.reason}`, 5000);
        }
      } else if ("t" in message && message.t === "dm-password-updated") {
        // DM password updated successfully
        toastSuccess("DM password updated successfully!", 3000);
      } else if ("t" in message && message.t === "dm-password-update-failed") {
        // DM password update failed
        toastError(`DM password update failed: ${message.reason}`, 5000);
      } else if (
        "t" in message &&
        (message.t === "table-forked" || message.t === "table-fork-failed")
      ) {
        onTableForkMessage?.(message);
      } else if ("t" in message && message.t === "session-file") {
        // Routed rather than handled: the DM's chosen filename lives in
        // useSessionManagement, down in the DM menu. See sessionFileBridge.
        deliverSessionFile(message.file);
      } else if ("t" in message && message.t === "session-export-refused") {
        deliverSessionRefusal(message.reason); // the waiting backup says why, and stops waiting
      } else if (
        "t" in message &&
        (message.t === "map-studio-documents" ||
          message.t === "map-studio-document" ||
          message.t === "map-studio-deleted" ||
          message.t === "map-studio-error")
      ) {
        onMapStudioMessage?.(message);
      } else if ("t" in message && message.t === "atlas-error") {
        // Atlas ops are fire-and-forget room mutations confirmed by the next
        // snapshot; this channel is their ONLY failure surface (sent to the
        // acting DM alone), so a swallowed one is a silently dead button.
        toastError(`World: ${message.reason}`, 5000);
        onAtlasError?.(message);
      } else if ("t" in message && message.t === "remove-player-refused") {
        // The Table tab's REMOVE is fire-and-forget too, and a refused one
        // changes nothing on the table: this is the DM's only failure surface.
        toastError(REMOVE_PLAYER_REFUSAL_COPY[message.reason], 5000);
      } else if ("t" in message && message.t === "character-refused") {
        // A character the viewer asked for (or handed over) was not taken: say why.
        toastError(characterRefusalMessage(message), 5000);
        deliverCharacterRefusal(message);
      } else if ("t" in message && message.t === "door-refused") {
        // A locked door held against a click the viewer's stale view thought free.
        announceLockedDoor();
      } else if ("t" in message && message.t === "session-load-refused") {
        // The backup was refused whole; the restore's own toast said only that it was sent.
        toastError(`Restore refused: ${message.reason} The table has NOT been changed.`, 9000);
      } else if ("t" in message && message.t === "color-adjusted") {
        // The server moved a colour you chose out of another player's zone (C1).
        toastInfo(colorAdjustedMessage(message.near, message.name, message.throttled), 5000);
      } else if ("t" in message && message.t === "locked-refused") {
        // The lock stopped a move or a delete (or a bulk action kept these pieces): the
        // server sends it to the one who tried, and nothing else on the table says why.
        toastError(
          lockRefusalMessage(
            message.ids.length,
            message.kept === true,
            viewerIsDMRef.current,
            message.elsewhere === true,
          ),
          4000,
        );
        deliverLockRefusal(message);
      }
    });
  }, [
    registerServerEventHandler,
    toastSuccess,
    toastError,
    toastInfo,
    onDMElevationFailed,
    onTableForkMessage,
    onMapStudioMessage,
    onAtlasError,
  ]);

  // A control the lock stopped on this client (lockNotice) gets the same toast — once
  // while it is up: rattling a locked door stacked a copy per click.
  useEffect(() => {
    let shown = { text: "", until: 0 };
    return onLockNotice((message) => {
      const text = message ?? lockRefusalMessage(1, false, viewerIsDMRef.current);
      if (text === shown.text && Date.now() < shown.until) return;
      shown = { text, until: Date.now() + 4000 };
      toastError(text, 4000);
    });
  }, [toastError]);
  // "Creating..." gave up with no answer (characterRefusalBridge).
  useEffect(() => onCharacterNotice((message) => toastInfo(message, 8000)), [toastInfo]);

  return {
    roomPasswordStatus,
    roomPasswordPending,
    dismissRoomPasswordStatus,
    startRoomPasswordUpdate,
    handleSetRoomPassword,
  };
}
