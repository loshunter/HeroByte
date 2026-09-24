import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DrawingHistoryCapabilities } from "@herobyte/shared";
import { useDrawingStateManager } from "../../../../hooks/useDrawingStateManager";
import { MobileDrawingControls } from "../../../../layouts/MobileDrawingControls";
import { DrawingToolbar } from "../DrawingToolbar";

afterEach(cleanup);
describe.each([false, true])("real drawing history controls (mobile=%s)", (mobile) => {
  it("both buttons follow confirmed capabilities, including empty redo and repeated explicit clicks", () => {
    const sendMessage = vi.fn();
    const setActiveTool = vi.fn();
    function Controls({ drawingHistory }: { drawingHistory?: DrawingHistoryCapabilities }) {
      const manager = useDrawingStateManager({ sendMessage, setActiveTool, drawingHistory });
      return mobile ? (
        <MobileDrawingControls {...manager.toolbarProps} />
      ) : (
        <DrawingToolbar {...manager.toolbarProps} />
      );
    }
    const view = render(<Controls />);
    const undo = screen.getByRole("button", { name: /undo/i });
    const redo = screen.getByRole("button", { name: /redo/i });
    expect(undo).toBeDisabled();
    expect(redo).toBeDisabled();
    fireEvent.click(undo);
    fireEvent.click(redo);
    expect(sendMessage).not.toHaveBeenCalled();

    view.rerender(<Controls drawingHistory={{ canUndo: true, canRedo: false }} />);
    expect(undo).toBeEnabled();
    expect(redo).toBeDisabled();
    fireEvent.click(undo);
    fireEvent.click(undo);
    expect(sendMessage.mock.calls).toEqual([[{ t: "undo-drawing" }], [{ t: "undo-drawing" }]]);
    expect(undo).toBeEnabled();
    expect(redo).toBeDisabled();

    view.rerender(<Controls drawingHistory={{ canUndo: false, canRedo: true }} />);
    expect(undo).toBeDisabled();
    expect(redo).toBeEnabled();
    fireEvent.click(redo);
    expect(sendMessage.mock.calls[2]).toEqual([{ t: "redo-drawing" }]);
    expect(redo).toBeEnabled();

    view.rerender(<Controls drawingHistory={{ canUndo: false, canRedo: false }} />);
    expect(undo).toBeDisabled();
    expect(redo).toBeDisabled();
  });
});
