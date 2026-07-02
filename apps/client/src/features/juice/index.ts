// ============================================================================
// JUICE — public API
// ============================================================================
// "Game feel" for HeroByte: SNES-flavoured sample SFX + combat feedback, all
// gated behind user-controllable motion/volume settings.

export type { MotionLevel, JuiceSettings } from "./juiceSettings";
export {
  getJuiceSettings,
  setMotionLevel,
  setMuted,
  toggleMuted,
  setVolume,
  motionDisabled,
  applyMotionAttribute,
} from "./juiceSettings";
export { useJuiceSettings, useReducedMotion, useMotionLevel } from "./useJuiceSettings";
export { useJuiceRuntime } from "./useJuiceRuntime";
export { useTurnChime } from "./useTurnChime";
export { useSfx } from "./useSfx";
export { sfxEngine } from "./sfxEngine";
export type { SfxName } from "./sfxManifest";
export { JuiceSettingsControl } from "./JuiceSettingsControl";
export { FloatingDamageNumber } from "./FloatingDamageNumber";
export type { HpChangeKind } from "./FloatingDamageNumber";
export { useHpFeedback } from "./useHpFeedback";
export type { HpFeedback } from "./useHpFeedback";
export { detectRollFlavor } from "./diceJuice";
export type { RollFlavor } from "./diceJuice";
