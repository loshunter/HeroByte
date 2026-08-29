/**
 * The inspector's draft buffer vs the server's acks.
 *
 * Every applied map-studio command replies with a freshly parsed document, so
 * the SAME element arrives as a NEW object on every ack — and the Door row
 * fires its own command on the spot, so the panel can trigger the very ack
 * that used to wipe it. The contract pinned here:
 *
 *   - staged edits SURVIVE the same element returning as a new object;
 *   - a DIFFERENT element always re-seeds, staged edits or not;
 *   - with nothing staged, a changed element re-seeds (another DM's edit
 *     must show);
 *   - Apply hands the values back to the server, so the NEXT ack re-seeds.
 *
 * The first of these is the defect: re-seeding on `[element]` identity alone
 * discarded the DM's un-applied rotate/resize/layer/hide edits, and ✓ Apply
 * then sent the server's own numbers back to it.
 */

import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { MapElement, MapLayer } from "@herobyte/shared";
import { MobileElementInspector } from "../MobileElementInspector";

afterEach(() => cleanup());

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
];

const stamp = (overrides: Partial<MapElement> = {}): MapElement =>
  ({
    id: "stamp-1",
    layerId: "objects",
    locked: false,
    hidden: false,
    transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0 },
    type: "stamp",
    data: { assetId: "objects:crate" },
    ...overrides,
  }) as unknown as MapElement;

function renderInspector(element: MapElement, onUpdate = vi.fn()) {
  const view = render(
    <MobileElementInspector
      element={element}
      layers={layers}
      open
      onToggle={vi.fn()}
      disabled={false}
      onUpdate={onUpdate}
      onUpdateDoor={vi.fn()}
    />,
  );
  return { view, onUpdate };
}

const readout = () => screen.getByText(/Rotation — /).textContent ?? "";

describe("MobileElementInspector re-seeding", () => {
  it("staged edits SURVIVE the same element returning as a new object", () => {
    const { view, onUpdate } = renderInspector(stamp());

    fireEvent.click(screen.getByRole("button", { name: "Turn element clockwise" }));
    expect(readout()).toContain("15°");

    // The ack: same id, same values, NEW object — what every applied command
    // (its own door row included) produces.
    view.rerender(
      <MobileElementInspector
        element={stamp()}
        layers={layers}
        open
        onToggle={vi.fn()}
        disabled={false}
        onUpdate={onUpdate}
        onUpdateDoor={vi.fn()}
      />,
    );

    expect(readout()).toContain("15°");
    fireEvent.click(screen.getByTestId("mobile-inspector-apply"));
    expect(onUpdate).toHaveBeenCalledWith(
      "stamp-1",
      expect.objectContaining({ transform: expect.objectContaining({ rotation: 15 }) }),
    );
  });

  it("a DIFFERENT element re-seeds even mid-edit", () => {
    const { view } = renderInspector(stamp());
    fireEvent.click(screen.getByRole("button", { name: "Turn element clockwise" }));
    expect(readout()).toContain("15°");

    view.rerender(
      <MobileElementInspector
        element={stamp({ id: "stamp-2" })}
        layers={layers}
        open
        onToggle={vi.fn()}
        disabled={false}
        onUpdate={vi.fn()}
        onUpdateDoor={vi.fn()}
      />,
    );

    expect(readout()).toContain("0°");
  });

  it("with nothing staged, a changed element re-seeds — another DM's edit must show", () => {
    const { view } = renderInspector(stamp());
    expect(readout()).toContain("0°");

    view.rerender(
      <MobileElementInspector
        element={stamp({ transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 30 } })}
        layers={layers}
        open
        onToggle={vi.fn()}
        disabled={false}
        onUpdate={vi.fn()}
        onUpdateDoor={vi.fn()}
      />,
    );

    expect(readout()).toContain("30°");
  });

  it("Apply hands the values back: the NEXT ack re-seeds again", () => {
    const { view, onUpdate } = renderInspector(stamp());
    fireEvent.click(screen.getByRole("button", { name: "Turn element clockwise" }));
    fireEvent.click(screen.getByTestId("mobile-inspector-apply"));
    expect(onUpdate).toHaveBeenCalledTimes(1);

    // The ack lands with a value that differs from the draft — after Apply the
    // panel must take the server's word rather than keep its own.
    view.rerender(
      <MobileElementInspector
        element={stamp({ transform: { x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 90 } })}
        layers={layers}
        open
        onToggle={vi.fn()}
        disabled={false}
        onUpdate={onUpdate}
        onUpdateDoor={vi.fn()}
      />,
    );

    expect(readout()).toContain("90°");
  });
});
