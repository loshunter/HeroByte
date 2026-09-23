import { useState } from "react";

export type LogTab = "chat" | "rolls";

const storageKey = (uid: string) => `herobyte:chat-rolls-tab:${uid}`;
// Keep failed writes across panel/layout remounts without retaining unbounded
// identities in a long-running browser. Values contain navigation only.
const fallbackTabs = new Map<string, LogTab>();
const MAX_FALLBACK_PLAYERS = 64;

function rememberFallback(uid: string, tab: LogTab) {
  fallbackTabs.delete(uid);
  fallbackTabs.set(uid, tab);
  if (fallbackTabs.size > MAX_FALLBACK_PLAYERS) {
    const oldestUid = fallbackTabs.keys().next().value;
    if (oldestUid !== undefined) fallbackTabs.delete(oldestUid);
  }
}

function readTab(uid?: string): LogTab {
  if (!uid) return "chat";
  const fallback = fallbackTabs.get(uid);
  if (fallback) return fallback;
  try {
    return sessionStorage.getItem(storageKey(uid)) === "rolls" ? "rolls" : "chat";
  } catch {
    return "chat";
  }
}

/** Local navigation only: never derived from snapshots or shared with the table. */
export function useLogTab(uid?: string): [LogTab, (tab: LogTab) => void] {
  const [selection, setSelection] = useState(() => ({ uid, tab: readTab(uid) }));
  // Changing player identity must never reuse the previous player's preference.
  const tab = selection.uid === uid ? selection.tab : readTab(uid);

  const selectTab = (nextTab: LogTab) => {
    setSelection({ uid, tab: nextTab });
    if (!uid) return;
    try {
      sessionStorage.setItem(storageKey(uid), nextTab);
      fallbackTabs.delete(uid);
    } catch {
      rememberFallback(uid, nextTab);
    }
  };

  return [tab, selectTab];
}
