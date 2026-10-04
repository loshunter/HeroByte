import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MapEditToolbar } from "../../MapEditToolbar";
import { MobileMapEditSheet } from "../../mobile/MobileMapEditSheet";
import { boundPalette } from "./palette.fixtures";

afterEach(cleanup);

describe("bound palette controls before U3b extraction", () => {
  it("forwards history, layers, inspector, overlay and Done through the original bag", () => {
    const h = boundPalette();
    const actions = {
      onUndo: vi.fn(),
      onRedo: vi.fn(),
      onToggleLayers: vi.fn(),
      onToggleInspector: vi.fn(),
      onToggleWallsOverlay: vi.fn(),
      onClose: vi.fn(),
    };
    render(<MapEditToolbar {...h.props({ ...actions, canUndo: true, canRedo: true })} />);
    fireEvent.click(screen.getByRole("button", { name: /Undo map/ }));
    fireEvent.click(screen.getByRole("button", { name: /Redo map/ }));
    fireEvent.click(screen.getByRole("button", { name: /Layers/ }));
    fireEvent.click(screen.getByRole("button", { name: /Inspect/ }));
    fireEvent.click(screen.getByRole("button", { name: /Pin walls overlay/ }));
    fireEvent.click(screen.getByRole("button", { name: /Close .*MAP TOOLS/ }));
    for (const callback of Object.values(actions)) expect(callback).toHaveBeenCalledTimes(1);
  });

  it("keeps hallway width and free-stamp dials on their existing callbacks", () => {
    const h = boundPalette();
    const onSelectHallwayWidth = vi.fn();
    const onRotateStamp = vi.fn();
    const onToggleStampMode = vi.fn();
    const view = render(
      <MapEditToolbar {...h.props({ activeSubTool: "hallway", onSelectHallwayWidth })} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "4" }));
    expect(onSelectHallwayWidth).toHaveBeenCalledExactlyOnceWith(4);
    view.rerender(
      <MapEditToolbar
        {...h.props({ activeSubTool: "place", stampMode: true, onRotateStamp, onToggleStampMode })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Free stamp/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Rotate stamp counter-clockwise/ }));
    expect(onToggleStampMode).toHaveBeenCalledTimes(1);
    expect(onRotateStamp).toHaveBeenCalledExactlyOnceWith(-1);
    view.rerender(<MapEditToolbar {...h.props({ activeSubTool: "scatter", stampMode: true })} />);
    expect(screen.queryByRole("button", { name: /^Rotate counter-clockwise/ })).toBeNull();
  });

  it("shows only the active Generate or curve dials without firing a recipe", () => {
    const h = boundPalette();
    const onGenerate = vi.fn();
    const onSelectSplineKind = vi.fn();
    const view = render(
      <MapEditToolbar {...h.props({ activeSubTool: "spline", onSelectSplineKind })} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Chain" }));
    expect(onSelectSplineKind).toHaveBeenCalledExactlyOnceWith("chain");
    expect(screen.queryByText(/Seed/)).toBeNull();
    view.rerender(<MapEditToolbar {...h.props({ activeSubTool: "generate", onGenerate })} />);
    expect(screen.getByText(/Seed/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Chain" })).toBeNull();
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("mobile keeps tools with dials open and closes argument-free tools for aiming", () => {
    const h = boundPalette();
    const onToggleTools = vi.fn();
    const onSelectSubTool = vi.fn();
    render(
      <MobileMapEditSheet
        toolbar={h.props({ onSelectSubTool })}
        onToggleTools={onToggleTools}
        onResetCamera={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Room" }));
    expect(onSelectSubTool).toHaveBeenLastCalledWith("room");
    expect(onToggleTools).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sample" }));
    expect(onSelectSubTool).toHaveBeenLastCalledWith("eyedropper");
    expect(onToggleTools).toHaveBeenCalledTimes(1);
  });
});
