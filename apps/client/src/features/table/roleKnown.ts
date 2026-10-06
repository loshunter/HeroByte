// ============================================================================
// ROLE KNOWN — has the roster said who this seat is since the socket last dropped?
// ============================================================================
// Every socket close nulls the snapshot while the app stays mounted, and the DM
// flag reads false with it. A DM's layout keeps painting the cached DM snapshot
// through that blip (App's layoutSnapshot), so a component that sees "not DM"
// beside a full roster cannot tell a blip from a real demotion. Anything that
// CLOSES on losing DM rights (an editor, a settings window, the initiative
// dialog) waits for this to be true first: a reconnect must not throw away what
// the DM was typing. App provides it from useDMRole; outside the app (a test, a
// storybook) the default treats the role as known, which is the old behaviour.

import { createContext, useContext, useRef } from "react";

export const RoleKnownContext = createContext(true);

export function useRoleKnown(): boolean {
  return useContext(RoleKnownContext);
}

/**
 * The viewer's DM flag as the roster last confirmed it. Through a blip (the role
 * not known) it holds what it was, so the DM-only fields inside an open window
 * (sight, speed, owner, Token Lock, Delete Token) do not unmount and drop what the
 * DM was typing — and a player's window does not flash them either, as a bare
 * "DM or role unknown" gate would. The server still decides every send.
 */
export function useDMThroughBlip(isDM: boolean): boolean {
  const roleKnown = useRoleKnown();
  const confirmed = useRef(isDM);
  if (roleKnown) confirmed.current = isDM;
  return roleKnown ? isDM : confirmed.current;
}
