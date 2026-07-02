// ============================================================================
// useHpFeedback
// ============================================================================
// Watches an entity's HP and emits transient combat feedback when it changes:
// a signed delta for a floating number, a flash kind for CSS, an incrementing
// animation key, and the matching SFX. The very first observed value only
// establishes a baseline (no feedback on mount / initial load).

import { useEffect, useRef, useState } from "react";
import { sfxEngine } from "./sfxEngine";
import { motionDisabled } from "./juiceSettings";
import type { HpChangeKind } from "./FloatingDamageNumber";

export interface HpFeedback {
  amount: number;
  kind: HpChangeKind;
  animationKey: number;
}

const FLASH_MS = 650;

export interface HpFeedbackOptions {
  /**
   * Whether this observer plays the damage/heal SFX. Defaults to true. Set
   * false for secondary mirrors (e.g. the map token) so the sound only fires
   * once even though several components watch the same HP value.
   */
  sound?: boolean;
}

export function useHpFeedback(
  hp: number | undefined,
  options: HpFeedbackOptions = {},
): {
  feedback: HpFeedback | null;
  flashClass: string;
} {
  const { sound = true } = options;
  const prevRef = useRef<number | undefined>(undefined);
  const keyRef = useRef(0);
  const [feedback, setFeedback] = useState<HpFeedback | null>(null);
  const [flashClass, setFlashClass] = useState("");

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = hp;

    // Establish baseline on first observation, or ignore undefined HP.
    if (prev === undefined || hp === undefined || hp === prev) return;

    const delta = hp - prev;
    const kind: HpChangeKind = delta < 0 ? "damage" : "heal";
    keyRef.current += 1;

    // Sound fires regardless of motion preference; it is separately mutable.
    if (sound) {
      sfxEngine.play(kind === "damage" ? "damage" : "heal");
    }

    if (motionDisabled()) return;

    setFeedback({ amount: delta, kind, animationKey: keyRef.current });
    setFlashClass(kind === "damage" ? "juice-flash-damage" : "juice-flash-heal");

    const timer = setTimeout(() => {
      setFeedback(null);
      setFlashClass("");
    }, FLASH_MS);

    return () => clearTimeout(timer);
  }, [hp, sound]);

  return { feedback, flashClass };
}
