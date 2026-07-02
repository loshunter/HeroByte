import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { CompiledDoor } from "@herobyte/shared";
import { useDoorSfx } from "../useDoorSfx";
import { sfxEngine } from "../sfxEngine";

beforeEach(() => {
  vi.spyOn(sfxEngine, "play").mockImplementation(() => {});
});

function door(id: string, state: CompiledDoor["state"]): CompiledDoor {
  return { id, x1: 0, y1: 0, x2: 50, y2: 0, state, blocksMovement: true, blocksVision: true };
}

describe("useDoorSfx", () => {
  it("stays silent on the first observation", () => {
    renderHook(({ doors }) => useDoorSfx(doors), {
      initialProps: { doors: [door("a", "closed")] },
    });
    expect(sfxEngine.play).not.toHaveBeenCalled();
  });

  it("creaks when a door opens and when it closes", () => {
    const { rerender } = renderHook(({ doors }) => useDoorSfx(doors), {
      initialProps: { doors: [door("a", "closed")] },
    });

    rerender({ doors: [door("a", "open")] });
    expect(sfxEngine.play).toHaveBeenCalledWith("doorCreak");

    vi.mocked(sfxEngine.play).mockClear();
    rerender({ doors: [door("a", "closed")] });
    expect(sfxEngine.play).toHaveBeenCalledWith("doorCreak");
  });

  it("clunks when a door locks or unlocks", () => {
    const { rerender } = renderHook(({ doors }) => useDoorSfx(doors), {
      initialProps: { doors: [door("a", "closed")] },
    });

    rerender({ doors: [door("a", "locked")] });
    expect(sfxEngine.play).toHaveBeenCalledWith("doorClunk");

    vi.mocked(sfxEngine.play).mockClear();
    rerender({ doors: [door("a", "closed")] });
    expect(sfxEngine.play).toHaveBeenCalledWith("doorClunk");
  });

  it("does not play for unchanged doors or freshly published ones", () => {
    const { rerender } = renderHook(({ doors }) => useDoorSfx(doors), {
      initialProps: { doors: [door("a", "closed")] },
    });

    rerender({ doors: [door("a", "closed"), door("b", "open")] });
    expect(sfxEngine.play).not.toHaveBeenCalled();
  });

  it("handles the scene disappearing without noise", () => {
    const { rerender } = renderHook<void, { doors: CompiledDoor[] | undefined }>(
      ({ doors }) => useDoorSfx(doors),
      { initialProps: { doors: [door("a", "closed")] } },
    );

    rerender({ doors: undefined });
    expect(sfxEngine.play).not.toHaveBeenCalled();
  });
});
