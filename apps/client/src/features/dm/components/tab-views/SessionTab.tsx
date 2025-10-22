// ============================================================================
// SESSION TAB COMPONENT
// ============================================================================
// Composition component that renders the Session tab content in the DM Menu.
// This tab provides session management controls including:
// - Session persistence (save/load functionality)
// - Room password protection
// - Current player count display
//
// This is a pure presentation component that composes existing control
// components without adding additional business logic.

import { SessionPersistenceControl } from "../session-controls/SessionPersistenceControl";
import { RoomPasswordControl } from "../session-controls/RoomPasswordControl";
import { JRPGPanel } from "../../../../components/ui/JRPGPanel";

/**
 * Props for the SessionTab component.
 * Combines props for all child components used in the Session tab.
 */
interface SessionTabProps {
  // SessionPersistenceControl props
  /** Current session name */
  sessionName: string;
  /** Callback to update session name */
  setSessionName: (name: string) => void;
  /** Optional callback to request saving the session */
  onRequestSaveSession?: (sessionName: string) => void;
  /** Optional callback to request loading a session */
  onRequestLoadSession?: (file: File) => void;
  /** Whether the save button should be disabled */
  saveDisabled: boolean;
  /** Whether the load button should be disabled */
  loadDisabled: boolean;

  // RoomPasswordControl props
  /** Optional callback to set or clear the room password */
  onSetRoomPassword?: (secret: string) => void;
  /** Status message for room password operations */
  roomPasswordStatus?: { type: "success" | "error"; message: string } | null;
  /** Whether a room password operation is in progress */
  roomPasswordPending?: boolean;
  /** Optional callback to dismiss the room password status message */
  onDismissRoomPasswordStatus?: () => void;

  // Players panel props
  /** Current number of players online */
  playerCount: number;
}

/**
 * SessionTab component
 *
 * Renders the Session tab content for the DM Menu, which includes:
 * 1. Session Persistence Control - Save and load session state
 * 2. Room Password Control - Set or clear password protection
 * 3. Players Panel - Display current online player count
 *
 * This component is responsible only for layout and composition of these
 * three sections. All business logic is handled by the individual control
 * components or their parent containers.
 *
 * @param props - SessionTabProps containing all necessary data and callbacks
 * @returns The rendered Session tab content
 */
export default function SessionTab({
  sessionName,
  setSessionName,
  onRequestSaveSession,
  onRequestLoadSession,
  saveDisabled,
  loadDisabled,
  onSetRoomPassword,
  roomPasswordStatus,
  roomPasswordPending,
  onDismissRoomPasswordStatus,
  playerCount,
}: SessionTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <SessionPersistenceControl
        sessionName={sessionName}
        setSessionName={setSessionName}
        onRequestSaveSession={onRequestSaveSession}
        onRequestLoadSession={onRequestLoadSession}
        saveDisabled={saveDisabled}
        loadDisabled={loadDisabled}
      />

      <RoomPasswordControl
        onSetRoomPassword={onSetRoomPassword}
        roomPasswordStatus={roomPasswordStatus}
        roomPasswordPending={roomPasswordPending}
        onDismissRoomPasswordStatus={onDismissRoomPasswordStatus}
      />

      <JRPGPanel variant="simple" title="Players">
        <div className="jrpg-text-small" style={{ color: "var(--jrpg-white)" }}>
          {playerCount} player{playerCount === 1 ? "" : "s"} currently online
        </div>
      </JRPGPanel>
    </div>
  );
}
