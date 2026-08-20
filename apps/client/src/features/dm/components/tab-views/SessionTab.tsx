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
import { SaveAsPrivateTableControl } from "../session-controls/SaveAsPrivateTableControl";
import { TableInviteControl } from "../session-controls/TableInviteControl";
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
  onSetRoomPassword?: (secret?: string) => void;
  /** Status message for room password operations */
  roomPasswordStatus?: { type: "success" | "error"; message: string } | null;
  /** Whether a room password operation is in progress */
  roomPasswordPending?: boolean;
  /** Optional callback to dismiss the room password status message */
  onDismissRoomPasswordStatus?: () => void;
  /**
   * Present only on the public test table, where the password is fixed: copies
   * this table into a new private one and goes there.
   */
  onSaveAsPrivateTable?: (input: {
    name: string;
    roomPassword: string;
    dmPassword?: string;
  }) => Promise<void>;

  // Players panel props
  /** Current number of players online */
  playerCount: number;

  // Player props toggle
  /** Whether players may create/edit/delete their own props. */
  playerPropsEnabled?: boolean;
  /** Callback to flip the player-props toggle. */
  onPlayerPropsEnabledChange?: (enabled: boolean) => void;

  // Initiative manual-override toggle
  /**
   * Whether players may enter an initiative by hand instead of rolling.
   *
   * Defaults to TRUE, unlike playerPropsEnabled — the caller derives it with
   * `!== false`, because the snapshot only carries this key when it is off.
   */
  initiativeManualOverride?: boolean;
  /** Callback to flip the manual-override toggle. */
  onInitiativeManualOverrideChange?: (enabled: boolean) => void;
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
  onSaveAsPrivateTable,
  playerCount,
  playerPropsEnabled = false,
  onPlayerPropsEnabledChange,
  // Default TRUE, and deliberately not `= false` like the prop above: a table
  // that has never touched this setting has it ON.
  initiativeManualOverride = true,
  onInitiativeManualOverrideChange,
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

      {/* Sharing a table belongs inside it — this is where you land after
          creating or forking one. */}
      <TableInviteControl />

      {/* The test table has no password to manage — it is fixed so the table
          stays open for everyone — so it offers the operation that IS available
          there instead: take a durable copy before the hourly wipe. */}
      {onSaveAsPrivateTable ? (
        <SaveAsPrivateTableControl onSave={onSaveAsPrivateTable} />
      ) : (
        <RoomPasswordControl
          onSetRoomPassword={onSetRoomPassword}
          roomPasswordStatus={roomPasswordStatus}
          roomPasswordPending={roomPasswordPending}
          onDismissRoomPasswordStatus={onDismissRoomPasswordStatus}
        />
      )}

      {/* Table policy, so it lives with the other table-level controls. Only
          the players' OWN props open up — never the map editor; that
          distinction is the whole reason this toggle is safe to offer. */}
      {onPlayerPropsEnabledChange && (
        <JRPGPanel variant="simple" title="Player Props">
          <label
            className="jrpg-text-small"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--jrpg-white)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={playerPropsEnabled}
              onChange={(e) => onPlayerPropsEnabledChange(e.target.checked)}
            />
            Players can add props
          </label>
          <div
            style={{
              marginTop: "6px",
              fontFamily: "var(--font-body)",
              fontSize: "11px",
              lineHeight: 1.5,
              color: "var(--jrpg-white)",
              opacity: 0.8,
            }}
          >
            Lets players place, edit, and remove their own image props (furniture, chests, scene
            dressing). They never gain map tools, and you can always adjust or delete what they add.
          </div>
        </JRPGPanel>
      )}

      {/* Also table policy, and ON by default: entering a number by hand is
          what the control exists to serve — a bad roll, you allow a physical
          re-roll, the real number goes in. Turning it off makes the server's
          die the only way in. */}
      {onInitiativeManualOverrideChange && (
        <JRPGPanel variant="simple" title="Initiative">
          <label
            className="jrpg-text-small"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--jrpg-white)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              data-testid="initiative-manual-override-toggle"
              checked={initiativeManualOverride}
              onChange={(e) => onInitiativeManualOverrideChange(e.target.checked)}
            />
            Players can enter initiative by hand
          </label>
          <div
            style={{
              marginTop: "6px",
              fontFamily: "var(--font-body)",
              fontSize: "11px",
              lineHeight: 1.5,
              color: "var(--jrpg-white)",
              opacity: 0.8,
            }}
          >
            Keeps <strong>USE PHYSICAL DICE</strong> available, for tables rolling real dice at a
            real table. Every hand-entered number still reaches the roll log, marked as entered, so
            nothing is hidden. Turn it off and the server&rsquo;s die is the only way in.
          </div>
        </JRPGPanel>
      )}

      <JRPGPanel variant="simple" title="Players">
        <div className="jrpg-text-small" style={{ color: "var(--jrpg-white)" }}>
          {playerCount} player{playerCount === 1 ? "" : "s"} currently online
        </div>
      </JRPGPanel>
    </div>
  );
}
