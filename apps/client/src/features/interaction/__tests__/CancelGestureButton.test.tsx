import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CancelGestureButton } from "../CancelGestureButton";
import {
  mountDrawing,
  pressAt,
  moveTo,
} from "../../../hooks/__tests__/characterization/drawingLifecycle.fixtures";

afterEach(cleanup);

describe("Cancel control with the real annotation driver", () => {
  it("stays in place after press, rejects residual release, and does not cancel new work on compatibility click", () => {
    render(<CancelGestureButton idleLabel="Cancel stroke" />);
    const button = screen.getByRole("button", { name: "Cancel stroke" });
    expect(button).toBeDisabled();
    const drawing = mountDrawing();
    pressAt(drawing, { x: 20, y: 20 });
    expect(button).toBeEnabled();
    fireEvent(
      button,
      new MouseEvent("pointerdown", { button: 0, bubbles: true, cancelable: true }),
    );
    expect(button).toBeDisabled();
    expect(button).toBeInTheDocument();
    moveTo(drawing, { x: 80, y: 80 });
    act(() => drawing.result.current.onMouseUp());
    expect(drawing.sendMessage).not.toHaveBeenCalled();
    pressAt(drawing, { x: 100, y: 100 });
    fireEvent.click(button, { detail: 1 });
    expect(drawing.result.current.isDrawing).toBe(true);
    moveTo(drawing, { x: 150, y: 150 });
    act(() => drawing.result.current.onMouseUp());
    expect(drawing.sendMessage).toHaveBeenCalledTimes(1);
  });

  it("keyboard activation uses the same cancellation and remains inert after work finishes", () => {
    render(<CancelGestureButton idleLabel="Cancel stroke" dock className="mobile-dock-button" />);
    const button = screen.getByRole("button", { name: "Cancel stroke" });
    const drawing = mountDrawing();
    pressAt(drawing, { x: 10, y: 10 });
    fireEvent.click(button, { detail: 0 });
    expect(drawing.result.current.isDrawing).toBe(false);
    moveTo(drawing, { x: 50, y: 50 });
    act(() => drawing.result.current.onMouseUp());
    expect(drawing.sendMessage).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Stop");
  });
});
