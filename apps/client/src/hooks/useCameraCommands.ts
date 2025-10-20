/**
 * useCameraCommands - Camera Command Management Hook
 *
 * Manages camera positioning commands in a fire-and-forget pattern.
 * Commands are issued to trigger camera movements, then cleared once handled.
 *
 * ## Command Pattern
 * This hook implements a fire-and-forget command pattern:
 * 1. User triggers an action (focus self, reset camera)
 * 2. Hook sets a camera command
 * 3. MapBoard reads and executes the command
 * 4. MapBoard calls onCameraCommandHandled to clear the command
 *
 * ## Dependencies
 * - **snapshot**: RoomSnapshot containing tokens array, used to find user's token
 * - **uid**: User ID string, used to identify which token belongs to the user
 *
 * ## Usage
 * ```tsx
 * const { cameraCommand, handleFocusSelf, handleResetCamera, handleCameraCommandHandled } =
 *   useCameraCommands({ snapshot, uid });
 *
 * // Pass to Header for toolbar buttons
 * <Header onFocusSelf={handleFocusSelf} onResetCamera={handleResetCamera} />
 *
 * // Pass to MapBoard for command execution
 * <MapBoard cameraCommand={cameraCommand} onCameraCommandHandled={handleCameraCommandHandled} />
 * ```
 *
 * @module useCameraCommands
 */

import { useState, useCallback } from "react";
import type { RoomSnapshot } from "@shared";
import type { CameraCommand } from "../ui/MapBoard";

interface UseCameraCommandsParams {
  /** Current room snapshot, contains tokens array */
  snapshot: RoomSnapshot | null;
  /** Current user's unique identifier */
  uid: string;
}

interface UseCameraCommandsReturn {
  /** Current camera command to be executed (null when no command pending) */
  cameraCommand: CameraCommand | null;
  /** Focus camera on user's token (shows alert if no token exists) */
  handleFocusSelf: () => void;
  /** Reset camera to default position/zoom */
  handleResetCamera: () => void;
  /** Clear the current camera command after it has been handled */
  handleCameraCommandHandled: () => void;
}

/**
 * Hook for managing camera positioning commands.
 *
 * Provides handlers for common camera operations:
 * - Focus on user's own token
 * - Reset camera to default view
 * - Clear commands after execution
 *
 * @param params - Hook parameters
 * @returns Camera command state and handler functions
 */
export function useCameraCommands({
  snapshot,
  uid,
}: UseCameraCommandsParams): UseCameraCommandsReturn {
  // State: Current camera command (null when no command pending)
  const [cameraCommand, setCameraCommand] = useState<CameraCommand | null>(null);

  /**
   * Focus camera on the user's token.
   * Shows an alert if the user doesn't have a token on the map yet.
   */
  const handleFocusSelf = useCallback(() => {
    const myToken = snapshot?.tokens?.find((t) => t.owner === uid);
    if (!myToken) {
      window.alert("You don't have a token on the map yet.");
      return;
    }
    setCameraCommand({ type: "focus-token", tokenId: myToken.id });
  }, [snapshot?.tokens, uid]);

  /**
   * Reset camera to default position and zoom level.
   */
  const handleResetCamera = useCallback(() => {
    setCameraCommand({ type: "reset" });
  }, []);

  /**
   * Clear the current camera command.
   * Called by MapBoard after the command has been executed.
   */
  const handleCameraCommandHandled = useCallback(() => {
    setCameraCommand(null);
  }, []);

  return {
    cameraCommand,
    handleFocusSelf,
    handleResetCamera,
    handleCameraCommandHandled,
  };
}
