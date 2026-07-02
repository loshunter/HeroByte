import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTurnChime } from "../useTurnChime";
import { sfxEngine } from "../sfxEngine";

beforeEach(() => {
  vi.spyOn(sfxEngine, "play").mockImplementation(() => {});
});

describe("useTurnChime", () => {
  it("does not chime on the first observation", () => {
    renderHook(({ id }) => useTurnChime(id), { initialProps: { id: "char-1" } });
    expect(sfxEngine.play).not.toHaveBeenCalled();
  });

  it("chimes when the active combatant changes", () => {
    const { rerender } = renderHook(({ id }) => useTurnChime(id), {
      initialProps: { id: "char-1" },
    });
    rerender({ id: "char-2" });
    expect(sfxEngine.play).toHaveBeenCalledWith("turnAdvance");
  });

  it("does not chime when the turn is unchanged", () => {
    const { rerender } = renderHook(({ id }) => useTurnChime(id), {
      initialProps: { id: "char-1" },
    });
    rerender({ id: "char-1" });
    expect(sfxEngine.play).not.toHaveBeenCalled();
  });

  it("stays silent when combat ends (id clears)", () => {
    const { rerender } = renderHook(({ id }) => useTurnChime(id), {
      initialProps: { id: "char-1" } as { id: string | undefined },
    });
    rerender({ id: undefined });
    expect(sfxEngine.play).not.toHaveBeenCalled();
  });
});
