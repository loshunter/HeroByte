// ============================================================================
// useSfx
// ============================================================================
// Stable accessor for firing sound effects from components. The engine itself
// reads the live mute/volume settings, so this hook stays dependency-free.

import { useCallback } from "react";
import { sfxEngine } from "./sfxEngine";
import type { SfxName } from "./sfxManifest";

export interface UseSfx {
  play: (name: SfxName, options?: { gainScale?: number; rate?: number }) => void;
}

export function useSfx(): UseSfx {
  const play = useCallback<UseSfx["play"]>((name, options) => {
    sfxEngine.play(name, options);
  }, []);

  return { play };
}
