// A TableControls for tests that mount the DM menu (or the Table tab) and need the
// object, not its contents: every sender a spy, the table private, nobody absent.
import { vi } from "vitest";
import type { TableControls } from "../tableControls";

export function tableControls(overrides: Partial<TableControls> = {}): TableControls {
  return {
    onToggleDM: vi.fn(),
    tableName: undefined,
    isPublicTable: false,
    players: [],
    sceneObjects: [],
    characters: [],
    connectedUids: undefined,
    onSelectPlayerTokens: vi.fn(),
    onRemovePlayer: undefined,
    playerPropsEnabled: false,
    onPlayerPropsEnabledChange: vi.fn(),
    initiativeManualOverride: true,
    onInitiativeManualOverrideChange: vi.fn(),
    onRequestSaveSession: undefined,
    onRequestLoadSession: vi.fn(),
    onSetRoomPassword: undefined,
    roomPasswordStatus: null,
    roomPasswordPending: false,
    onDismissRoomPasswordStatus: undefined,
    onSaveAsPrivateTable: undefined,
    ...overrides,
  };
}
