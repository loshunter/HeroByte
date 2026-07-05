import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetJuiceSettingsForTests, setMotionLevel } from "../../juice/juiceSettings";
import { ANIMATION_STEP_MS, __resetAnimationClockForTests } from "../animationClock";
import { useAnimationFrameIndex } from "../useAnimationClock";

function Probe({ frames, enabled }: { frames: number; enabled?: boolean }) {
  const frame = useAnimationFrameIndex(frames, enabled);
  return <span data-testid="frame">{frame}</span>;
}

function frameText(container: HTMLElement): string {
  return container.querySelector('[data-testid="frame"]')!.textContent ?? "";
}

describe("useAnimationFrameIndex", () => {
  beforeEach(() => {
    __resetJuiceSettingsForTests({ motion: "full" });
    __resetAnimationClockForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    __resetAnimationClockForTests();
  });

  it("starts at frame 0 and cycles with the clock", () => {
    const { container } = render(<Probe frames={4} />);
    expect(frameText(container)).toBe("0");

    act(() => vi.advanceTimersByTime(ANIMATION_STEP_MS));
    expect(frameText(container)).toBe("1");

    act(() => vi.advanceTimersByTime(ANIMATION_STEP_MS * 3));
    expect(frameText(container)).toBe("0"); // wrapped 4 -> 0
  });

  it("stays at frame 0 when disabled and never subscribes", () => {
    const { container } = render(<Probe frames={4} enabled={false} />);
    act(() => vi.advanceTimersByTime(ANIMATION_STEP_MS * 5));
    expect(frameText(container)).toBe("0");
  });

  it("stays at frame 0 for a single-frame cycle", () => {
    const { container } = render(<Probe frames={1} />);
    act(() => vi.advanceTimersByTime(ANIMATION_STEP_MS * 3));
    expect(frameText(container)).toBe("0");
  });

  it("freezes at frame 0 under reduced motion", () => {
    setMotionLevel("off");
    const { container } = render(<Probe frames={4} />);
    act(() => vi.advanceTimersByTime(ANIMATION_STEP_MS * 3));
    expect(frameText(container)).toBe("0");
  });
});
