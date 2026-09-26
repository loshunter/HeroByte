import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BRUSH_TOOLS, CLICK_TOOLS, DRAG_TOOLS } from "../mapEditToolKinds";
import {
  AUTHORING_TOOLS,
  TOOL_DESCRIPTORS,
  TOOL_GROUPS,
  MOBILE_PANEL_TOOLS,
} from "../mapEditToolDescriptors";
import { MapEditToolbar } from "../MapEditToolbar";
import { MobileMapEditSheet } from "../mobile/MobileMapEditSheet";
import { boundPalette } from "./characterization/palette.fixtures";

afterEach(cleanup);

describe("the shared palette inventory", () => {
  it("exhausts the existing tool kinds without duplicating Select and Sample", () => {
    expect([...AUTHORING_TOOLS].sort()).toEqual(
      [...BRUSH_TOOLS, ...DRAG_TOOLS, ...CLICK_TOOLS].sort(),
    );
    expect(new Set(AUTHORING_TOOLS).size).toBe(12);
    expect(Object.keys(TOOL_DESCRIPTORS)).toHaveLength(14);
    expect([...MOBILE_PANEL_TOOLS].sort()).toEqual(
      [
        "terrain",
        "erase",
        "room",
        "hallway",
        "place",
        "scatter",
        "row",
        "spline",
        "generate",
        "select",
      ].sort(),
    );
  });

  it.each([false, true])(
    "reaches every existing tool exactly once through groups (phone=%s)",
    (mobile) => {
      const h = boundPalette();
      const onToggleTools = vi.fn();
      const palette = () =>
        mobile ? (
          <MobileMapEditSheet
            toolbar={h.props()}
            onToggleTools={onToggleTools}
            onResetCamera={vi.fn()}
          />
        ) : (
          <MapEditToolbar {...h.props()} />
        );
      const view = render(palette());
      const seen: string[] = [];
      for (const group of TOOL_GROUPS) {
        fireEvent.change(screen.getByRole("combobox", { name: "Tool group" }), {
          target: { value: group.id },
        });
        view.rerender(palette());
        for (const tool of AUTHORING_TOOLS.filter(
          (id) => TOOL_DESCRIPTORS[id].group === group.id,
        )) {
          const button = screen.getByTestId(`build-tool-${tool}`);
          expect(button).toHaveAccessibleName(TOOL_DESCRIPTORS[tool].label);
          onToggleTools.mockClear();
          fireEvent.click(button);
          expect(h.result.current.state.activeSubTool).toBe(tool);
          if (mobile)
            expect(onToggleTools).toHaveBeenCalledTimes(
              ["wall", "door", "light"].includes(tool) ? 1 : 0,
            );
          seen.push(tool);
          view.rerender(palette());
        }
      }
      for (const tool of ["select", "eyedropper"] as const) {
        onToggleTools.mockClear();
        fireEvent.click(screen.getByTestId(`build-tool-${tool}`));
        expect(h.result.current.state.activeSubTool).toBe(tool);
        if (mobile) expect(onToggleTools).toHaveBeenCalledTimes(tool === "eyedropper" ? 1 : 0);
        seen.push(tool);
        view.rerender(palette());
      }
      expect(seen.sort()).toEqual(Object.keys(TOOL_DESCRIPTORS).sort());
    },
  );

  it("remembers each group's last tool and follows the same stable quick-wheel actions", () => {
    const h = boundPalette();
    const wheel = h.result.current.state.wheelActions;
    act(() => wheel.selectSubTool("hallway"));
    act(() => h.props().onSelectGroup("objects"));
    expect(h.result.current.state.activeSubTool).toBe("place");
    act(() => wheel.selectSubTool("spline"));
    act(() => h.props().onSelectGroup("structures"));
    expect(h.result.current.state.activeSubTool).toBe("hallway");
    act(() => h.props().onSelectSubTool("select"));
    expect(h.props().activeGroup).toBe("structures");
    act(() => h.props().onSelectGroup("objects"));
    expect(h.result.current.state.activeSubTool).toBe("spline");
    expect(h.result.current.state.wheelActions).toBe(wheel);
  });
});
