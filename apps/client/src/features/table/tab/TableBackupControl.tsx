// ============================================================================
// TABLE BACKUP CONTROL
// ============================================================================
// The whole table as a file, and back (U9: it was "Session Save/Load" with
// "Save Game State" / "Load Game State"). The labels name the SCOPE before a
// file is ever chosen — the whole table, not a character and not a map — and the
// panel says, separately, that the server already keeps the table saved between
// visits, so a backup reads as the thing you keep yourself rather than the only
// way not to lose the table.

import { ChangeEvent, useRef } from "react";
import { JRPGPanel, JRPGButton } from "../../../components/ui/JRPGPanel";

/**
 * Props for the TableBackupControl component
 */
interface TableBackupControlProps {
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
   * Whether the restore button should be disabled.
   * Typically true when restoring is unavailable.
   */
  loadDisabled: boolean;

  /**
   * The public test table is wiped once it has sat empty, so "the server keeps
   * this table" would be false there: it says so instead.
   */
  isPublicTable?: boolean;
}

const noteStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-body)",
  fontSize: "11px",
  lineHeight: 1.5,
  color: "var(--jrpg-white)",
};

/**
 * Table Backup Control Component
 *
 * Provides a UI for DMs to download a backup of the whole table and restore one.
 * Manages the file-name input, the two buttons, and file input handling.
 *
 * @param props - Component properties
 * @returns The table backup control UI
 */
export function TableBackupControl({
  sessionName,
  setSessionName,
  onRequestSaveSession,
  onRequestLoadSession,
  saveDisabled,
  loadDisabled,
  isPublicTable = false,
}: TableBackupControlProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Handles the download action.
   * Trims the file name and provides a default if empty.
   */
  const handleSaveSession = () => {
    if (!onRequestSaveSession) return;
    const trimmed = sessionName.trim();
    onRequestSaveSession(trimmed.length > 0 ? trimmed : "table-backup");
  };

  /**
   * Handles file selection for restoring a table backup.
   * Resets the file input afterwards to allow selecting the same file again.
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
    <JRPGPanel variant="simple">
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <p className="jrpg-text-small" style={noteStyle}>
          {isPublicTable
            ? "This public test table clears once it has sat empty (an hour by default). A backup is a file you keep yourself; to keep the table on the server, save it as a private table (Security)."
            : "The server keeps this table saved between visits on its own. A backup is a file you keep yourself, to move the table or to bring an earlier version of its map back."}
        </p>

        <span className="jrpg-text-small" style={{ color: "var(--jrpg-gold)" }}>
          Table backup — the whole table
        </span>
        <p className="jrpg-text-small" style={noteStyle}>
          Everything at this table in one file: the map, tokens, characters, props, drawings and
          images.
        </p>

        <label
          className="jrpg-text-small"
          style={{ display: "flex", flexDirection: "column", gap: "4px" }}
        >
          Backup file name
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

        {/* Stacked: each label names a scope, and side by side in the DM menu's
            400px window they wrapped to two cramped lines apiece. */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <JRPGButton
            onClick={handleSaveSession}
            variant="success"
            disabled={saveDisabled}
            title={
              saveDisabled
                ? "Downloading is unavailable until the table state is ready."
                : undefined
            }
            style={{ fontSize: "10px" }}
          >
            Download table backup
          </JRPGButton>
          <JRPGButton
            onClick={() => fileInputRef.current?.click()}
            variant="primary"
            disabled={loadDisabled}
            title={loadDisabled ? "Restoring is unavailable at the moment." : undefined}
            style={{ fontSize: "10px" }}
          >
            Restore table backup…
          </JRPGButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            aria-label="Choose a table backup file to restore"
            style={{ display: "none" }}
            onChange={handleLoadSession}
          />
        </div>
        <p className="jrpg-text-small" style={noteStyle}>
          Restoring replaces the map, NPCs, props and drawings for everyone connected, and cannot be
          undone. Everyone with a seat here keeps their characters and tokens as they are now, and
          nobody&rsquo;s DM status changes. You are asked first.
        </p>

        <p className="jrpg-text-small" style={{ ...noteStyle, opacity: 0.75 }}>
          One character: Save character, in that character&rsquo;s ⚙️ settings. One map: Export
          editable map, in DM Menu → Maps.
        </p>
      </div>
    </JRPGPanel>
  );
}
