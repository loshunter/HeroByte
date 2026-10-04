import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDrawingStateManager } from "../../../../../hooks/useDrawingStateManager";
import { MobileDrawingControls } from "../../../../../layouts/MobileDrawingControls";
import { DrawingToolbar } from "../../DrawingToolbar";

afterEach(cleanup);

describe("drawing settings ownership before U4a extraction", () => {
  it("keeps the same drawing state while desktop and phone controls remount", () => {
    const sendMessage = vi.fn();
    const setActiveTool = vi.fn();
    function Controls({ mobile }: { mobile: boolean }) {
      const manager = useDrawingStateManager({ sendMessage, setActiveTool });
      return (
        <>
          <output data-testid="drawing-state">{JSON.stringify(manager.drawingProps)}</output>
          {mobile ? (
            <MobileDrawingControls
              {...manager.toolbarProps}
              collapsed={false}
              onCollapsedChange={vi.fn()}
            />
          ) : (
            <DrawingToolbar {...manager.toolbarProps} />
          )}
        </>
      );
    }
    const view = render(<Controls mobile={false} />);
    fireEvent.click(screen.getByRole("button", { name: /▭ Rect/ }));
    fireEvent.change(view.container.querySelector('input[type="color"]')!, {
      target: { value: "#66cc66" },
    });
    fireEvent.change(view.container.querySelector('input[type="range"][max="50"]')!, {
      target: { value: "17" },
    });
    fireEvent.change(view.container.querySelector('input[type="range"][max="100"]')!, {
      target: { value: "45" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    const state = () => JSON.parse(screen.getByTestId("drawing-state").textContent!);
    const expected = {
      drawTool: "rect",
      drawColor: "#66cc66",
      drawWidth: 17,
      drawOpacity: 0.45,
      drawFilled: true,
    };
    expect(state()).toEqual(expected);
    view.rerender(<Controls mobile />);
    expect(state()).toEqual(expected);
    fireEvent.change(view.container.querySelector('input[type="range"][max="50"]')!, {
      target: { value: "23" },
    });
    view.rerender(<Controls mobile={false} />);
    expect(state()).toEqual({ ...expected, drawWidth: 23 });
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(setActiveTool).not.toHaveBeenCalled();
  });
});
