// ============================================================================
// MICROPHONE NOTICE
// ============================================================================
// The one line a failed microphone leaves for the person, shown beside the mic
// control (CardControls) until the next try. A tiny store rather than a prop:
// there is ONE local microphone, the hook that starts it lives in App, and the
// control that shows the line is several components away through memoised cards.
//
// A player with several characters has several mic controls, so the line is shown
// beside the one that was PRESSED (it claims the notice when pressed). Until some
// control has claimed it, any control may show it.

import { useSyncExternalStore } from "react";

interface MicNoticeState {
  text: string | null;
  owner: string | null;
}

let state: MicNoticeState = { text: null, owner: null };
const listeners = new Set<() => void>();

const publish = (next: MicNoticeState) => {
  if (next.text === state.text && next.owner === state.owner) return;
  state = next;
  listeners.forEach((listener) => listener());
};

export const getMicNotice = (): string | null => state.text;

/** The text, or null to clear it. The claim stays: the next failure shows in the same place. */
export const setMicNotice = (text: string | null): void => publish({ ...state, text });

/** The control that was pressed claims the notice a failure of that press will produce. */
export const claimMicNotice = (owner: string): void => publish({ ...state, owner });

/** Test-only: forget the text AND the claim (a claim outlives a test otherwise). */
export function __resetMicNoticeForTests(): void {
  publish({ text: null, owner: null });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const snapshotFor = (owner: string) => () =>
  state.owner === null || state.owner === owner ? state.text : null;

/** The notice, for the control named `owner` (null where another control claimed it). */
export const useMicNotice = (owner: string): string | null =>
  useSyncExternalStore(subscribe, snapshotFor(owner), () => null);
