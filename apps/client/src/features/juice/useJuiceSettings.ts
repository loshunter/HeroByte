// ============================================================================
// useJuiceSettings / useReducedMotion
// ============================================================================
// React bindings for the juice settings singleton.

import { useSyncExternalStore } from "react";
import {
  getJuiceSettings,
  motionDisabled,
  subscribeJuiceSettings,
  type JuiceSettings,
  type MotionLevel,
} from "./juiceSettings";

/** Subscribe to the full juice settings object. */
export function useJuiceSettings(): JuiceSettings {
  return useSyncExternalStore(subscribeJuiceSettings, getJuiceSettings, getJuiceSettings);
}

/**
 * True when juice motion should be suppressed for this user (motion === "off").
 * Components should read this before spawning transient animations.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeJuiceSettings, motionDisabled, motionDisabled);
}

/** Convenience selector for the current motion level. */
export function useMotionLevel(): MotionLevel {
  return useJuiceSettings().motion;
}
