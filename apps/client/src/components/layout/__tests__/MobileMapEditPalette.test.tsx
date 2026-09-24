import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { MobileFloatingControls } from "../MobileFloatingControls";
import { toolbar, props, dock } from "./mobileMapEditPalette.fixtures";
afterEach(cleanup);
describe("the map-edit palette", () => {
  it("REPLACES the player dock rather than adding to it", () => {
    render(<MobileFloatingControls {...props()} />);

    expect(within(dock()).getAllByRole("button")).toHaveLength(5);
    // The player-facing surfaces are gone while the mode is armed — nothing
    // may cover the map, and nothing may claim the same five slots.
    expect(screen.queryByRole("navigation", { name: /mobile actions/i })).toBeNull();
    for (const gone of [/^Party$/, /^Dice$/, /^Log$/, /^DM$/, /^View$/]) {
      expect(screen.queryByRole("button", { name: gone })).toBeNull();
    }
    for (const present of [/Exit/, /Tool/, /Undo/, /Redo/, /Cancel placement/]) {
      expect(within(dock()).getByRole("button", { name: present })).toBeVisible();
    }
  });

  it("keeps the normal dock when the mode is not armed", () => {
    render(<MobileFloatingControls {...props({ mode: false, activeTool: null })} />);

    expect(screen.getByRole("navigation", { name: /mobile actions/i })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: /map edit actions/i })).toBeNull();
  });

  it("Exit leaves the mode through the palette's own onClose", () => {
    const bar = toolbar();
    render(<MobileFloatingControls {...props({ mapEditToolbarProps: bar })} />);

    fireEvent.click(within(dock()).getByRole("button", { name: /Exit/ }));
    expect(bar.onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps a disabled Stop slot while no gesture is pending", () => {
    render(<MobileFloatingControls {...props()} />);
    const cancel = within(dock()).getByRole("button", { name: "Cancel placement" });
    expect(cancel).toBeDisabled();
    expect(cancel).toHaveTextContent("Stop");
    expect(within(dock()).getAllByRole("button")[4]).toBe(cancel);
    expect(within(dock()).getAllByRole("button")).toHaveLength(5);
  });

  it("no OTHER dock slot acts on pointer down", () => {
    // Stop is the exception and should stay one: Exit, Tool, Undo and Redo
    // are ordinary buttons, and a dock that fired everything on touch-down
    // would leave no way to slide a thumb off a mis-aimed press.
    const bar = toolbar({ isLive: true, canUndo: true, canRedo: true });
    const onToggleSurface = vi.fn();
    render(<MobileFloatingControls {...props({ mapEditToolbarProps: bar, onToggleSurface })} />);

    for (const name of [/Exit/, /Tool/, /Undo/, /Redo/]) {
      fireEvent.pointerDown(within(dock()).getByRole("button", { name }));
    }

    expect(bar.onClose).not.toHaveBeenCalled();
    expect(bar.onUndo).not.toHaveBeenCalled();
    expect(bar.onRedo).not.toHaveBeenCalled();
    expect(onToggleSurface).not.toHaveBeenCalled();
  });

  describe("before a live map exists", () => {
    it("offers START LIVE MAP and NOTHING that would silently no-op", () => {
      render(<MobileFloatingControls {...props({ surface: "tools" })} />);

      expect(screen.getByRole("button", { name: /Start live map/i })).toBeEnabled();
      // The trap: without an active live document every tool is inert and the
      // controller says nothing about it.
      expect(screen.queryByRole("button", { name: /Room/ })).toBeNull();
      expect(screen.queryByRole("button", { name: /Wall/ })).toBeNull();
      expect(within(dock()).getByRole("button", { name: /Undo/ })).toBeDisabled();
      expect(within(dock()).getByRole("button", { name: /Redo/ })).toBeDisabled();
    });

    it("keeps Undo and Redo disabled even when the CONTROLLER has history", () => {
      // The case the gate exists for, and the one the test above cannot see:
      // a DM with a Map Studio document open has canUndo true while isLive is
      // false. Undo would then rewind the WRONG document. Varying canUndo is
      // the only way this assertion can fail — measured: with both left at
      // false, deleting the isLive gate stayed green.
      render(
        <MobileFloatingControls
          {...props({
            surface: "tools",
            mapEditToolbarProps: toolbar({ canUndo: true, canRedo: true }),
          })}
        />,
      );

      expect(within(dock()).getByRole("button", { name: /Undo/ })).toBeDisabled();
      expect(within(dock()).getByRole("button", { name: /Redo/ })).toBeDisabled();
    });

    it("disables START while a create/bind round trip is in flight", () => {
      render(
        <MobileFloatingControls
          {...props({ surface: "tools", mapEditToolbarProps: toolbar({ busy: true }) })}
        />,
      );
      expect(screen.getByRole("button", { name: /Starting/i })).toBeDisabled();
    });
  });
});
