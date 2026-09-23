import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDrawingStateManager } from "../../../../hooks/useDrawingStateManager";
import { DrawingToolbar } from "../DrawingToolbar";

describe("drawing toolbar clear permission", () => {
  afterEach(() => vi.restoreAllMocks());

  it("hides the table-wide clear action until permitted, including after demotion", () => {
    const initialProps: { canClearDrawings?: boolean } = {};
    const { result, rerender } = renderHook(
      ({ canClearDrawings }: { canClearDrawings?: boolean }) =>
        useDrawingStateManager({
          sendMessage: vi.fn(),
          drawMode: true,
          setActiveTool: vi.fn(),
          canClearDrawings,
        }),
      { initialProps },
    );
    const toolbar = render(<DrawingToolbar {...result.current.toolbarProps} />);
    expect(screen.queryByRole("button", { name: /clear all/i })).not.toBeInTheDocument();

    rerender({ canClearDrawings: true });
    toolbar.rerender(<DrawingToolbar {...result.current.toolbarProps} />);
    expect(screen.getByRole("button", { name: /clear all/i })).toBeEnabled();

    rerender({ canClearDrawings: false });
    toolbar.rerender(<DrawingToolbar {...result.current.toolbarProps} />);
    expect(screen.queryByRole("button", { name: /clear all/i })).not.toBeInTheDocument();
  });

  it("keeps the DM confirmation and preserves drawings/history when declined", () => {
    const sendMessage = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result } = renderHook(() =>
      useDrawingStateManager({
        sendMessage,
        drawMode: true,
        setActiveTool: vi.fn(),
        canClearDrawings: true,
      }),
    );
    act(() => result.current.drawingProps.onDrawingComplete("existing-drawing"));
    render(<DrawingToolbar {...result.current.toolbarProps} />);

    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));

    expect(confirm).toHaveBeenCalledWith("Clear all drawings from the map? This cannot be undone.");
    expect(sendMessage).not.toHaveBeenCalled();
    expect(result.current.canUndo).toBe(true);
  });
});
