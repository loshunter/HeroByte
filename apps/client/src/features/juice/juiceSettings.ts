// ============================================================================
// JUICE SETTINGS STORE
// ============================================================================
// A tiny framework-agnostic singleton for "game feel" preferences: motion
// level, SFX mute, and SFX volume. Persisted to localStorage and mirrored onto
// <html data-motion="..."> so CSS can gate juice animations. Consumed by React
// via useSyncExternalStore (see useJuiceSettings) and by the SFX engine.

export type MotionLevel = "full" | "subtle" | "off";

export interface JuiceSettings {
  /** How much animation to play. "off" disables juice motion entirely. */
  motion: MotionLevel;
  /** Mute all sound effects. */
  muted: boolean;
  /** SFX volume, 0..1. */
  volume: number;
}

const STORAGE_KEY = "herobyte:juice";
const MOTION_LEVELS: readonly MotionLevel[] = ["full", "subtle", "off"];

function osPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function clampVolume(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0.6;
  return Math.min(1, Math.max(0, n));
}

function defaultSettings(): JuiceSettings {
  // Honor the OS accessibility preference as the initial default.
  return {
    motion: osPrefersReducedMotion() ? "off" : "full",
    muted: false,
    volume: 0.6,
  };
}

function readStored(): JuiceSettings {
  const fallback = defaultSettings();
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<JuiceSettings>;
    return {
      motion: MOTION_LEVELS.includes(parsed.motion as MotionLevel)
        ? (parsed.motion as MotionLevel)
        : fallback.motion,
      muted: typeof parsed.muted === "boolean" ? parsed.muted : fallback.muted,
      volume: parsed.volume === undefined ? fallback.volume : clampVolume(parsed.volume),
    };
  } catch {
    return fallback;
  }
}

let state: JuiceSettings = readStored();
const listeners = new Set<() => void>();

function persist(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota / privacy-mode failures — settings still work in-memory.
  }
}

/** Reflect the current motion level onto the document root for CSS gating. */
export function applyMotionAttribute(): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.motion = state.motion;
}

function emit(): void {
  applyMotionAttribute();
  persist();
  listeners.forEach((listener) => listener());
}

export function getJuiceSettings(): JuiceSettings {
  return state;
}

export function subscribeJuiceSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setMotionLevel(motion: MotionLevel): void {
  if (!MOTION_LEVELS.includes(motion) || motion === state.motion) return;
  state = { ...state, motion };
  emit();
}

export function setMuted(muted: boolean): void {
  if (muted === state.muted) return;
  state = { ...state, muted };
  emit();
}

export function toggleMuted(): void {
  setMuted(!state.muted);
}

export function setVolume(volume: number): void {
  const next = clampVolume(volume);
  if (next === state.volume) return;
  state = { ...state, volume: next };
  emit();
}

/** True when juice motion should be suppressed (setting "off"). */
export function motionDisabled(): boolean {
  return state.motion === "off";
}

/**
 * True when decorative flourishes (pop-in, selection pulse, shakes) should be
 * suppressed. "subtle" keeps informational motion — tokens still glide to
 * their new cell, combat numbers still appear — but drops the purely
 * cosmetic layer; "off" drops everything.
 */
export function decorativeMotionDisabled(): boolean {
  return state.motion !== "full";
}

/** Test-only: reset in-memory state from storage/defaults. */
export function __resetJuiceSettingsForTests(next?: Partial<JuiceSettings>): void {
  state = { ...defaultSettings(), ...next };
  listeners.clear();
}
