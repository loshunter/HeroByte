import { act, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { escapeRegistry } from "../../features/interaction/useEscapeOwner";
import { marqueeHarness, type MarqueeInput } from "./marqueeEscape.fixtures";

afterEach(cleanup);

const escape = () => fireEvent.keyDown(document.body, { key: "Escape" });
const inputs: MarqueeInput[] = ["mouse", "touch"];

describe("real marquee gesture Escape ownership", () => {
  it.each(inputs)(
    "%s: first Escape discards a held marquee, preserves Select and allows a fresh selection",
    (input) => {
      const h = marqueeHarness();
      act(() => h.start(input));
      act(() => h.move(input));
      expect(h.result.current.marquee.marqueeRect).toEqual({ x: 0, y: 0, width: 30, height: 30 });

      act(() => {
        escape();
        h.move(input, 40);
        h.move(input, 50);
        h.release(input);
        h.move(input, 60);
      });

      expect(h.result.current.mode.activeTool).toBe("select");
      expect(h.result.current.marquee.isActive).toBe(false);
      expect(h.result.current.marquee.marqueeRect).toBeNull();
      expect(escapeRegistry.getPendingLabel()).toBeNull();
      expect(h.onSelectObject).not.toHaveBeenCalled();
      expect(h.onSelectObjects).not.toHaveBeenCalled();

      act(() => h.start(input));
      act(() => h.move(input));
      act(() => h.release(input));
      expect(h.onSelectObjects).toHaveBeenCalledExactlyOnceWith(["token:inside"]);
      expect(h.onSelectObject).not.toHaveBeenCalled();
      expect(h.result.current.marquee.isActive).toBe(false);
      expect(escapeRegistry.getPendingLabel()).toBeNull();

      escape();
      expect(h.result.current.mode.activeTool).toBeNull();
      expect(h.onSelectObjects).toHaveBeenCalledTimes(1);
      expect(h.onSelectObject).not.toHaveBeenCalled();
    },
  );

  it.each(inputs)(
    "%s: a press exposes Cancel immediately and same-turn Escape disarms release",
    (input) => {
      const h = marqueeHarness();
      act(() => {
        h.start(input);
        expect(escapeRegistry.getPendingLabel()).toBe("Cancel selection");
        h.move(input);
        escape();
        expect(escapeRegistry.getPendingLabel()).toBeNull();
        h.move(input, 40);
        h.release(input);
      });

      expect(h.result.current.mode.activeTool).toBe("select");
      expect(h.result.current.marquee.marqueeRect).toBeNull();
      expect(h.onSelectObject).not.toHaveBeenCalled();
      expect(h.onSelectObjects).not.toHaveBeenCalled();
      escape();
      expect(h.result.current.mode.activeTool).toBeNull();
    },
  );

  it("the shared Cancel control discards the same live touch marquee without exiting Select", () => {
    const h = marqueeHarness();
    act(() => h.start("touch"));
    act(() => h.move("touch"));
    expect(escapeRegistry.getPendingLabel()).toBe("Cancel selection");

    act(() => {
      expect(escapeRegistry.cancelPending()).toBe(true);
      expect(escapeRegistry.getPendingLabel()).toBeNull();
      h.move("touch", 40);
      h.release("touch");
    });

    expect(h.result.current.mode.activeTool).toBe("select");
    expect(h.result.current.marquee.marqueeRect).toBeNull();
    expect(h.onSelectObject).not.toHaveBeenCalled();
    expect(h.onSelectObjects).not.toHaveBeenCalled();
  });

  it.each(["start", "move"])(
    "a second finger seen on touch%s cancels the real marquee and preserves camera routing",
    (phase) => {
      const h = marqueeHarness();
      act(() => h.start("touch"));
      act(() => h.move("touch"));
      expect(escapeRegistry.getPendingLabel()).toBe("Cancel selection");
      const twoFingers = h.touch(2);

      act(() => {
        if (phase === "start") h.result.current.router.onTouchStart(twoFingers);
        else h.result.current.router.onTouchMove(twoFingers);
        expect(escapeRegistry.getPendingLabel()).toBeNull();
        h.move("touch", 40);
        h.release("touch");
      });

      expect(h.result.current.mode.activeTool).toBe("select");
      expect(h.result.current.marquee.marqueeRect).toBeNull();
      expect(h.onSelectObject).not.toHaveBeenCalled();
      expect(h.onSelectObjects).not.toHaveBeenCalled();
      expect(phase === "start" ? h.cameraStart : h.cameraMove).toHaveBeenCalledWith(
        twoFingers,
        expect.anything(),
        ...(phase === "start" ? [false] : []),
      );
      expect(h.cameraEnd).toHaveBeenCalledOnce();

      act(() => h.start("touch"));
      act(() => h.move("touch"));
      act(() => h.release("touch"));
      expect(h.onSelectObjects).toHaveBeenCalledExactlyOnceWith(["token:inside"]);
      expect(escapeRegistry.getPendingLabel()).toBeNull();
    },
  );
});
