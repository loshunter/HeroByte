import { Easing, interpolate, spring } from "remotion";

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/**
 * Enter/exit for a popup, in frames relative to the composition: a springy overshoot in (scale,
 * a little rotation and a squash that settles), a quick shrink-and-lift out.
 */
export function popState(frame: number, fps: number, start: number, end: number, opts: { tilt?: number; stiff?: number } = {}) {
  const t = frame - start;
  const inS = spring({ frame: t, fps, config: { damping: 9, stiffness: opts.stiff ?? 210, mass: 0.7 } });
  const wob = spring({ frame: t, fps, config: { damping: 6, stiffness: 160, mass: 0.6 } });
  const outP = clamp01((frame - end) / 7);
  const out = Easing.in(Easing.back(2))(outP);
  const squash = Math.sin(t / 2.2) * Math.exp(-t / 7) * 0.14 * (t > 0 ? 1 : 0);
  return {
    visible: frame >= start && frame < end + 7,
    scale: inS * (1 - out),
    rot: (1 - wob) * (opts.tilt ?? -7),
    sx: 1 + squash,
    sy: 1 - squash,
    opacity: frame < start ? 0 : 1 - outP,
    lift: out * -30,
    t,
  };
}

/** 0 -> 1 progress over `dur` frames from `start`, eased. */
export const prog = (frame: number, start: number, dur: number, ease = easeInOut) =>
  ease(clamp01((frame - start) / dur));

export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

export const bounce = (frame: number, period = 18, amp = 10) => Math.abs(Math.sin((frame / period) * Math.PI)) * amp;

export const fadeInOut = (frame: number, start: number, end: number, ramp = 6) =>
  interpolate(frame, [start, start + ramp, end - ramp, end], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
