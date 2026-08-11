/**
 * The dock BECOMES the palette in map-edit mode (redesign §1).
 *
 * Two things here are load-bearing rather than cosmetic:
 *   - the dock stays at exactly five slots, because herobyte.css pins it to
 *     `repeat(5, minmax(0, 1fr))` and a sixth child overlaps rather than wraps
 *     (a settled owner decision, handoff §9);
 *   - every authoring control is disabled until the palette can say ● LIVE,
 *     because the controller no-ops SILENTLY without an active live document.
 *     A tool that looks armed and does nothing is the worst failure this mode
 *     has, and it is invisible to anything but a disabled-state assertion.
 */

import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { MobileFloatingControls } from "../MobileFloatingControls";
import type { MobileSurface } from "../../../hooks/useMobileSurface";
import type { MapEditToolbarProps } from "../../../features/map-edit/mapEditTypes";

afterEach(() => cleanup());

const toolbar = (overrides: Record<string, unknown> = {}) =>
  ({
    isLive: false,
    busy: false,
    activeSubTool: "wall",
    onSelectSubTool: vi.fn(),
    canUndo: false,
    canRedo: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onStartLiveMap: vi.fn(),
    onClose: vi.fn(),
    error: null,
    ...overrides,
  }) as unknown as MapEditToolbarProps;

const props = (overrides: Record<string, unknown> = {}) => ({
  surface: "none" as MobileSurface,
  onToggleSurface: vi.fn(),
  onToolSelect: vi.fn(),
  onSnapToGridChange: vi.fn(),
  onResetCamera: vi.fn(),
  activeTool: "map-edit" as const,
  snapToGrid: false,
  isDM: true,
  mode: true,
  mapEditToolbarProps: toolbar(),
  onCancelMapEditDrag: vi.fn(),
  ...overrides,
});

const dock = () => screen.getByRole("navigation", { name: /map edit actions/i });

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
    for (const present of [/Exit/, /Tool/, /Undo/, /Redo/, /Abort/]) {
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

  it("Abort is ALWAYS enabled — it is the only cancel a finger has", () => {
    const onCancelMapEditDrag = vi.fn();
    render(<MobileFloatingControls {...props({ onCancelMapEditDrag })} />);

    const cancel = within(dock()).getByRole("button", { name: /Abort/ });
    expect(cancel).toBeEnabled();
    fireEvent.click(cancel);
    expect(onCancelMapEditDrag).toHaveBeenCalledTimes(1);
  });

  it("Abort fires on POINTER DOWN, because its own gesture generates no click", () => {
    // Measured on the real gesture, not reasoned about: with a finger already
    // down on the canvas, a second finger on this button delivers pointerdown,
    // touchstart and touchend — and NO click, because Chromium suppresses the
    // compat click during an active multi-touch sequence. An onClick-only
    // abort therefore did nothing in the one situation it exists for, and the
    // release committed the room anyway (apps/e2e/mobile/mobile-map-edit-abort
    // .spec.ts is the end-to-end half of this).
    const onCancelMapEditDrag = vi.fn();
    render(<MobileFloatingControls {...props({ onCancelMapEditDrag })} />);

    fireEvent.pointerDown(within(dock()).getByRole("button", { name: /Abort/ }));

    expect(onCancelMapEditDrag).toHaveBeenCalledTimes(1);
  });

  it("no OTHER dock slot acts on pointer down", () => {
    // Abort is the exception and should stay one: Exit, Tool, Undo and Redo
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

  describe("once live", () => {
    const live = (overrides: Record<string, unknown> = {}) =>
      props({ surface: "tools", mapEditToolbarProps: toolbar({ isLive: true, ...overrides }) });

    it("offers Room and Wall, and picking one closes the sheet to show the map", () => {
      const bar = toolbar({ isLive: true });
      const onToggleSurface = vi.fn();
      render(
        <MobileFloatingControls
          {...props({ surface: "tools", mapEditToolbarProps: bar, onToggleSurface })}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: /Room/ }));
      expect(bar.onSelectSubTool).toHaveBeenCalledWith("room");
      // You pick a tool in order to USE it, and the tool needs the canvas.
      expect(onToggleSurface).toHaveBeenCalledWith("tools");

      fireEvent.click(screen.getByRole("button", { name: /Wall/ }));
      expect(bar.onSelectSubTool).toHaveBeenCalledWith("wall");
    });

    it("marks the armed sub-tool, so the DM can tell room from wall without dragging", () => {
      render(<MobileFloatingControls {...live({ activeSubTool: "room" })} />);

      expect(screen.getByRole("button", { name: /Room/ }).className).toContain(
        "mobile-tool-sheet__button--active",
      );
      expect(screen.getByRole("button", { name: /Wall/ }).className).not.toContain(
        "mobile-tool-sheet__button--active",
      );
    });

    it("enables Undo and Redo only when the controller has history", () => {
      const { unmount } = render(<MobileFloatingControls {...live()} />);
      expect(within(dock()).getByRole("button", { name: /Undo/ })).toBeDisabled();
      unmount();

      render(<MobileFloatingControls {...live({ canUndo: true, canRedo: true })} />);
      expect(within(dock()).getByRole("button", { name: /Undo/ })).toBeEnabled();
      expect(within(dock()).getByRole("button", { name: /Redo/ })).toBeEnabled();
    });

    it("keeps Recenter reachable — the mode costs the DM the normal tool sheet", () => {
      const onResetCamera = vi.fn();
      const onToggleSurface = vi.fn();
      render(
        <MobileFloatingControls
          {...props({
            surface: "tools",
            mapEditToolbarProps: toolbar({ isLive: true }),
            onResetCamera,
            onToggleSurface,
          })}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: /Recenter/ }));
      expect(onResetCamera).toHaveBeenCalledTimes(1);
      expect(onToggleSurface).toHaveBeenCalledWith("tools");
    });

    it("surfaces a controller error where the DM is looking", () => {
      render(<MobileFloatingControls {...live({ error: "revision conflict" })} />);
      expect(screen.getByRole("alert")).toHaveTextContent("revision conflict");
    });
  });
});
