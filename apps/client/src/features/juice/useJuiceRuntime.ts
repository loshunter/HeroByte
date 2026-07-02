// ============================================================================
// useJuiceRuntime
// ============================================================================
// Mounted once near the app root. Reflects the motion setting onto <html>,
// installs the audio auto-unlock gesture listeners, and preloads SFX samples so
// the first dice roll / hit lands without fetch latency.

import { useEffect } from "react";
import { applyMotionAttribute } from "./juiceSettings";
import { sfxEngine } from "./sfxEngine";

export function useJuiceRuntime(): void {
  useEffect(() => {
    applyMotionAttribute();
    sfxEngine.installAutoUnlock();
    // Preload in the background; failures are swallowed inside the engine.
    void sfxEngine.preload();
  }, []);
}
