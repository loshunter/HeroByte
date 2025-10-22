// ============================================================================
// SESSION PERSISTENCE CONTROL COMPONENT
// ============================================================================
// Provides save/load functionality for game session state. Allows DMs to
// save the current game state (including map, characters, props, etc.) to
// a JSON file and load it back later to restore a session.

import { ChangeEvent, useRef } from "react";
import { JRPGPanel, JRPGButton } from "../../../../components/ui/JRPGPanel";

/**
 * Props for the SessionPersistenceControl component
 */
interface SessionPersistenceControlProps {
  /**
   * Current session name value
   */
  sessionName: string;

  /**
   * Callback to update the session name
   */
  setSessionName: (name: string) => void;

  /**
   * Callback to invoke when the DM requests to save the session.
   * Receives the session name to use for the saved file.
   */
  onRequestSaveSession?: (sessionName: string) => void;

  /**
   * Callback to invoke when the DM requests to load a session.
   * Receives the File object selected by the user.
   */
  onRequestLoadSession?: (file: File) => void;

  /**
   * Whether the save button should be disabled.
   * Typically true when the room state is not ready.
   */
  saveDisabled: boolean;

  /**
   * Whether the load button should be disabled.
   * Typically true when loading functionality is unavailable.
   */
  loadDisabled: boolean;
}

/**
 * Session Persistence Control Component
 *
 * Provides a UI for DMs to save and load game sessions. Manages session
 * name input, save/load buttons, and file input handling.
 *
 * @param props - Component properties
 * @returns The session persistence control UI
 */
export function SessionPersistenceControl({
  sessionName,
  setSessionName,
  onRequestSaveSession,
  onRequestLoadSession,
  saveDisabled,
  loadDisabled,
}: SessionPersistenceControlProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Handles the save session action.
   * Trims the session name and provides a default if empty.
   */
  const handleSaveSession = () => {
    if (!onRequestSaveSession) return;
    const trimmed = sessionName.trim();
    onRequestSaveSession(trimmed.length > 0 ? trimmed : "session");
  };

  /**
   * Handles file selection for loading a session.
   * Resets the file input after loading to allow selecting the same file again.
   *
   * @param event - The change event from the file input
   */
  const handleLoadSession = (event: ChangeEvent<HTMLInputElement>) => {
    if (!onRequestLoadSession) return;
    const file = event.target.files?.[0];
    if (file) {
      onRequestLoadSession(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Reset so same file can be chosen again
    }
  };

  return (
    <JRPGPanel variant="simple" title="Session Save/Load">
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label
          className="jrpg-text-small"
          style={{ display: "flex", flexDirection: "column", gap: "4px" }}
        >
          Session Name
          <input
            type="text"
            value={sessionName}
            onChange={(event) => setSessionName(event.target.value)}
            style={{
              width: "100%",
              padding: "6px",
              background: "#111",
              color: "var(--jrpg-white)",
              border: "1px solid var(--jrpg-border-gold)",
            }}
          />
        </label>

        <div style={{ display: "flex", gap: "8px" }}>
          <JRPGButton
            onClick={handleSaveSession}
            variant="success"
            disabled={saveDisabled}
            title={saveDisabled ? "Save is unavailable until the room state is ready." : undefined}
            style={{ fontSize: "10px", flex: 1 }}
          >
            Save Game State
          </JRPGButton>
          <JRPGButton
            onClick={() => fileInputRef.current?.click()}
            variant="primary"
            disabled={loadDisabled}
            title={loadDisabled ? "Loading is unavailable at the moment." : undefined}
            style={{ fontSize: "10px", flex: 1 }}
          >
            Load Game State
          </JRPGButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={handleLoadSession}
          />
        </div>
      </div>
    </JRPGPanel>
  );
}
