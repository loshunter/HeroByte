// ============================================================================
// TABLE SECTION
// ============================================================================
// One headed section of the DM menu's Table tab. A heading per task — Your role,
// Invite, Players at this table, Permissions, Backups, Security — so a host finds a
// control by what it is for rather than by which menu it grew in.

import React from "react";

export const TableSection: React.FC<{
  id: string;
  title: string;
  children: React.ReactNode;
}> = ({ id, title, children }) => (
  <section className="table-tab__section" aria-labelledby={id}>
    <h4 id={id} className="jrpg-text-command table-tab__title">
      {title}
    </h4>
    {children}
  </section>
);
