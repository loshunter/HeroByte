import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import type { MapElement, MapLayer } from "@herobyte/shared";
import { MapEditInspectorPopover } from "../MapEditInspectorPopover";

const layers: MapLayer[] = [
  {
    id: "objects",
    name: "Objects",
    kind: "objects",
    visible: true,
    locked: false,
    opacity: 1,
    zIndex: 20,
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

const stamp: MapElement = {
  id: "stamp1",
  layerId: "objects",
  type: "stamp",
  locked: false,
  hidden: false,
  transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0 },
  data: { assetId: "objects:crate", width: 50, height: 50 },
};

const door: MapElement = {
  id: "door1",
  layerId: "walls",
  type: "door",
  locked: false,
  hidden: false,
  transform: { x: 200, y: 200, scaleX: 1, scaleY: 1, rotation: 0 },
  data: { width: 50, state: "closed", blocksMovement: true, blocksVision: true },
};

describe("MapEditInspectorPopover", () => {
  it("APPLY emits update-element with the edited transform", () => {
    const onUpdate = vi.fn();
    render(
      <MapEditInspectorPopover
        element={stamp}
        layers={layers}
        disabled={false}
        onUpdate={onUpdate}
        onUpdateDoor={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Rotation"), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "APPLY" }));
    expect(onUpdate).toHaveBeenCalledWith(
      "stamp1",
      expect.objectContaining({
        layerId: "objects",
        hidden: false,
        transform: expect.objectContaining({ rotation: 45 }),
      }),
    );
  });

  it("DELETE removes the element", () => {
    const onRemove = vi.fn();
    render(
      <MapEditInspectorPopover
        element={stamp}
        layers={layers}
        disabled={false}
        onUpdate={vi.fn()}
        onUpdateDoor={vi.fn()}
        onRemove={onRemove}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "DELETE" }));
    expect(onRemove).toHaveBeenCalledWith("stamp1");
  });

  it("shows the door form and APPLY DOOR emits update-door", () => {
    const onUpdateDoor = vi.fn();
    render(
      <MapEditInspectorPopover
        element={door}
        layers={layers}
        disabled={false}
        onUpdate={vi.fn()}
        onUpdateDoor={onUpdateDoor}
        onRemove={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Door state"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "APPLY DOOR" }));
    expect(onUpdateDoor).toHaveBeenCalledWith("door1", { state: "secret", width: 50 });
  });
});
