// ============================================================================
// useCrtPreference
// ============================================================================
// React binding for the local CRT preference store. Both layouts consume the
// same snapshot, so crossing the mobile breakpoint does not reset the effect.

import { useSyncExternalStore } from "react";
import { getCrtPreference, setCrtPreference, subscribeCrtPreference } from "./crtPreference";

export function useCrtPreference(): readonly [
  enabled: boolean,
  setEnabled: (next: boolean) => void,
] {
  const enabled = useSyncExternalStore(subscribeCrtPreference, getCrtPreference, getCrtPreference);
  return [enabled, setCrtPreference];
}
