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
  DRAWING_TOOL_HINT_DEFAULT,
  DRAWING_TOOL_LABELS,
  TEMPLATE_TOOL_DESCRIPTIONS,
} from "../../drawingTools";
import { HELP_TOPICS } from "../../../help/helpTopics";
import { DrawingToolbar } from "../DrawingToolbar";
import { TEMPLATE_HINT_ID } from "../TemplateToolHint";

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
  });

  it("keeps each description short (a cheap length guard: mobile-draw-template.spec.ts measures the real wrap at 320, 640 and 667 px)", () => {
    // The browser measures the wrap (mobile-draw-template.spec.ts); this is the guard
    // that stops a long sentence being written before that spec ever runs.
    for (const text of Object.values(TEMPLATE_TOOL_DESCRIPTIONS)) {
      expect(text.length).toBeLessThanOrEqual(66);
    }
    expect(DRAWING_TOOL_HINT_DEFAULT.length).toBeLessThanOrEqual(66);
  });

  it("says in the help where each template snaps (the detail the short lines leave out)", () => {
    const detail = JSON.stringify(HELP_TOPICS);
    // buildAreaTemplate snaps the origin to the nearest HALF square on each axis (a cell
    // centre, a corner or an edge middle); a cube snaps to a corner.
    expect(detail).toMatch(/Burst, Cone or Bolt starts at the nearest cell centre, grid corner/);
    expect(detail).toMatch(/cell-edge middle to where you press/);
    expect(detail).toMatch(/a Cube at the nearest grid corner/);
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
    "desktop renders no hint while the annotation tool %s is active; the phone's fixed line holds the general instruction",
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
      expect(screen.getByRole("status")).toHaveTextContent(DRAWING_TOOL_HINT_DEFAULT);
    },
  );

  it.each(AREA_TEMPLATE_TOOLS)("the phone's line is one status that holds the %s text", (tool) => {
    render(
      <MobileDrawingControls
        {...toolbarProps}
        drawTool={tool}
        collapsed={false}
        onCollapsedChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(TEMPLATE_TOOL_DESCRIPTIONS[tool]);
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it.each(AREA_TEMPLATE_TOOLS)(
    "desktop: the active %s button does not repeat the line as a tooltip, and is described by it",
    (tool) => {
      render(<DrawingToolbar {...toolbarProps} drawTool={tool} />);
      const button = screen.getByRole("button", { name: new RegExp(DRAWING_TOOL_LABELS[tool]) });
      expect(button).not.toHaveAttribute("title");
      expect(button).toHaveAttribute("aria-describedby", TEMPLATE_HINT_ID);
      expect(document.getElementById(TEMPLATE_HINT_ID)).toHaveTextContent(
        TEMPLATE_TOOL_DESCRIPTIONS[tool],
      );
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
