/**
 * U10a — the four area templates say what shape they draw, on both layouts.
 *
 * "Burst / Cone / Cube / Bolt" are the table's words (5e's), so the labels stay;
 * what was missing was the shape in plain words, and the help named the tools
 * "Circle / Square / Line" and "Rect" where the buttons say otherwise.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AREA_TEMPLATE_TOOLS, type DrawTool } from "@herobyte/shared";
import { MobileDrawingControls } from "../../../../layouts/MobileDrawingControls";
import {
  ANNOTATION_TOOLS,
  DRAWING_TOOL_LABELS,
  TEMPLATE_TOOL_DESCRIPTIONS,
} from "../../drawingTools";
import { DrawingToolbar } from "../DrawingToolbar";

const toolbarProps = {
  drawTool: "freehand" as DrawTool,
  drawColor: "#ffffff",
  drawWidth: 3,
  drawOpacity: 1,
  drawFilled: false,
  onToolChange: vi.fn(),
  onColorChange: vi.fn(),
  onWidthChange: vi.fn(),
  onOpacityChange: vi.fn(),
  onFilledChange: vi.fn(),
  onClearAll: vi.fn(),
};

describe("template shape descriptions", () => {
  it("has one plain-words description per template tool, naming the shape", () => {
    expect(Object.keys(TEMPLATE_TOOL_DESCRIPTIONS).sort()).toEqual([...AREA_TEMPLATE_TOOLS].sort());
    expect(TEMPLATE_TOOL_DESCRIPTIONS["template-circle"]).toMatch(/circle/i);
    expect(TEMPLATE_TOOL_DESCRIPTIONS["template-cone"]).toMatch(/wedge/i);
    expect(TEMPLATE_TOOL_DESCRIPTIONS["template-square"]).toMatch(/square/i);
    expect(TEMPLATE_TOOL_DESCRIPTIONS["template-line"]).toMatch(/line/i);
    // buildAreaTemplate snaps the origin to the nearest HALF square on each axis (a cell
    // centre, a corner or an edge middle); a cube snaps to a corner. The words say so.
    for (const tool of ["template-circle", "template-cone", "template-line"] as const) {
      expect(TEMPLATE_TOOL_DESCRIPTIONS[tool]).toMatch(
        /cell centre, grid corner or cell-edge middle/,
      );
    }
    expect(TEMPLATE_TOOL_DESCRIPTIONS["template-square"]).toMatch(/grid corner/);
  });

  it.each(AREA_TEMPLATE_TOOLS)("desktop shows the %s description once it is active", (tool) => {
    render(<DrawingToolbar {...toolbarProps} drawTool={tool} />);
    expect(screen.getByText(TEMPLATE_TOOL_DESCRIPTIONS[tool])).toBeInTheDocument();
  });

  it.each(AREA_TEMPLATE_TOOLS)("phone shows the %s description once it is active", (tool) => {
    render(
      <MobileDrawingControls
        {...toolbarProps}
        drawTool={tool}
        collapsed={false}
        onCollapsedChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(TEMPLATE_TOOL_DESCRIPTIONS[tool])).toBeInTheDocument();
  });

  it.each(ANNOTATION_TOOLS)(
    "renders no hint at all while the annotation tool %s is active, on both layouts",
    (tool) => {
      const desktop = render(<DrawingToolbar {...toolbarProps} drawTool={tool} />);
      expect(screen.queryByTestId("template-tool-hint")).toBeNull();
      desktop.unmount();
      render(
        <MobileDrawingControls
          {...toolbarProps}
          drawTool={tool}
          collapsed={false}
          onCollapsedChange={vi.fn()}
          onClose={vi.fn()}
        />,
      );
      expect(screen.queryByTestId("template-tool-hint")).toBeNull();
    },
  );

  it.each(AREA_TEMPLATE_TOOLS)(
    "gives the desktop %s button its description as a tooltip, and keeps its name",
    (tool) => {
      render(<DrawingToolbar {...toolbarProps} />);
      expect(
        screen.getByRole("button", { name: new RegExp(DRAWING_TOOL_LABELS[tool]) }),
      ).toHaveAttribute("title", TEMPLATE_TOOL_DESCRIPTIONS[tool]);
    },
  );
});
