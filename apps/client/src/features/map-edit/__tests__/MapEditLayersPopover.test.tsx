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
});
