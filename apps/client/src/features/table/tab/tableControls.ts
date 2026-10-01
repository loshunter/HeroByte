// ============================================================================
// TABLE CONTROLS
// ============================================================================
// Everything the DM menu's Table tab reads and sends, as ONE required object
// (the shape Encounter uses): the menu cannot mount Table with a control
// silently unwired, the way two dozen optional props could. The Session and
// Players tabs it replaces took these one by one through DMMenu. Built once, in
// DMMenuContainer, from the snapshot and the senders the old tabs already used.

import type { Player, RoomSnapshot, SceneObject } from "@herobyte/shared";
import { manualInitiativeEnabled } from "../../initiative/manualOverride";
import type { SeatCharacter } from "./seatRemoval";

export interface TableControls {
  /** Opens the password dialog's confirm: Leave DM mode. */
  onToggleDM: (next: boolean) => void;
  /** `snapshot.tableName`: the Invite section names the table with it. */
  tableName: string | undefined;
  /** The public test table clears when empty, which changes what Backups says. */
  isPublicTable: boolean;

  // Players at this table
  players: Player[];
  sceneObjects: SceneObject[];
  characters: readonly SeatCharacter[];
  /** The AUTHENTICATED roster (snapshot.users): a player outside it is not at the table. */
  connectedUids: readonly string[] | undefined;
  onSelectPlayerTokens: (playerUid: string) => void;
  /** The DM clears a player who is not connected: their seat, characters and tokens. */
  onRemovePlayer: ((playerUid: string) => void) | undefined;

  // Permissions
  playerPropsEnabled: boolean;
  onPlayerPropsEnabledChange: (enabled: boolean) => void;
  /** ON by default: the snapshot carries its key only when it is off (see manualOverride.ts). */
  initiativeManualOverride: boolean;
  onInitiativeManualOverrideChange: (enabled: boolean) => void;

  // Backups
  /** Absent until a snapshot has arrived: there is nothing to download yet. */
  onRequestSaveSession: ((sessionName: string) => void) | undefined;
  onRequestLoadSession: (file: File) => void;

  // Security
  onSetRoomPassword: ((secret?: string) => void) | undefined;
  roomPasswordStatus: { type: "success" | "error"; message: string } | null | undefined;
  roomPasswordPending: boolean | undefined;
  onDismissRoomPasswordStatus: (() => void) | undefined;
  /** Present only on the public test table, whose password is fixed. */
  onSaveAsPrivateTable:
    | ((input: { name: string; roomPassword: string; dmPassword?: string }) => Promise<void>)
    | undefined;
}

/** What the container supplies; the rest is read off the snapshot. */
export type TableControlsWiring = Pick<
  TableControls,
  | "onToggleDM"
  | "connectedUids"
  | "onSelectPlayerTokens"
  | "onRemovePlayer"
  | "onPlayerPropsEnabledChange"
  | "onInitiativeManualOverrideChange"
  | "onRequestSaveSession"
  | "onRequestLoadSession"
  | "onSetRoomPassword"
  | "roomPasswordStatus"
  | "roomPasswordPending"
  | "onDismissRoomPasswordStatus"
  | "onSaveAsPrivateTable"
>;

export function buildTableControls(
  snapshot: RoomSnapshot | null,
  wiring: TableControlsWiring,
): TableControls {
  return {
    ...wiring,
    tableName: snapshot?.tableName,
    isPublicTable: snapshot?.isPublicTable === true,
    players: snapshot?.players ?? [],
    sceneObjects: snapshot?.sceneObjects ?? [],
    characters: snapshot?.characters ?? [],
    playerPropsEnabled: snapshot?.playerPropsEnabled ?? false,
    initiativeManualOverride: manualInitiativeEnabled(snapshot),
  };
}
