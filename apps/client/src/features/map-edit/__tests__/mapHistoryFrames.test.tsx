import { act, cleanup, fireEvent, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DraggableWindow } from "../../../components/dice/DraggableWindow";
import { MobileDiceRoller } from "../../../components/dice/MobileDiceRoller";
import { MobileResultOverlay } from "../../../components/dice/MobileResultOverlay";
import { serverRoll } from "../../../components/dice/__tests__/mobileDiceFrames.fixtures";
import { MobileScreen } from "../../../layouts/mobile/MobileScreen";
import { MobileSheet } from "../../../layouts/mobile/MobileSheet";
import { dismissalFocus } from "../../interaction/dismissalFocus";
import { viewport } from "../../interaction/__tests__/frameInteraction.fixtures";
import { useMapEditHotkeys } from "../useMapEditHotkeys";

describe("real frames with retained map focus", () => {
  let canvas: HTMLDivElement;
  let originalViewport: [number, number];
  const undo = vi.fn();
  const redo = vi.fn();

  beforeEach(() => {
    originalViewport = [innerWidth, innerHeight];
    vi.stubGlobal("matchMedia", undefined);
    viewport(1440, 900);
    vi.clearAllMocks();
    canvas = document.createElement("div");
    canvas.dataset.mapHistorySurface = "true";
    canvas.tabIndex = -1;
    document.body.append(canvas);
    renderHook(() =>
      useMapEditHotkeys({ mapEditMode: true, canUndo: true, canRedo: true, undo, redo }),
    );
    canvas.focus();
  });

  afterEach(() => {
    cleanup();
    dismissalFocus.invalidate();
    document.body.replaceChildren();
    viewport(...originalViewport);
    vi.unstubAllGlobals();
  });

  function historyKeys() {
    expect(document.activeElement).toBe(canvas);
    fireEvent.keyDown(canvas, { key: "z", ctrlKey: true });
    fireEvent.keyDown(canvas, { key: "z", metaKey: true });
    fireEvent.keyDown(canvas, { key: "Z", ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(canvas, { key: "y", ctrlKey: true });
  }

  it.each(["block", "close"] as const)("blocks history beneath a %s mobile screen", (behavior) => {
    const view = render(
      <MobileScreen
        title="Chat"
        surface="log"
        onClose={vi.fn()}
        interaction={behavior === "close" ? { behavior: "close", panel: "chat" } : undefined}
      >
        <p>Covered map</p>
      </MobileScreen>,
    );
    historyKeys();
    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
    view.unmount();
    historyKeys();
    expect(undo).toHaveBeenCalledTimes(2);
    expect(redo).toHaveBeenCalledTimes(2);
  });

  it.each(["tools", "help"] as const)("blocks history beneath the %s mobile sheet", (surface) => {
    render(
      <MobileSheet title={surface} label={surface} surface={surface} onClose={vi.fn()}>
        <p>Sheet</p>
      </MobileSheet>,
    );
    historyKeys();
    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
  });

  it.each(["dice", "result"] as const)("blocks history beneath mobile %s", (kind) => {
    render(
      kind === "dice" ? (
        <MobileDiceRoller onClose={vi.fn()} />
      ) : (
        <MobileResultOverlay result={serverRoll()} onClose={vi.fn()} />
      ),
    );
    historyKeys();
    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
  });

  it.each(["block", "close"] as const)(
    "allows desktop %s windows, then revokes the exception when they become mobile",
    (behavior) => {
      render(
        <DraggableWindow
          title="Window"
          onClose={vi.fn()}
          interaction={behavior === "close" ? { behavior, panel: "chat" } : { behavior }}
        >
          <p>Window</p>
        </DraggableWindow>,
      );
      historyKeys();
      expect(undo).toHaveBeenCalledTimes(2);
      expect(redo).toHaveBeenCalledTimes(2);
      act(() => {
        viewport(375, 812);
        window.dispatchEvent(new Event("resize"));
      });
      historyKeys();
      expect(undo).toHaveBeenCalledTimes(2);
      expect(redo).toHaveBeenCalledTimes(2);
    },
  );
});
