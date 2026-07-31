// ============================================================================
// TABLE PICKER
// ============================================================================
// Which table you are joining, as a single control directly above the one
// password field. The gate used to ask this question twice: a password box for
// "the current table" at the top, and a separate shelf at the bottom with its
// own chips, create form and join-by-code box — two logins for one action.
//
// Switching tables is still a full navigation (fresh socket, fresh auth), so
// the ?room= URL stays the single source of truth and invite links are
// unaffected.

import React from "react";
import { currentRoomId, listRememberedRooms, navigateToRoom } from "./roomDirectory";

export interface TablePickerProps {
  /** Overridable for tests; defaults to a full page navigation. */
  onNavigate?: (roomId: string | undefined) => void;
}

const TEST_TABLE_VALUE = "__default__";

const fieldStyle: React.CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  minHeight: "44px",
  padding: "10px 12px",
  marginBottom: "16px",
  borderRadius: "8px",
  border: "1px solid rgba(255, 215, 94, 0.4)",
  background: "rgba(12, 18, 38, 0.9)",
  color: "#e7ecff",
  fontSize: "0.95rem",
  fontFamily: "var(--font-body)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  margin: "0 0 6px",
  textAlign: "left",
  fontFamily: "'Press Start 2P', monospace",
  fontSize: "8px",
  color: "var(--jrpg-gold, #f0e2c3)",
};

export function TablePicker({ onNavigate }: TablePickerProps): JSX.Element | null {
  const activeRoomId = currentRoomId();
  const remembered = listRememberedRooms();
  const navigate = onNavigate ?? navigateToRoom;

  // A table reached by invite link is not in this browser's list yet, but it
  // still has to be selectable — otherwise the control would show someone
  // else's table as the wrong option.
  const options = [...remembered];
  if (activeRoomId && !options.some((room) => room.roomId === activeRoomId)) {
    options.unshift({ roomId: activeRoomId, lastJoined: Date.now() });
  }

  // With no private tables anywhere there is nothing to pick between — one
  // option is not a choice, so the control would be pure noise.
  if (options.length === 0) return null;

  return (
    <div>
      <label style={labelStyle} htmlFor="table-picker">
        Table
      </label>
      <select
        id="table-picker"
        style={fieldStyle}
        value={activeRoomId ?? TEST_TABLE_VALUE}
        onChange={(event) => {
          const next = event.target.value;
          navigate(next === TEST_TABLE_VALUE ? undefined : next);
        }}
      >
        <option value={TEST_TABLE_VALUE}>Main Hall — public test table</option>
        {options.map((room) => (
          <option key={room.roomId} value={room.roomId}>
            {room.name ? `${room.name} (${room.roomId})` : room.roomId}
          </option>
        ))}
      </select>
    </div>
  );
}
