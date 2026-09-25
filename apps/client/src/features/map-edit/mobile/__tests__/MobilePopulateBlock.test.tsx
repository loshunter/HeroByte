import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobilePopulateBlock } from "../MobilePopulateBlock";
import { boundPalette } from "../../__tests__/characterization/palette.fixtures";

afterEach(cleanup);
const target = { kind: "room" as const, bounds: { x: 0, y: 0, width: 500, height: 500 } };

describe("decoration controls on a phone", () => {
  it("shows the named target and forwards the controller's reason", () => {
    const h = boundPalette();
    render(
      <MobilePopulateBlock
        {...h.props({
          populateTarget: { ...target, kind: "hallway" },
          canPopulate: false,
          populateHint: "The target layer is locked.",
        })}
      />,
    );
    expect(screen.getByRole("button", { name: /Decorate last hallway/ })).toBeDisabled();
    expect(screen.getByTestId("mobile-populate-status")).toHaveTextContent(
      "The target layer is locked.",
    );
  });

  it("shows the dials only when a target exists, including a temporarily unavailable target", () => {
    const h = boundPalette();
    const view = render(<MobilePopulateBlock {...h.props()} />);
    expect(screen.queryByText("From")).toBeNull();
    expect(screen.getByRole("button", { name: /Decorate last/ })).toBeDisabled();
    view.rerender(
      <MobilePopulateBlock {...h.props({ populateTarget: target, canPopulate: true })} />,
    );
    expect(screen.getByText("From")).toBeVisible();
    expect(screen.getByText("How much")).toBeVisible();
    expect(screen.getByRole("button", { name: /Decorate last room/ })).toBeEnabled();
  });

  it("forwards category, density and decoration to the original callbacks", () => {
    const h = boundPalette();
    const onSelectPopulateCategory = vi.fn(),
      onSelectPopulateDensity = vi.fn(),
      onPopulate = vi.fn();
    render(
      <MobilePopulateBlock
        {...h.props({
          populateTarget: target,
          canPopulate: true,
          onSelectPopulateCategory,
          onSelectPopulateDensity,
          onPopulate,
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Terrain/i }));
    expect(onSelectPopulateCategory).toHaveBeenCalledExactlyOnceWith("terrain");
    fireEvent.click(screen.getByRole("button", { name: /Low/i }));
    expect(onSelectPopulateDensity).toHaveBeenCalledExactlyOnceWith("low");
    fireEvent.click(screen.getByRole("button", { name: /Decorate last room/ }));
    expect(onPopulate).toHaveBeenCalledTimes(1);
  });

  it("cannot fire during a placement and retains its target readout", () => {
    const h = boundPalette();
    const onPopulate = vi.fn();
    render(
      <MobilePopulateBlock
        {...h.props({
          populateTarget: target,
          saving: true,
          canPopulate: false,
          populateHint: "Working… wait for the map to finish.",
          onPopulate,
        })}
      />,
    );
    const button = screen.getByRole("button", { name: /Decorate last room/ });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onPopulate).not.toHaveBeenCalled();
    expect(screen.getByTestId("mobile-populate-status")).toHaveTextContent(/Working/);
  });
});
