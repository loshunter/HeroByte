import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DrawingToolbar } from "../../drawing/components/DrawingToolbar";
import { MobileDrawingControls } from "../../../layouts/MobileDrawingControls";
import { MapEditHistoryActions } from "../../map-edit/MapEditHistoryActions";

afterEach(cleanup);
describe.each(["desktop drawing", "mobile drawing", "map"])("%s history scope", (surface) => {
  it("names committed history separately from an idle Cancel action", () => {
    const undo = vi.fn();
    const redo = vi.fn();
    const close = vi.fn();
    const props = {
      drawTool: "freehand" as const,
      drawColor: "#ffffff",
      drawWidth: 3,
      drawOpacity: 1,
      drawFilled: false,
      canUndo: true,
      canRedo: true,
      onUndo: undo,
      onRedo: redo,
      onClose: close,
      onToolChange: vi.fn(),
      onColorChange: vi.fn(),
      onWidthChange: vi.fn(),
      onOpacityChange: vi.fn(),
      onFilledChange: vi.fn(),
      onClearAll: vi.fn(),
    };
    if (surface === "desktop drawing") render(<DrawingToolbar {...props} />);
    else if (surface === "mobile drawing") render(<MobileDrawingControls {...props} />);
    else
      render(
        <MapEditHistoryActions activeSubTool="wall" canUndo canRedo onUndo={undo} onRedo={redo} />,
      );
    const scope = surface === "map" ? "map" : "drawing";
    const undoButton = screen.getByRole("button", { name: new RegExp(`Undo ${scope}`) });
    const redoButton = screen.getByRole("button", { name: new RegExp(`Redo ${scope}`) });
    expect(
      screen.getByRole("button", {
        name: surface === "map" ? "Cancel placement" : "Cancel stroke",
      }),
    ).toBeDisabled();
    fireEvent.click(undoButton);
    fireEvent.click(redoButton);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(redo).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });
});
