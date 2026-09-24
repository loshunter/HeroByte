import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  expectCapabilities,
  foreignDrawing,
  frame,
  mountManager,
} from "./drawingHistoryManager.fixtures";

afterEach(cleanup);
describe("confirmed per-recipient drawing history", () => {
  it.each([
    { canUndo: false, canRedo: false },
    { canUndo: true, canRedo: false },
    { canUndo: false, canRedo: true },
    { canUndo: true, canRedo: true },
  ])("initial snapshot projects %j without any local drawing completion", (history) => {
    const manager = mountManager(frame(Object.freeze(history)));
    expectCapabilities(manager.result.current, history.canUndo, history.canRedo);
    expect(manager.sendMessage).not.toHaveBeenCalled();
  });

  it.each([null, frame(undefined, [foreignDrawing])])(
    "missing metadata fails closed for %j",
    (snapshot) => {
      const manager = mountManager(snapshot);
      act(() => {
        manager.result.current.drawingProps.onDrawingComplete("locally-sent");
        manager.result.current.handleUndo();
        manager.result.current.handleRedo();
      });
      expectCapabilities(manager.result.current, false, false);
      expect(manager.sendMessage).not.toHaveBeenCalled();
    },
  );

  it("incoming snapshots alone drive each availability transition", () => {
    const manager = mountManager();
    expectCapabilities(manager.result.current, false, false);
    for (const history of [
      { canUndo: true, canRedo: false },
      { canUndo: false, canRedo: true },
      { canUndo: true, canRedo: true },
      { canUndo: false, canRedo: false },
    ]) {
      manager.incoming(frame(history));
      expectCapabilities(manager.result.current, history.canUndo, history.canRedo);
    }
    expect(manager.sendMessage).not.toHaveBeenCalled();
  });

  it.each([
    { canUndo: false, canRedo: false },
    { canUndo: false, canRedo: true },
    { canUndo: true, canRedo: true },
  ])(
    "rapid local completions cannot manufacture history or erase confirmed redo: %j",
    (history) => {
      const manager = mountManager(frame(history));
      act(() => {
        for (let index = 0; index < 100; index++)
          manager.result.current.drawingProps.onDrawingComplete(`draw-${index}`);
      });
      expectCapabilities(manager.result.current, history.canUndo, history.canRedo);
      expect(manager.sendMessage).not.toHaveBeenCalled();
    },
  );

  it("disabled undo and redo callbacks both decline without sending", () => {
    const manager = mountManager(frame({ canUndo: false, canRedo: false }));
    act(() => {
      manager.result.current.handleUndo();
      manager.result.current.toolbarProps.onUndo();
      manager.result.current.handleRedo();
      manager.result.current.toolbarProps.onRedo();
    });
    expect(manager.sendMessage).not.toHaveBeenCalled();
    expectCapabilities(manager.result.current, false, false);
  });

  it("undo sends exactly its command and keeps the last confirmed booleans", () => {
    const manager = mountManager(frame({ canUndo: true, canRedo: false }));
    act(() => {
      manager.result.current.handleUndo();
      manager.result.current.handleRedo();
    });
    expect(manager.sendMessage.mock.calls).toEqual([[{ t: "undo-drawing" }]]);
    expectCapabilities(manager.result.current, true, false);
  });

  it("redo can be available with no visible drawings, and it is gated separately", () => {
    const snapshot = frame({ canUndo: false, canRedo: true }, []);
    expect(snapshot.drawings).toEqual([]);
    const manager = mountManager(snapshot);
    act(() => {
      manager.result.current.handleUndo();
      manager.result.current.handleRedo();
    });
    expect(manager.sendMessage.mock.calls).toEqual([[{ t: "redo-drawing" }]]);
    expectCapabilities(manager.result.current, false, true);
  });

  it("repeated explicit commands are not suppressed by a fabricated pending latch or local count", () => {
    const manager = mountManager(frame({ canUndo: true, canRedo: true }));
    act(() => {
      manager.result.current.handleUndo();
      manager.result.current.handleUndo();
      manager.result.current.toolbarProps.onUndo();
      manager.result.current.handleRedo();
      manager.result.current.toolbarProps.onRedo();
    });
    expect(manager.sendMessage.mock.calls).toEqual([
      [{ t: "undo-drawing" }],
      [{ t: "undo-drawing" }],
      [{ t: "undo-drawing" }],
      [{ t: "redo-drawing" }],
      [{ t: "redo-drawing" }],
    ]);
    expectCapabilities(manager.result.current, true, true);
    manager.incoming(frame({ canUndo: false, canRedo: false }, [], 2));
    act(() => {
      manager.result.current.handleUndo();
      manager.result.current.handleRedo();
    });
    expect(manager.sendMessage).toHaveBeenCalledTimes(5);
    expectCapabilities(manager.result.current, false, false);
  });

  it("a newer unrelated/foreign drawing snapshot does not acknowledge a local undo", () => {
    const manager = mountManager(frame({ canUndo: true, canRedo: false }));
    act(() => manager.result.current.handleUndo());
    manager.incoming(frame({ canUndo: true, canRedo: false }, [foreignDrawing], 100));
    expectCapabilities(manager.result.current, true, false);
    act(() => manager.result.current.handleRedo());
    expect(manager.sendMessage.mock.calls).toEqual([[{ t: "undo-drawing" }]]);
    // A changed capability is observed as current availability, not correlated success.
    manager.incoming(frame({ canUndo: false, canRedo: true }, [foreignDrawing], 101));
    expectCapabilities(manager.result.current, false, true);
    act(() => manager.result.current.handleRedo());
    expect(manager.sendMessage.mock.calls).toEqual([
      [{ t: "undo-drawing" }],
      [{ t: "redo-drawing" }],
    ]);
  });

  it("separate recipients use only their supplied capabilities, never another hook's local actions", () => {
    const player = mountManager(frame({ canUndo: true, canRedo: false }));
    const dm = mountManager(frame({ canUndo: false, canRedo: true }), true);
    act(() => {
      player.result.current.handleUndo();
      dm.result.current.handleRedo();
    });
    expectCapabilities(player.result.current, true, false);
    expectCapabilities(dm.result.current, false, true);
    expect(player.sendMessage.mock.calls).toEqual([[{ t: "undo-drawing" }]]);
    expect(dm.sendMessage.mock.calls).toEqual([[{ t: "redo-drawing" }]]);
  });

  it("reconnect clears displayed availability until the next snapshot, without resurrecting local IDs", () => {
    const manager = mountManager(frame({ canUndo: true, canRedo: true }));
    manager.incoming(null);
    expectCapabilities(manager.result.current, false, false);
    act(() => {
      manager.result.current.drawingProps.onDrawingComplete("stale");
      manager.result.current.handleUndo();
    });
    expect(manager.sendMessage).not.toHaveBeenCalled();
    manager.incoming(frame({ canUndo: false, canRedo: true }));
    expectCapabilities(manager.result.current, false, true);
  });

  it("all local drawing settings still change, and a server history update preserves them", () => {
    const manager = mountManager(frame({ canUndo: true, canRedo: false }));
    act(() => {
      const toolbar = manager.result.current.toolbarProps;
      toolbar.onToolChange("rect");
      toolbar.onColorChange("#123456");
      toolbar.onWidthChange(9);
      toolbar.onOpacityChange(0.4);
      toolbar.onFilledChange(true);
    });
    expectCapabilities(manager.result.current, true, false);
    manager.incoming(frame({ canUndo: false, canRedo: true }));
    expect(manager.result.current.drawingProps).toMatchObject({
      drawTool: "rect",
      drawColor: "#123456",
      drawWidth: 9,
      drawOpacity: 0.4,
      drawFilled: true,
    });
    expectCapabilities(manager.result.current, false, true);
  });
});
