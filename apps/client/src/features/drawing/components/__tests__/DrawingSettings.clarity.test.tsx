import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDrawingStateManager } from "../../../../hooks/useDrawingStateManager";
import { MobileDrawingControls } from "../../../../layouts/MobileDrawingControls";
import { DrawingToolbar } from "../DrawingToolbar";

afterEach(cleanup);

describe.each([false, true])("U4a settings (mobile=%s)", (mobile) => {
  function mount() {
    const sendMessage = vi.fn();
    function Controls() {
      const manager = useDrawingStateManager({ sendMessage, setActiveTool: vi.fn() });
      return (
        <>
          <output data-testid="settings">{JSON.stringify(manager.drawingProps)}</output>
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
    render(<Controls />);
    return { sendMessage, state: () => JSON.parse(screen.getByTestId("settings").textContent!) };
  }

  it("edits opacity and shape fill through the shared state, retaining both across tools", () => {
    const { state, sendMessage } = mount();
    fireEvent.click(screen.getByRole("button", { name: /Rect/i }));
    fireEvent.change(screen.getByRole("slider", { name: /Opacity/ }), { target: { value: "35" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Filled" }));
    expect(state()).toMatchObject({ drawTool: "rect", drawOpacity: 0.35, drawFilled: true });
    fireEvent.click(screen.getByRole("button", { name: /Erase drawings/ }));
    expect(screen.queryByLabelText("Drawing color")).toBeNull();
    expect(screen.queryByRole("slider", { name: /Opacity/ })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Rectangle/ }));
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByRole("slider", { name: /Opacity/ })).toHaveValue("35");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("names width units and the active tool while keeping template fill automatic", () => {
    const { state } = mount();
    expect(screen.getByRole("button", { name: /Freehand/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.change(screen.getByRole("slider", { name: /Stroke width \(px\)/ }), {
      target: { value: "19" },
    });
    fireEvent.click(screen.getByRole("button", { name: /AoE Burst/ }));
    expect(screen.getByRole("button", { name: /AoE Burst/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Freehand/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByRole("slider", { name: /Stroke width \(px\)/ })).toHaveValue("19");
    fireEvent.click(screen.getByRole("button", { name: /Erase drawings/ }));
    expect(screen.getByRole("slider", { name: /Eraser width \(px\)/ })).toHaveValue("19");
    expect(state()).toMatchObject({ drawTool: "eraser", drawWidth: 19 });
  });
});
