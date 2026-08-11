/**
 * The one owner of "which mobile surface is open", and — since M4c — of what
 * happens when the map-edit MODE crosses its boundary.
 *
 * The invariant M4a bought (at most one surface, by construction rather than
 * by four callbacks remembering) is asserted through MobileLayout, against
 * mounted `data-mobile-surface` roots. These tests are the machine's own:
 * they cover the arbitration the rendered tree cannot show, notably that the
 * mode edge clears the surface without a caller having to remember to.
 */
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMobileSurface, type UseMobileSurfaceOptions } from "../useMobileSurface";

function options(overrides: Partial<UseMobileSurfaceOptions> = {}): UseMobileSurfaceOptions {
  return {
    diceRollerOpen: false,
    rollLogOpen: false,
    toggleDiceRoller: vi.fn(),
    toggleRollLog: vi.fn(),
    mapEditMode: false,
    alignmentMode: false,
    ...overrides,
  };
}

describe("useMobileSurface — the map-edit mode boundary", () => {
  it("arming the mode closes whatever surface was covering the map", () => {
    const { result, rerender } = renderHook(
      (current: UseMobileSurfaceOptions) => useMobileSurface(current),
      { initialProps: options() },
    );

    // The DM arms map-edit FROM the DM screen, which is a full-height opaque
    // cover. Without this the mode would arm behind it.
    act(() => result.current.openSurface("dm"));
    expect(result.current.surface).toBe("dm");

    rerender(options({ mapEditMode: true }));

    expect(result.current.surface).toBe("none");
    expect(result.current.mode).toBe(true);
  });

  it("leaving the mode clears the surface too — Exit never drops you into a stale sheet", () => {
    const { result, rerender } = renderHook(
      (current: UseMobileSurfaceOptions) => useMobileSurface(current),
      { initialProps: options({ mapEditMode: true }) },
    );

    act(() => result.current.openSurface("tools"));
    expect(result.current.surface).toBe("tools");

    rerender(options({ mapEditMode: false }));

    expect(result.current.surface).toBe("none");
    expect(result.current.mode).toBe(false);
  });

  it("does NOT close a sheet opened while the mode stays armed", () => {
    // The edge latch, not the value. A naive `if (mapEditMode) close()` would
    // slam the tool sheet shut on the render after it opened, and the palette
    // would be unusable while looking perfectly wired.
    const { result, rerender } = renderHook(
      (current: UseMobileSurfaceOptions) => useMobileSurface(current),
      { initialProps: options({ mapEditMode: true }) },
    );

    act(() => result.current.openSurface("tools"));
    rerender(options({ mapEditMode: true }));
    rerender(options({ mapEditMode: true }));

    expect(result.current.surface).toBe("tools");
  });

  it("survives an unrelated prop identity change mid-mode", () => {
    // closeSurface's identity moves whenever the dice/log props do. If the
    // effect depended on it rather than on the mode, this would close the
    // sheet the DM just opened.
    const { result, rerender } = renderHook(
      (current: UseMobileSurfaceOptions) => useMobileSurface(current),
      { initialProps: options({ mapEditMode: true }) },
    );

    act(() => result.current.openSurface("tools"));
    rerender(options({ mapEditMode: true, toggleDiceRoller: vi.fn(), toggleRollLog: vi.fn() }));

    expect(result.current.surface).toBe("tools");
  });

  it("arming ALIGNMENT clears the surface too, without re-purposing the dock", () => {
    // M4b's recorded gap: arming worked from the DM screen but capturing needs
    // the map, so the DM had to close, tap two points, and reopen. Alignment
    // is not a Mode — its controls live in the menu you come back to — but it
    // shares the one property the edge cares about.
    const { result, rerender } = renderHook(
      (current: UseMobileSurfaceOptions) => useMobileSurface(current),
      { initialProps: options() },
    );

    act(() => result.current.openSurface("dm"));
    rerender(options({ alignmentMode: true }));

    expect(result.current.surface).toBe("none");
    // The dock is NOT swapped: `mode` is map-edit's alone.
    expect(result.current.mode).toBe(false);
  });

  it("DISARMING alignment leaves the menu alone — its Cancel lives inside it", () => {
    // The asymmetry that matters: leaving map-edit clears (below), leaving
    // alignment must not. A DM who presses Cancel in the wizard is still in
    // the menu and did not ask to be thrown out of it.
    const { result, rerender } = renderHook(
      (current: UseMobileSurfaceOptions) => useMobileSurface(current),
      { initialProps: options({ alignmentMode: true }) },
    );

    act(() => result.current.openSurface("dm"));
    rerender(options({ alignmentMode: false }));

    expect(result.current.surface).toBe("dm");
  });

  it("arming ALIGNMENT on top of map-edit leaves the mode's own sheet open", () => {
    // Alignment arming is not a reason to shut the palette's sheet: the DM is
    // already looking at the map, which is the whole point of the edge.
    const { result, rerender } = renderHook(
      (current: UseMobileSurfaceOptions) => useMobileSurface(current),
      { initialProps: options({ mapEditMode: true }) },
    );

    act(() => result.current.openSurface("tools"));
    rerender(options({ mapEditMode: true, alignmentMode: true }));

    expect(result.current.surface).toBe("tools");
  });

  it("arming MAP-EDIT on top of alignment still clears — the OR has no rising edge", () => {
    // The review's finding. `needsTheMap` is already true because alignment is
    // armed, so a rising-edge-of-the-OR rule sees nothing happen — and the DM
    // screen the mode was armed FROM stays over the canvas, palette live and
    // invisible underneath it. Entering the mode is its own edge.
    const { result, rerender } = renderHook(
      (current: UseMobileSurfaceOptions) => useMobileSurface(current),
      { initialProps: options({ alignmentMode: true }) },
    );

    // The DM armed alignment, the screen closed, and they reopened it — which
    // is the ordinary way back to Apply.
    act(() => result.current.openSurface("dm"));
    expect(result.current.surface).toBe("dm");

    rerender(options({ alignmentMode: true, mapEditMode: true }));

    expect(result.current.surface).toBe("none");
    expect(result.current.mode).toBe(true);
  });

  it("tracks the mode ACROSS a full enter-and-exit, not just from mount", () => {
    // Enter, open the mode's sheet, leave. Every other test here starts on the
    // side it is about, so the latch is right by accident even if it never
    // advances — measured: freezing both refs left all of them green. This one
    // starts OUTSIDE the mode, so the exit edge can only be seen by a ref that
    // moved when the mode was armed.
    const { result, rerender } = renderHook(
      (current: UseMobileSurfaceOptions) => useMobileSurface(current),
      { initialProps: options() },
    );

    rerender(options({ mapEditMode: true }));
    act(() => result.current.openSurface("tools"));
    expect(result.current.surface).toBe("tools");

    rerender(options({ mapEditMode: false }));

    expect(result.current.surface).toBe("none");
  });

  it("mounting already in the mode is not an edge", () => {
    const toggleRollLog = vi.fn();
    const { result } = renderHook(() =>
      useMobileSurface(options({ mapEditMode: true, rollLogOpen: true, toggleRollLog })),
    );

    // A remount inside the mode must not fight the App-level panel state; the
    // derived value already reports it, and closing it here would be the
    // machine picking a fight nobody asked for.
    expect(result.current.surface).toBe("log");
    expect(toggleRollLog).not.toHaveBeenCalled();
  });
});
