/**
 * The phone's select panel — the only route to deleting a single element there.
 *
 * Three things here are load-bearing rather than cosmetic:
 *   - DELETE reaches `onRemoveElement` with the SELECTED element's id, because
 *     a delete button wired to the wrong id is indistinguishable from a correct
 *     one until a DM loses the wrong wall;
 *   - the readout survives an ABSENT selection, not merely a null one — partial
 *     toolbar bags hand this panel `undefined`, and `=== null` would sail past
 *     that and dereference it;
 *   - a locked element disables DELETE rather than round-tripping to the
 *     server's refusal, which is the desktop Inspector's behaviour and the one
 *     place this panel deliberately does better.
 */

import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { MapElement } from "@herobyte/shared";
import { MobileSelectPanel } from "../MobileSelectPanel";
import type { MapEditToolbarProps } from "../../mapEditTypes";

afterEach(() => cleanup());

const element = (overrides: Partial<MapElement> = {}): MapElement =>
  ({
    id: "wall-7",
    layerId: "walls",
    locked: false,
    hidden: false,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    type: "wall",
    data: { points: [0, 0, 100, 0], family: "stone", thickness: 8, blocksVision: true },
    ...overrides,
  }) as unknown as MapElement;

const bag = (overrides: Record<string, unknown> = {}) =>
  ({
    activeSubTool: "select",
    selectedElement: null,
    onRemoveElement: vi.fn(),
    ...overrides,
  }) as unknown as MapEditToolbarProps;

const deleteButton = () => screen.getByTestId("mobile-select-delete");
const status = () => screen.getByTestId("mobile-select-status").textContent ?? "";

describe("MobileSelectPanel", () => {
  it("asks for a tap and refuses to delete when nothing is picked", () => {
    render(<MobileSelectPanel {...bag()} />);

    expect(status()).toMatch(/tap an element/i);
    expect(deleteButton()).toBeDisabled();
  });

  // The bag this panel is spread from is built by hand in several test files
  // and does not always carry selectedElement. Absent must read as "nothing
  // picked", not throw — a `=== null` check would not catch this.
  it("treats an ABSENT selection the same as an empty one", () => {
    const props = bag();
    delete (props as unknown as Record<string, unknown>).selectedElement;

    render(<MobileSelectPanel {...props} />);

    expect(status()).toMatch(/tap an element/i);
    expect(deleteButton()).toBeDisabled();
  });

  it("names what is picked and deletes THAT element", () => {
    const props = bag({ selectedElement: element({ id: "wall-7" }) });
    render(<MobileSelectPanel {...props} />);

    expect(status()).toMatch(/wall/i);
    expect(deleteButton()).toBeEnabled();

    fireEvent.click(deleteButton());
    expect(props.onRemoveElement).toHaveBeenCalledWith("wall-7");
    expect(props.onRemoveElement).toHaveBeenCalledTimes(1);
  });

  it("says WHY a locked element cannot go, and does not send the command", () => {
    const props = bag({ selectedElement: element({ locked: true }) });
    render(<MobileSelectPanel {...props} />);

    expect(status()).toMatch(/locked/i);
    expect(deleteButton()).toBeDisabled();

    fireEvent.click(deleteButton());
    expect(props.onRemoveElement).not.toHaveBeenCalled();
  });

  // A kind with no label would render "undefined picked" — a readout that looks
  // like a rendering bug rather than the missing map entry it is. The union is
  // closed in shared, so this is the runtime half of that compile-time check.
  it("has a readable name for every element kind the document can hold", () => {
    const kinds: MapElement["type"][] = [
      "tile",
      "stamp",
      "shape",
      "wall",
      "door",
      "light",
      "text",
      "spline",
    ];

    for (const type of kinds) {
      const { unmount } = render(
        <MobileSelectPanel {...bag({ selectedElement: element({ type }) })} />,
      );
      expect(status(), `${type} has no label`).not.toMatch(/undefined/);
      expect(status().trim().length).toBeGreaterThan(0);
      unmount();
    }
  });

  // `saving` (a command in flight) is what gates edits; `busy` is the
  // create/open/bind round trip, over before this panel can render. The panel
  // shipped reading `busy`, so its guard was inert exactly when it was needed.
  // The pair below is DISCRIMINATING — a swap back fails one of them.
  it("disables the inspector's Apply while a command is in flight (saving)", () => {
    render(
      <MobileSelectPanel
        {...bag({
          selectedElement: element(),
          inspectorOpen: true,
          onToggleInspector: vi.fn(),
          layers: [],
          saving: true,
          busy: false,
        })}
      />,
    );
    expect(screen.getByTestId("mobile-inspector-apply")).toBeDisabled();
  });

  it("does NOT gate the inspector on the bind round-trip flag (busy)", () => {
    render(
      <MobileSelectPanel
        {...bag({
          selectedElement: element(),
          inspectorOpen: true,
          onToggleInspector: vi.fn(),
          layers: [],
          saving: false,
          busy: true,
        })}
      />,
    );
    expect(screen.getByTestId("mobile-inspector-apply")).toBeEnabled();
  });
});
