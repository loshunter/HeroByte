// The two Grid sliders had a visible caption beside them and no name of their own (found in the
// U10c journeys): a screen reader said "slider" and a voice command could not target either.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GridControl } from "../GridControl";

describe("GridControl sliders are named", () => {
  it("names both sliders by their visible caption and reads their value with its unit", () => {
    render(
      <GridControl
        gridSize={50}
        gridSquareSize={5}
        gridLocked={false}
        onGridSizeChange={vi.fn()}
        onGridSquareSizeChange={vi.fn()}
        onGridLockToggle={vi.fn()}
      />,
    );
    const size = screen.getByRole("slider", { name: "Grid size" });
    expect(size).toHaveAttribute("aria-valuetext", "50 pixels");
    const square = screen.getByRole("slider", { name: "Square size" });
    expect(square).toHaveAttribute("aria-valuetext", "5 feet");
  });
});
