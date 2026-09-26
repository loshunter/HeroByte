/**
 * Tests for the mobile drawing sheet's template chips (S6)
 *
 * Arc §7a: every slice ships its mobile surface in the same slice. Templates
 * get theirs by being DRAWING tools — they ride the sheet that already exists,
 * so the hardcoded 5-column dock is untouched and no new gesture is needed.
 *
 * Source: apps/client/src/layouts/MobileDrawingControls.tsx
 */

import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AREA_TEMPLATE_TOOLS } from "@herobyte/shared";
import { MobileDrawingControls } from "../MobileDrawingControls";

function renderSheet(overrides: Partial<Parameters<typeof MobileDrawingControls>[0]> = {}) {
  const onToolChange = vi.fn();
  function Sheet() {
    const [collapsed, setCollapsed] = useState(false);
    return (
      <MobileDrawingControls
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        drawTool="freehand"
        drawColor="#ffffff"
        drawWidth={3}
        drawOpacity={1}
        drawFilled={false}
        onToolChange={onToolChange}
        onColorChange={vi.fn()}
        onWidthChange={vi.fn()}
        onOpacityChange={vi.fn()}
        onFilledChange={vi.fn()}
        onClose={vi.fn()}
        {...overrides}
      />
    );
  }
  render(<Sheet />);
  return { onToolChange };
}

describe("MobileDrawingControls — templates", () => {
  it("can hide settings while keeping drawing and history active, then restore them", () => {
    const onClose = vi.fn();
    const onUndo = vi.fn();
    const { onToolChange } = renderSheet({
      drawTool: "rect",
      drawColor: "#66cc66",
      drawWidth: 17,
      drawOpacity: 0.4,
      drawFilled: true,
      canUndo: true,
      onUndo,
      onClose,
    });
    fireEvent.click(screen.getByRole("button", { name: "Hide drawing controls" }));
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.queryByRole("button", { name: "Rectangle" })).toBeNull();
    expect(screen.getByText("Drawing: Rectangle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show drawing controls" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    fireEvent.click(screen.getByRole("button", { name: "Undo drawing" }));
    expect(onUndo).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    expect(onToolChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Show drawing controls" }));
    expect(screen.getByRole("slider", { name: "Stroke width (px)" })).toHaveValue("17");
    expect(screen.getByRole("slider", { name: "Opacity (%)" })).toHaveValue("40");
    expect(screen.getByLabelText("Drawing color", { exact: true })).toHaveValue("#66cc66");
    expect(screen.getByRole("checkbox", { name: "Filled" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Rectangle" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Done drawing" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("offers every template tool on a phone", () => {
    renderSheet();
    expect(screen.getByRole("button", { name: "AoE Burst" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AoE Cone" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AoE Cube" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AoE Bolt" })).toBeInTheDocument();
  });

  it("keeps the original five drawing tools alongside them", () => {
    renderSheet();
    for (const label of ["Freehand", "Line", "Rectangle", "Circle", "Erase drawings"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("gives no two chips the same label", () => {
    // "line" is both a drawing tool and a template kind; two chips reading the
    // same word on a 375px row is a coin toss for the player.
    renderSheet();
    const labels = screen.getAllByRole("button").map((b) => b.textContent);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("has a chip for every tool the shared list defines — no drift", () => {
    // The old code duplicated the tool list as a literal tuple here; a template
    // added to shared and forgotten here would be invisible on mobile.
    const { onToolChange } = renderSheet();
    for (const tool of AREA_TEMPLATE_TOOLS) {
      onToolChange.mockClear();
      const kind = tool.replace("template-", "");
      const label = {
        circle: "AoE Burst",
        cone: "AoE Cone",
        square: "AoE Cube",
        line: "AoE Bolt",
      }[kind]!;
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(onToolChange).toHaveBeenCalledWith(tool);
    }
  });

  it("marks the active template chip", () => {
    renderSheet({ drawTool: "template-cone" });
    expect(screen.getByRole("button", { name: "AoE Cone" }).className).toContain(
      "mobile-chip--active",
    );
    expect(screen.getByRole("button", { name: "Freehand" }).className).not.toContain(
      "mobile-chip--active",
    );
  });

  it("needs no size field — the drag decides, so nothing new competes for space", () => {
    renderSheet({ drawTool: "template-circle" });
    expect(screen.queryByLabelText(/size in feet/i)).toBeNull();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });
});
