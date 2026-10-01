// ============================================================================
// CONNECTION CHIP
// ============================================================================
// The table's link to the server, as a chip that TAKES ITS PLACE IN THE LAYOUT.
// It used to be a fixed badge painted over whatever was at the top centre — the
// phone's screen titles, then PREV / NEXT — because nothing owned the space.
// Now its host does: the Table menu beside the header's Table button (the button
// itself carries the dot), the row above a phone full screen's title, the phone dice
// overlay (which covers the screen and the top stack with it), the phone map's
// top stack. It is how the table says it has lost the server — the words for
// WHY it is waiting are ReconnectNotice's — so it keeps the project's 11px floor.

import React from "react";
import "./table.css";

export const ConnectionChip: React.FC<{ isConnected: boolean }> = ({ isConnected }) => (
  <span
    role="status"
    data-testid="connection-chip"
    className={`connection-chip connection-chip--${isConnected ? "online" : "offline"}`}
  >
    <span aria-hidden="true" className="connection-chip__dot">
      {isConnected ? "🟢" : "🔴"}
    </span>
    <span>{isConnected ? "ONLINE" : "OFFLINE"}</span>
  </span>
);
