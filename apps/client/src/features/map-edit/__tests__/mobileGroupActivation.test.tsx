import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileMapEditSheet } from "../mobile/MobileMapEditSheet";
import { boundPalette } from "./characterization/palette.fixtures";

afterEach(cleanup);

describe("phone group activation uses the remembered tool's close policy", () => {
  it.each([
    ["light", "lighting", false], // U5: Ambient light is available before returning to the map.
    ["erase", "terrain", false], // U4b: brush size keeps Erase settings open.
    ["wall", "structures", true],
    ["room", "structures", false],
    ["terrain", "terrain", false],
  ] as const)("activates %s directly from its group", (tool, group, closes) => {
    const h = boundPalette();
    act(() => h.props().onSelectSubTool(tool));
    act(() => h.props().onSelectSubTool("spline"));
    const close = vi.fn();
    render(
      <MobileMapEditSheet toolbar={h.props()} onToggleTools={close} onResetCamera={vi.fn()} />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Tool group" }), {
      target: { value: group },
    });
    expect(h.result.current.state.activeSubTool).toBe(tool);
    expect(close).toHaveBeenCalledTimes(closes ? 1 : 0);
  });
});
