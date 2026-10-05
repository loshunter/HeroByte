// ============================================================================
// TABLE TAB (DM Menu → Table)
// ============================================================================
// The table's own settings, in one place (U9): Invite, Players at this table,
// Permissions, Backups and Security, with your role — and the way to leave DM
// mode — at the top. It replaces the Session and Players tabs, each of which
// held some of these under a name that described where the feature was built.
// NPC editing stays in NPCs & Monsters and combat in Encounter.
//
// Pure composition over the control components; every read and send arrives in
// the ONE required `controls` object (tableControls.ts).

import { TableRoleControl } from "../TableRoleControl";
import { SaveAsPrivateTableControl } from "./SaveAsPrivateTableControl";
import { TableBackupControl } from "./TableBackupControl";
import { TableInviteControl } from "./TableInviteControl";
import { TablePasswordControl } from "./TablePasswordControl";
import TablePermissionsSection from "./TablePermissionsSection";
import TablePlayersSection from "./TablePlayersSection";
import { TableSection } from "./TableSection";
import type { TableControls } from "./tableControls";
import "./tableTab.css";

interface TableTabProps {
  controls: TableControls;
  /** The backup file's name, kept by the menu so it survives a tab switch. */
  sessionName: string;
  setSessionName: (name: string) => void;
}

export default function TableTab({ controls, sessionName, setSessionName }: TableTabProps) {
  return (
    <div className="table-tab">
      <TableSection id="table-tab-role" title="Your role">
        {/* The DM menu renders only for a DM, so the role is known and is DM. */}
        <TableRoleControl isDM roleKnown onToggleDM={controls.onToggleDM} />
      </TableSection>

      <TableSection id="table-tab-invite" title="Invite">
        <TableInviteControl tableName={controls.tableName} />
      </TableSection>

      <TableSection id="table-tab-players" title="Players at this table">
        <TablePlayersSection
          players={controls.players}
          sceneObjects={controls.sceneObjects}
          characters={controls.characters}
          connectedUids={controls.connectedUids}
          onSelectPlayerTokens={controls.onSelectPlayerTokens}
          onRemovePlayer={controls.onRemovePlayer}
        />
      </TableSection>

      <TableSection id="table-tab-permissions" title="Permissions">
        <TablePermissionsSection
          playerPropsEnabled={controls.playerPropsEnabled}
          onPlayerPropsEnabledChange={controls.onPlayerPropsEnabledChange}
          initiativeManualOverride={controls.initiativeManualOverride}
          onInitiativeManualOverrideChange={controls.onInitiativeManualOverrideChange}
        />
      </TableSection>

      <TableSection id="table-tab-backups" title="Backups">
        <TableBackupControl
          sessionName={sessionName}
          setSessionName={setSessionName}
          onRequestSaveSession={controls.onRequestSaveSession}
          onRequestLoadSession={controls.onRequestLoadSession}
          saveDisabled={!controls.onRequestSaveSession}
          loadDisabled={false}
          isPublicTable={controls.isPublicTable}
        />
      </TableSection>

      <TableSection id="table-tab-security" title="Security">
        {/* The test table has no password to manage — it is fixed (the server's
            setting) so no one can padlock it — so it offers the operation that IS
            available there instead: take a durable copy before the idle wipe. */}
        {controls.onSaveAsPrivateTable ? (
          <SaveAsPrivateTableControl onSave={controls.onSaveAsPrivateTable} />
        ) : (
          <TablePasswordControl
            onSetRoomPassword={controls.onSetRoomPassword}
            roomPasswordStatus={controls.roomPasswordStatus}
            roomPasswordPending={controls.roomPasswordPending}
            onDismissRoomPasswordStatus={controls.onDismissRoomPasswordStatus}
          />
        )}
      </TableSection>
    </div>
  );
}
