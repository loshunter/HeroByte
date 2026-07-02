import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHpFeedback } from "../useHpFeedback";
import { sfxEngine } from "../sfxEngine";
import { __resetJuiceSettingsForTests, setMotionLevel } from "../juiceSettings";

beforeEach(() => {
  __resetJuiceSettingsForTests({ motion: "full", muted: false, volume: 0.6 });
  vi.spyOn(sfxEngine, "play").mockImplementation(() => {});
});

describe("useHpFeedback", () => {
  it("emits nothing on the first observed value (baseline)", () => {
    const { result } = renderHook(({ hp }) => useHpFeedback(hp), {
      initialProps: { hp: 30 },
    });
    expect(result.current.feedback).toBeNull();
    expect(result.current.flashClass).toBe("");
    expect(sfxEngine.play).not.toHaveBeenCalled();
  });

  it("reports damage on an HP decrease and plays the damage SFX", () => {
    const { result, rerender } = renderHook(({ hp }) => useHpFeedback(hp), {
      initialProps: { hp: 30 },
    });
    act(() => rerender({ hp: 23 }));
    expect(result.current.feedback).toMatchObject({ amount: -7, kind: "damage" });
    expect(result.current.flashClass).toBe("juice-flash-damage");
    expect(sfxEngine.play).toHaveBeenCalledWith("damage");
  });

  it("reports healing on an HP increase and plays the heal SFX", () => {
    const { result, rerender } = renderHook(({ hp }) => useHpFeedback(hp), {
      initialProps: { hp: 10 },
    });
    act(() => rerender({ hp: 14 }));
    expect(result.current.feedback).toMatchObject({ amount: 4, kind: "heal" });
    expect(result.current.flashClass).toBe("juice-flash-heal");
    expect(sfxEngine.play).toHaveBeenCalledWith("heal");
  });

  it("still plays SFX but shows no visual when motion is off", () => {
    setMotionLevel("off");
    const { result, rerender } = renderHook(({ hp }) => useHpFeedback(hp), {
      initialProps: { hp: 30 },
    });
    act(() => rerender({ hp: 20 }));
    expect(result.current.feedback).toBeNull();
    expect(result.current.flashClass).toBe("");
    expect(sfxEngine.play).toHaveBeenCalledWith("damage");
  });

  it("suppresses SFX when sound:false but still shows the visual (token mirror)", () => {
    const { result, rerender } = renderHook(({ hp }) => useHpFeedback(hp, { sound: false }), {
      initialProps: { hp: 30 },
    });
    act(() => rerender({ hp: 21 }));
    expect(result.current.feedback).toMatchObject({ amount: -9, kind: "damage" });
    expect(sfxEngine.play).not.toHaveBeenCalled();
  });

  it("does not emit feedback when HP is unchanged", () => {
    const { result, rerender } = renderHook(({ hp }) => useHpFeedback(hp), {
      initialProps: { hp: 30 },
    });
    act(() => rerender({ hp: 30 }));
    expect(result.current.feedback).toBeNull();
    expect(sfxEngine.play).not.toHaveBeenCalled();
  });
});
