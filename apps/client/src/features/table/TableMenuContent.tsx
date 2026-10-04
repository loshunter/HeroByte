// ============================================================================
// TABLE MENU CONTENT
// ============================================================================
// What the Table menu holds, for both presentations: the desktop header's
// popover and the phone's Table screen. The table by name, your role and the
// way to change it, your personal Preferences, and — for a DM — the way on to
// the table's settings. Everything here is the VIEWER's own; the table's
// settings (invites, permissions, backups, security) are the DM menu's Table tab.

import React from "react";
import { JRPGButton } from "../../components/ui/JRPGPanel";
import { ConnectionChip } from "./ConnectionChip";
import { PreferencesPanel } from "./PreferencesPanel";
import { TableRoleControl } from "./TableRoleControl";
import type { TableMenuProps } from "./tableMenuProps";
import "./table.css";

interface TableMenuContentProps {
  menu: TableMenuProps;
  label: string;
  /**
   * A phone screen carries the connection chip in its own title row, so its
   * content leaves it out; the desktop popover says it beside the name.
   */
  showConnection: boolean;
  /** Offered to a DM only: opens the DM menu on its Table tab. */
  onOpenTableSettings: () => void;
}

export const TableMenuContent: React.FC<TableMenuContentProps> = ({
  menu,
  label,
  showConnection,
  onOpenTableSettings,
}) => (
  <div className="table-menu">
    <div className="table-menu__head">
      <h3 className="table-menu__name">{label}</h3>
      {showConnection && <ConnectionChip isConnected={menu.isConnected} />}
    </div>

    <section className="table-menu__section" aria-labelledby="table-menu-role">
      <h4 id="table-menu-role" className="table-menu__title">
        Your role
      </h4>
      <TableRoleControl isDM={menu.isDM} roleKnown={menu.roleKnown} onToggleDM={menu.onToggleDM} />
      {menu.roleKnown && menu.isDM && (
        <>
          <JRPGButton onClick={onOpenTableSettings}>⚙️ Table settings…</JRPGButton>
          <p className="table-note">Invite players, permissions, backups and the table password.</p>
        </>
      )}
    </section>

    <section className="table-menu__section" aria-labelledby="table-menu-prefs">
      <h4 id="table-menu-prefs" className="table-menu__title">
        Preferences
      </h4>
      <PreferencesPanel crtFilter={menu.crtFilter} onCrtFilterChange={menu.onCrtFilterChange} />
    </section>

    {/* The start of the ID, as the header printed it, and no hover with the rest: the whole
        identifier is what claims a seat (with the table password, when no session holds it), so it
        is not something to leave in a tooltip, a screenshot or a screen reader's description. */}
    <p className="table-note table-note--soft">Your ID {menu.uid.substring(0, 8)}…</p>
  </div>
);
