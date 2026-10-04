// ============================================================================
// TABLE MENU PROPS
// ============================================================================
// The ONE mapping from the layouts' props bag onto the Table menu's shape, for
// both layouts — the desktop header's Table button and the phone's Table screen
// read the same object, so role, preferences and connection state cannot be
// wired twice and drift (the lesson of buildDMMenuProps). Pure over the bag.

import { useRef } from "react";
import type { MainLayoutProps } from "../../layouts/props/MainLayoutProps";

export interface TableMenuProps {
  uid: string;
  /** `snapshot.tableName`: absent before the snapshot arrives and on the Main Hall. */
  tableName: string | undefined;
  isPublicTable: boolean;
  isConnected: boolean;
  /** Passed in, never read off the snapshot: the snapshot's value reads false on reconnect. */
  isDM: boolean;
  /** The viewer's seat is in the roster: the app's own test that the snapshot has arrived. */
  roleKnown: boolean;
  /** Opens the password dialog (Enter DM mode) or its confirm (Leave DM mode). */
  onToggleDM: (next: boolean) => void;
  crtFilter: boolean;
  onCrtFilterChange: (enabled: boolean) => void;
}

export function buildTableMenuProps(props: MainLayoutProps): TableMenuProps {
  return {
    uid: props.uid,
    tableName: props.snapshot?.tableName,
    isPublicTable: props.snapshot?.isPublicTable === true,
    isConnected: props.isConnected,
    isDM: props.isDM,
    roleKnown: props.roleKnown,
    onToggleDM: props.handleToggleDM,
    crtFilter: props.crtFilter,
    onCrtFilterChange: props.setCrtFilter,
  };
}

/**
 * What the layouts call. The table's NAME and whether it is the public test table are facts
 * about the TABLE, not role judgments: every socket close nulls the snapshot while the app
 * stays mounted, and the public-table warning is a row of the header now, so a flag that went
 * with the snapshot removed a row and put it back on every reconnect — shifting the whole
 * layout for the players it is meant to steady. They are held from the last snapshot; the
 * connection and the role are NEVER held (they are read live from the bag).
 */
export function useTableMenuProps(props: MainLayoutProps): TableMenuProps {
  const facts = useRef<Pick<TableMenuProps, "tableName" | "isPublicTable">>({
    tableName: undefined,
    isPublicTable: false,
  });
  if (props.snapshot) {
    facts.current = {
      tableName: props.snapshot.tableName,
      isPublicTable: props.snapshot.isPublicTable === true,
    };
  }
  return { ...buildTableMenuProps(props), ...facts.current };
}
