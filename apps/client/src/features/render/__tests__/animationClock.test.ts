import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetJuiceSettingsForTests, setMotionLevel } from "../../juice/juiceSettings";
import {
  ANIMATION_STEP_MS,
  __resetAnimationClockForTests,
  animationClockStep,
  subscribeAnimationClock,
} from "../animationClock";

describe("animationClock", () => {
  beforeEach(() => {
    __resetJuiceSettingsForTests({ motion: "full" });
    __resetAnimationClockForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    __resetAnimationClockForTests();
  });

  it("starts at frame 0", () => {
    expect(animationClockStep()).toBe(0);
  });

  it("advances one step per 300ms while subscribed and motion is on", () => {
    const listener = vi.fn();
    subscribeAnimationClock(listener);

    vi.advanceTimersByTime(ANIMATION_STEP_MS);
    expect(animationClockStep()).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(ANIMATION_STEP_MS * 2);
    expect(animationClockStep()).toBe(3);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("does not advance without a subscriber", () => {
    vi.advanceTimersByTime(ANIMATION_STEP_MS * 5);
    expect(animationClockStep()).toBe(0);
  });

  it("notifies every subscriber from one shared timer", () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribeAnimationClock(a);
    subscribeAnimationClock(b);
    vi.advanceTimersByTime(ANIMATION_STEP_MS);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("stops ticking after the last unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAnimationClock(listener);
    vi.advanceTimersByTime(ANIMATION_STEP_MS);
    unsubscribe();
    vi.advanceTimersByTime(ANIMATION_STEP_MS * 3);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("reports a frozen frame 0 while motion is off", () => {
    setMotionLevel("off");
    const listener = vi.fn();
    subscribeAnimationClock(listener);
    vi.advanceTimersByTime(ANIMATION_STEP_MS * 4);
    expect(animationClockStep()).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it("freezes to 0 and notifies once when motion turns off mid-run", () => {
    const listener = vi.fn();
    subscribeAnimationClock(listener);
    vi.advanceTimersByTime(ANIMATION_STEP_MS * 2);
    expect(animationClockStep()).toBe(2);
    listener.mockClear();

    setMotionLevel("off");
    expect(animationClockStep()).toBe(0);
    expect(listener).toHaveBeenCalledTimes(1);

    // Frozen: no further ticks while off.
    vi.advanceTimersByTime(ANIMATION_STEP_MS * 3);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("resumes ticking when motion turns back on", () => {
    const listener = vi.fn();
    subscribeAnimationClock(listener);
    setMotionLevel("off");
    listener.mockClear();

    setMotionLevel("full");
    vi.advanceTimersByTime(ANIMATION_STEP_MS);
    expect(animationClockStep()).toBeGreaterThan(0);
    expect(listener).toHaveBeenCalled();
  });
});
