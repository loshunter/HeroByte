/**
 * useSessionManagement Hook
 *
 * Encapsulates session save/load workflow logic.
 * Handles exporting room state to JSON files and importing saved sessions.
 *
 * Extracted from: apps/client/src/ui/App.tsx (lines 411-467)
 * Extraction date: 2025-10-20
 *
 * This hook handles:
 * - Session export (save) with validation and error handling
 * - Session import (load) with validation and warnings for incomplete data
 * - Toast notifications for all workflow states
 * - Server communication for loaded session data
 *
 * @module features/session/useSessionManagement
 */

import { useCallback } from "react";
import type { RoomSnapshot, ClientMessage } from "@shared";
import { saveSession, loadSession } from "../../utils/sessionPersistence";

/**
 * Toast notification interface for displaying status messages.
 * Matches the return type of useToast hook.
 */
export interface ToastManager {
  /**
   * Display an info toast notification
   * @param message - The message to display
   * @param duration - Optional duration in milliseconds (default: 3000)
   */
  info: (message: string, duration?: number) => void;

  /**
   * Display a success toast notification
   * @param message - The message to display
   * @param duration - Optional duration in milliseconds (default: 3000)
   */
  success: (message: string, duration?: number) => void;

  /**
   * Display a warning toast notification
   * @param message - The message to display
   * @param duration - Optional duration in milliseconds (default: 3000)
   */
  warning: (message: string, duration?: number) => void;

  /**
   * Display an error toast notification
   * @param message - The message to display
   * @param duration - Optional duration in milliseconds (default: 3000)
   */
  error: (message: string, duration?: number) => void;
}

/**
 * Dependencies required by the useSessionManagement hook.
 */
export interface UseSessionManagementOptions {
  /**
   * Current room snapshot containing all game state.
   * Required for saving sessions. If null, save operations will be rejected.
   */
  snapshot: RoomSnapshot | null;

  /**
   * WebSocket message sender for client-server communication.
   * Used to send load-session messages to the server.
   */
  sendMessage: (msg: ClientMessage) => void;

  /**
   * Toast notification manager for displaying status messages.
   */
  toast: ToastManager;
}

/**
 * Session management action functions returned by the hook.
 */
export interface UseSessionManagementReturn {
  /**
   * Save the current session to a JSON file.
   *
   * Downloads the current room snapshot as a timestamped JSON file.
   * The filename format is: `{name}-{timestamp}.json`
   *
   * Workflow:
   * 1. Validates that snapshot exists
   * 2. Shows info toast: "Preparing session file..."
   * 3. Triggers file download with sessionPersistence utility
   * 4. Shows success toast on completion
   * 5. Shows error toast if any step fails
   *
   * @param name - Base name for the session file (will be sanitized and timestamped)
   *
   * @example
   * ```tsx
   * handleSaveSession("epic-campaign");
   * // Downloads: epic-campaign-20251020T143022Z.json
   * ```
   */
  handleSaveSession: (name: string) => void;

  /**
   * Load a session from a JSON file.
   *
   * Reads and validates a session file, then sends it to the server.
   * Validates that the loaded snapshot contains expected game data and shows
   * warnings if scene objects or characters are missing.
   *
   * Workflow:
   * 1. Shows info toast: "Loading session from {filename}..."
   * 2. Reads and parses the file using sessionPersistence utility
   * 3. Validates scene objects and characters exist
   * 4. Sends load-session message to server
   * 5. Shows success/warning toast based on validation results
   * 6. Shows error toast if file is corrupted or invalid
   *
   * @param file - The session file to load (must be valid JSON)
   * @returns Promise that resolves when load completes or rejects on error
   *
   * @example
   * ```tsx
   * // From file input onChange handler
   * const file = event.target.files[0];
   * await handleLoadSession(file);
   * ```
   */
  handleLoadSession: (file: File) => Promise<void>;
}

/**
 * Hook providing session save/load functionality.
 *
 * Manages the complete workflow for persisting and restoring game sessions.
 * Includes comprehensive validation, error handling, and user feedback via
 * toast notifications.
 *
 * @param options - Hook dependencies
 * @returns Session management action functions
 *
 * @example
 * ```tsx
 * const sessionActions = useSessionManagement({
 *   snapshot,
 *   sendMessage,
 *   toast
 * });
 *
 * // Save current session
 * sessionActions.handleSaveSession("my-campaign");
 *
 * // Load a session file
 * const file = event.target.files[0];
 * await sessionActions.handleLoadSession(file);
 * ```
 */
export function useSessionManagement({
  snapshot,
  sendMessage,
  toast,
}: UseSessionManagementOptions): UseSessionManagementReturn {
  /**
   * Save the current session to a JSON file.
   *
   * Validates that a snapshot exists before attempting to save.
   * On success, triggers a browser download with a timestamped filename.
   * All errors are caught, logged, and displayed to the user.
   */
  const handleSaveSession = useCallback(
    (name: string) => {
      if (!snapshot) {
        toast.warning("No session data available to save yet.");
        return;
      }
      try {
        toast.info("Preparing session file...");
        saveSession(snapshot, name);
        toast.success(`Session "${name}" saved successfully!`, 4000);
      } catch (err) {
        console.error("Failed to save session", err);
        toast.error(
          err instanceof Error
            ? `Save failed: ${err.message}`
            : "Failed to save session. Check console for details.",
          5000,
        );
      }
    },
    [snapshot, toast],
  );

  /**
   * Load a session from a JSON file.
   *
   * Reads and validates the session file, checking for:
   * - Valid JSON structure
   * - Presence of scene objects
   * - Presence of characters
   *
   * If validation warnings are found, they're displayed to the user
   * but the session is still loaded. Critical errors (corrupted file,
   * invalid JSON) prevent loading and show an error toast.
   */
  const handleLoadSession = useCallback(
    async (file: File) => {
      try {
        toast.info(`Loading session from ${file.name}...`);
        const loadedSnapshot = await loadSession(file);

        // Validate snapshot has expected data
        const warnings: string[] = [];
        if (!loadedSnapshot.sceneObjects || loadedSnapshot.sceneObjects.length === 0) {
          warnings.push("No scene objects found");
        }
        if (!loadedSnapshot.characters || loadedSnapshot.characters.length === 0) {
          warnings.push("No characters found");
        }

        sendMessage({ t: "load-session", snapshot: loadedSnapshot });

        if (warnings.length > 0) {
          toast.warning(`Session loaded with warnings: ${warnings.join(", ")}`, 5000);
        } else {
          toast.success(`Session "${file.name}" loaded successfully!`, 4000);
        }
      } catch (err) {
        console.error("Failed to load session", err);
        toast.error(
          err instanceof Error
            ? `Load failed: ${err.message}`
            : "Failed to load session. File may be corrupted.",
          5000,
        );
      }
    },
    [sendMessage, toast],
  );

  return {
    handleSaveSession,
    handleLoadSession,
  };
}

export default useSessionManagement;
