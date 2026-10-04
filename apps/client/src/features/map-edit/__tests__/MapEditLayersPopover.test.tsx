import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import type { MapLayer } from "@herobyte/shared";
import { MapEditLayersPopover } from "../MapEditLayersPopover";

const layers: MapLayer[] = [
  {
    id: "floor",
    name: "Floor",
    kind: "terrain",
    visible: true,
    locked: false,
    opacity: 1,
    zIndex: 10,
  },
  {
    id: "walls",
    name: "Walls",
    kind: "walls",
    visible: true,
    locked: false,
    opacity: 1,
    zIndex: 30,
  },
];

describe("MapEditLayersPopover", () => {
  it("toggles visibility via update-layer", () => {
    const onUpdateLayer = vi.fn();
    render(
      <MapEditLayersPopover
        layers={layers}
        saving={false}
        onUpdateLayer={onUpdateLayer}
        onMoveLayer={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Hide Walls" }));
    expect(onUpdateLayer).toHaveBeenCalledWith("walls", { visible: false });
  });

  it("moves a layer down toward the bottom of the stack", () => {
    const onMoveLayer = vi.fn();
    render(
      <MapEditLayersPopover
        layers={layers}
        saving={false}
        onUpdateLayer={vi.fn()}
        onMoveLayer={onMoveLayer}
      />,
    );
    // Walls is index 1; "down" targets index 0.
    fireEvent.click(screen.getByRole("button", { name: "Move Walls down" }));
    expect(onMoveLayer).toHaveBeenCalledWith("walls", 0);
  });

  it("disables controls while saving", () => {
    render(
      <MapEditLayersPopover layers={layers} saving onUpdateLayer={vi.fn()} onMoveLayer={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Hide Floor" })).toBeDisabled();
  });

  it("keeps an opacity slider focusable while saving (a disabled control loses keyboard focus)", () => {
    const onUpdateLayer = vi.fn();
    render(
      <MapEditLayersPopover
        layers={layers}
        saving
        onUpdateLayer={onUpdateLayer}
        onMoveLayer={vi.fn()}
      />,
    );
    const slider = screen.getByRole("slider", { name: "Floor opacity" });
    expect(slider).toBeEnabled();
    expect(slider).toHaveAttribute("aria-disabled", "true");
    fireEvent.change(slider, { target: { value: "0.5" } });
    expect(onUpdateLayer).not.toHaveBeenCalled();
  });

  it("keeps the layer-move buttons focusable while saving, and ignores the press", () => {
    const onMoveLayer = vi.fn();
    render(
      <MapEditLayersPopover
        layers={layers}
        saving
        onUpdateLayer={vi.fn()}
        onMoveLayer={onMoveLayer}
      />,
    );
    // Walls is index 1 (can move down), Floor is index 0 (can move up).
    const down = screen.getByRole("button", { name: "Move Walls down" });
    const up = screen.getByRole("button", { name: "Move Floor up" });
    for (const button of [down, up]) {
      expect(button).toBeEnabled();
      expect(button).toHaveAttribute("aria-disabled", "true");
      // A button that keeps focus while it waits must still look inert.
      expect(button).toHaveStyle({ opacity: "0.5", cursor: "not-allowed" });
      fireEvent.click(button);
    }
    expect(onMoveLayer).not.toHaveBeenCalled();
  });

  it("still truly disables a move that goes past either end of the stack", () => {
    render(
      <MapEditLayersPopover
        layers={layers}
        saving={false}
        onUpdateLayer={vi.fn()}
        onMoveLayer={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Move Floor down" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Walls up" })).toBeDisabled();
  });
});
