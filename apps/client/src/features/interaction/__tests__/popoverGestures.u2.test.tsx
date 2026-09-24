// Uses the already-adopted real drawing fixture; do not copy or reimplement it.
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HelpMenuButton } from "../../help/HelpMenuButton";
import type { KickControls } from "../../atlas/useKickedInDoor";
import {
  mountDrawing,
  moveTo,
  pressAt,
} from "../../../hooks/__tests__/characterization/drawingLifecycle.fixtures";
import { escape, KickHarness, kickCalls } from "./popoverOwners.fixtures";

afterEach(cleanup);
describe.each(["Help", "Kick"])("ordinary %s opening and a held real annotation stroke", (kind) => {
  it("opening then dismissing the popover preserves the stroke and permits one normal release", () => {
    const drawing = mountDrawing();
    pressAt(drawing, { x: 0, y: 0 });
    moveTo(drawing, { x: 10, y: 10 });
    const api = { current: null as KickControls | null };
    render(kind === "Help" ? <HelpMenuButton /> : <KickHarness calls={kickCalls()} api={api} />);
    fireEvent.click(screen.getByRole("button", { name: kind === "Help" ? "Help" : "Open kick" }));
    expect(drawing.result.current.isDrawing).toBe(true);
    expect(drawing.sendMessage).not.toHaveBeenCalled();
    const layer =
      kind === "Help"
        ? screen.getByRole("dialog", { name: "HeroByte help" })
        : screen.getByTestId("kick-panel");
    expect(escape(layer).defaultPrevented).toBe(true);
    expect(layer).not.toBeInTheDocument();
    expect(drawing.result.current.isDrawing).toBe(true);
    act(() => drawing.result.current.onMouseUp());
    expect(drawing.sendMessage).toHaveBeenCalledTimes(1);
    expect(drawing.sendMessage).toHaveBeenCalledWith({
      t: "draw",
      drawing: expect.objectContaining({
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
      }),
    });
  });

  it("a later Escape cancels the held stroke; move/release cannot revive it", () => {
    const drawing = mountDrawing();
    pressAt(drawing, { x: 0, y: 0 });
    moveTo(drawing, { x: 10, y: 10 });
    const api = { current: null as KickControls | null };
    render(kind === "Help" ? <HelpMenuButton /> : <KickHarness calls={kickCalls()} api={api} />);
    fireEvent.click(screen.getByRole("button", { name: kind === "Help" ? "Help" : "Open kick" }));
    escape(document.body);
    expect(drawing.result.current.isDrawing).toBe(true);
    escape(document.body);
    moveTo(drawing, { x: 20, y: 20 });
    act(() => drawing.result.current.onMouseUp());
    expect(drawing.result.current.isDrawing).toBe(false);
    expect(drawing.result.current.currentDrawing).toEqual([]);
    expect(drawing.sendMessage).not.toHaveBeenCalled();
  });
});
