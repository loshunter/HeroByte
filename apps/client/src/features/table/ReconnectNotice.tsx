// ============================================================================
// RECONNECT NOTICE
// ============================================================================
// "Reconnecting…" / "Re-authenticating…", for as long as the gate says the table is
// not answering. It takes its place in the layout of whoever renders it (see
// reconnectPhase): under the header on a desktop (ReconnectNoticeDock), in the
// phone's top stack. It never takes a tap — a notice over a control is not worth
// the control.

import React from "react";
import { useReconnectPhase } from "./reconnectPhase";
import "./table.css";

export const ReconnectNotice: React.FC = () => {
  const phase = useReconnectPhase();
  if (!phase) return null;
  return (
    <span role="status" data-testid="reconnect-notice" className="reconnect-notice">
      {phase === "reauthenticating" ? "Re-authenticating…" : "Reconnecting…"}
    </span>
  );
};

/**
 * The desktop's place for it: a FIXED sibling of the header, `top` below the header's measured
 * bottom edge, and above the floating windows. Inside the header it would share the header's
 * stacking layer (z-index 100), and a window opened at the right edge — Chat & Rolls — would
 * paint over the very words that say the table is away.
 */
export const ReconnectNoticeDock: React.FC<{ top: number }> = ({ top }) => {
  const phase = useReconnectPhase();
  if (!phase) return null;
  return (
    <div className="reconnect-notice-dock" style={{ top }}>
      <ReconnectNotice />
    </div>
  );
};
