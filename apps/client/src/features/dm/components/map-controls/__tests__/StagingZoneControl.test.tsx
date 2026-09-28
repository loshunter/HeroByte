/**
 * Apply Zone applies what the DM typed.
 *
 * It used to ignore all five fields: every Apply re-centred the zone on the
 * view at 40% of its size with rotation 0, then overwrote the fields with
 * those numbers. The docs harness typed x=10 y=6 3x3 and the server received
 * { x: 12.8, y: 7.2, width: 10.24, height: 5.76, rotation: 0 } at 1280x720.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StagingZoneControl } from "../StagingZoneControl";

type Zone = { x: number; y: number; width: number; height: number; rotation?: number };

function renderControl(zone: Zone | undefined, camera = { x: 0, y: 0, scale: 1 }, gridSize = 50) {
  const onSetPlayerStagingZone = vi.fn();
  const props = {
    camera,
    gridSize,
    stagingZoneLocked: false,
    onStagingZoneLockToggle: vi.fn(),
    onSetPlayerStagingZone,
  };
  const view = render(<StagingZoneControl playerStagingZone={zone} {...props} />);
  const rerenderZone = (next: Zone | undefined) =>
    view.rerender(<StagingZoneControl playerStagingZone={next} {...props} />);
  return { onSetPlayerStagingZone, rerenderZone };
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

const applyButton = () => screen.getByRole("button", { name: "Apply Zone" });

describe("StagingZoneControl — Apply Zone uses the typed values", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 720 });
  });

  it("sends the typed centre, size and rotation for a first zone", () => {
    const { onSetPlayerStagingZone } = renderControl(undefined);

    type("Center X", "10");
    type("Center Y", "6");
    type("Width (tiles)", "3");
    type("Height (tiles)", "3");
    type("Rotation (degrees)", "45");
    fireEvent.click(applyButton());

    expect(onSetPlayerStagingZone).toHaveBeenCalledTimes(1);
    expect(onSetPlayerStagingZone).toHaveBeenCalledWith({
      x: 10,
      y: 6,
      width: 3,
      height: 3,
      rotation: 45,
    });
  });

  it("changes only the edited field of an existing zone", () => {
    const { onSetPlayerStagingZone } = renderControl({
      x: 4,
      y: 5,
      width: 2,
      height: 2,
      rotation: 30,
    });

    type("Width (tiles)", "7.5");
    fireEvent.click(applyButton());

    expect(onSetPlayerStagingZone).toHaveBeenCalledWith({
      x: 4,
      y: 5,
      width: 7.5,
      height: 2,
      rotation: 30,
    });
  });

  it("keeps typed values when a snapshot re-sends the same zone as a new object", () => {
    // Every snapshot is a fresh JSON.parse, so any broadcast (a player moving a
    // token) hands the control a new object with the same numbers.
    const zone = { x: 4, y: 5, width: 2, height: 2, rotation: 0 };
    const { onSetPlayerStagingZone, rerenderZone } = renderControl(zone);

    type("Center X", "11");
    rerenderZone({ ...zone });
    expect(screen.getByLabelText("Center X")).toHaveValue(11);

    fireEvent.click(applyButton());
    expect(onSetPlayerStagingZone).toHaveBeenCalledWith({
      x: 11,
      y: 5,
      width: 2,
      height: 2,
      rotation: 0,
    });
  });

  it("still re-syncs the fields when the table's zone actually changes", () => {
    const { rerenderZone } = renderControl({ x: 4, y: 5, width: 2, height: 2, rotation: 0 });

    type("Center X", "11");
    rerenderZone({ x: 8, y: 9, width: 3, height: 3, rotation: 0 });

    expect(screen.getByLabelText("Center X")).toHaveValue(8);
    expect(screen.getByLabelText("Center Y")).toHaveValue(9);
  });

  it("places an untouched first zone at the centre of the view, as before", () => {
    const { onSetPlayerStagingZone } = renderControl(undefined);

    fireEvent.click(applyButton());

    // 1280x720 at scale 1 on a 50px grid: centre (640,360)px, 40% of the view.
    expect(onSetPlayerStagingZone).toHaveBeenCalledWith({
      x: 12.8,
      y: 7.2,
      width: 10.24,
      height: 5.76,
      rotation: 0,
    });
  });

  it("Center on view moves an existing zone to the view and keeps its size and rotation", () => {
    const { onSetPlayerStagingZone } = renderControl(
      { x: 1, y: 1, width: 3, height: 3, rotation: 45 },
      { x: -100, y: -50, scale: 2 },
    );

    fireEvent.click(screen.getByRole("button", { name: "Center on view" }));

    // Screen centre (640,360) -> world ((640+100)/2, (360+50)/2) = (370,205)px.
    expect(onSetPlayerStagingZone).toHaveBeenCalledWith({
      x: 7.4,
      y: 4.1,
      width: 3,
      height: 3,
      rotation: 45,
    });
  });

  it.each([
    ["a cleared centre", "Center X", ""],
    ["a width the server refuses", "Width (tiles)", "0.25"],
    ["a cleared rotation", "Rotation (degrees)", ""],
  ])("refuses to apply %s", (_case, label, value) => {
    const { onSetPlayerStagingZone } = renderControl({
      x: 4,
      y: 5,
      width: 2,
      height: 2,
      rotation: 0,
    });

    type(label, value);

    expect(applyButton()).toBeDisabled();
    fireEvent.click(applyButton());
    expect(onSetPlayerStagingZone).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(/at least 0\.5/);
  });
});
