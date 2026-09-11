// The hook: evaluates on the followed piece's box change — whatever moved it
// — on mounting over a piece already under the band, when the band itself
// changes (a resize, a rotation, the sheet growing, combat starting) and
// once after an app-level camera command lands; never on a bare camera
// change; measures the real elements (sheet, surface, combat strip) in the
// SURFACE's frame; merges its command with the app-level one, app first,
// and clears whichever is showing. jsdom has no layout, so the rects are
// stubbed on the elements the hook looks up — the e2e measures the real ones.

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomSnapshot } from "@herobyte/shared";
import type { CameraCommand } from "../../../ui/MapBoard.types";
import { useMovePadCameraFollow } from "../useMovePadCameraFollow";

function snapshotWith(y: number, extra: Partial<RoomSnapshot> = {}) {
  return {
    tokens: [{ id: "mine", owner: "me", x: 3, y, color: "hsl(0 0% 0%)" }],
    props: [],
    sceneObjects: [],
    ...extra,
  } as unknown as RoomSnapshot;
}

/** The surface sits 60px down the viewport, so a conversion that forgets it is 60px off. */
const SURFACE_TOP = 60;

interface Stubs {
  /** The sheet's top in the SURFACE's frame (stage px). */
  sheetTop: number;
  surface?: { width: number; height: number };
  /** The combat strip's bottom in the surface's frame. */
  stripBottom?: number;
}

const rect = (top: number, height: number, width: number) =>
  ({ top, left: 0, width, height, bottom: top + height, right: width }) as DOMRect;

/** Lays the elements out by hand; `sheetTop` can be moved later (a rotation). */
function mountElements({ sheetTop, surface = { width: 375, height: 812 }, stripBottom }: Stubs) {
  const surfaceElement = document.createElement("div");
  surfaceElement.className = "mobile-map-surface";
  surfaceElement.getBoundingClientRect = () => rect(SURFACE_TOP, surface.height, surface.width);
  const sheet = document.createElement("div");
  sheet.className = "mobile-selection-sheet";
  const state = { sheetTop };
  sheet.getBoundingClientRect = () => rect(SURFACE_TOP + state.sheetTop, 300, surface.width);
  document.body.append(surfaceElement, sheet);
  if (stripBottom !== undefined) mountStrip(stripBottom);
  return state;
}

function mountStrip(stripBottom: number) {
  const strip = document.createElement("div");
  strip.className = "mobile-combat-strip";
  strip.getBoundingClientRect = () => rect(SURFACE_TOP + stripBottom - 60, 60, 300);
  document.body.append(strip);
}

interface HookProps {
  active: boolean;
  snapshot: RoomSnapshot | null;
  camera: { x: number; y: number; scale: number };
  appCommand: CameraCommand | null;
  mapEditMode: boolean;
  selectedObjectIds: string[];
  isDM: boolean;
}

function setup(overrides: Partial<HookProps> = {}) {
  const onAppCommandHandled = vi.fn();
  const initial: HookProps = {
    active: true,
    // Cell y=4 → world 225 → screen 225: inside the band (plate ends at 290).
    snapshot: snapshotWith(4),
    camera: { x: 0, y: 0, scale: 1 },
    appCommand: null,
    mapEditMode: false,
    selectedObjectIds: ["token:mine"],
    isDM: false,
    ...overrides,
  };
  const view = renderHook(
    (props: HookProps) =>
      useMovePadCameraFollow({ ...props, gridSize: 50, uid: "me", onAppCommandHandled }),
    { initialProps: initial },
  );
  return { onAppCommandHandled, initial, ...view };
}

// Cell y=9 → world 475 → screen 475, under a sheet at 472; the box [450, 500]
// plus its plate goes a lead inside the band's bottom: 456 − 40 − 25 − 25.
const UNDER_SHEET: CameraCommand = { type: "focus-point", x: 175, y: 475, at: { x: 175, y: 366 } };

describe("useMovePadCameraFollow", () => {
  beforeEach(() => {
    mountElements({ sheetTop: 472 });
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("issues nothing while the piece is inside the band, then a focus-point when a step takes it under the sheet", () => {
    const { result, rerender, initial } = setup();
    expect(result.current.cameraCommand).toBeNull();
    rerender({ ...initial, snapshot: snapshotWith(9) });
    expect(result.current.cameraCommand).toEqual(UNDER_SHEET);
  });

  it("fires on mount when the pad opens over a piece already under the band", () => {
    const { result } = setup({ snapshot: snapshotWith(9) });
    expect(result.current.cameraCommand).toEqual(UNDER_SHEET);
  });

  it("follows only what the actor may move: another player's token is nothing to a player, a piece to the DM", () => {
    const theirs = {
      tokens: [{ id: "theirs", owner: "them", x: 3, y: 9, color: "hsl(0 0% 0%)" }],
      props: [],
      sceneObjects: [],
    } as unknown as RoomSnapshot;
    const { result, rerender, initial } = setup({
      snapshot: theirs,
      selectedObjectIds: ["token:theirs"],
    });
    expect(result.current.cameraCommand).toBeNull();
    rerender({ ...initial, snapshot: theirs, selectedObjectIds: ["token:theirs"], isDM: true });
    expect(result.current.cameraCommand).toEqual(UNDER_SHEET);
  });

  it("does NOT fire on a camera change alone — a finger pan is the player's choice", () => {
    const { result, rerender, initial } = setup();
    rerender({ ...initial, camera: { x: 0, y: 400, scale: 1 } });
    expect(result.current.cameraCommand).toBeNull();
    // But the NEXT step reads the current camera and fires: cell 5 → world
    // 275 → screen 675 under the sheet; recentred at 216 with x kept.
    rerender({ ...initial, camera: { x: 0, y: 400, scale: 1 }, snapshot: snapshotWith(5) });
    expect(result.current.cameraCommand).toEqual({
      type: "focus-point",
      x: 175,
      y: 275,
      at: { x: 175, y: 366 },
    });
  });

  it("re-measures when the band changes under a still piece — a resize, a rotation, the sheet growing", () => {
    // Cell 6 → screen 325, plate to 390: inside a sheet at 472.
    document.body.innerHTML = "";
    const state = mountElements({ sheetTop: 472 });
    // A ResizeObserver that hands its callback back (the setup's is a no-op).
    const observed: Element[] = [];
    let onSheetResize: (() => void) | null = null;
    class CapturingResizeObserver {
      constructor(callback: () => void) {
        onSheetResize = callback;
      }
      observe(element: Element) {
        observed.push(element);
      }
      unobserve() {}
      disconnect() {}
    }
    const realObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = CapturingResizeObserver as unknown as typeof ResizeObserver;
    try {
      const { result } = setup({ snapshot: snapshotWith(6) });
      expect(result.current.cameraCommand).toBeNull();
      expect(observed.map((element) => element.className)).toEqual(["mobile-selection-sheet"]);
      // Band [16, 284] holds 50 + 40 + 50: a lead inside the bottom, 284 − 90.
      const expectedAt300 = {
        type: "focus-point",
        x: 175,
        y: 325,
        at: { x: 175, y: 194 },
      };
      state.sheetTop = 300;
      act(() => {
        window.dispatchEvent(new Event("resize"));
      });
      expect(result.current.cameraCommand).toEqual(expectedAt300);
      act(() => result.current.onCameraCommandHandled());
      act(() => {
        window.dispatchEvent(new Event("orientationchange"));
      });
      expect(result.current.cameraCommand).toEqual(expectedAt300);
      act(() => result.current.onCameraCommandHandled());
      act(() => onSheetResize?.());
      expect(result.current.cameraCommand).toEqual(expectedAt300);
    } finally {
      globalThis.ResizeObserver = realObserver;
    }
  });

  it("stops listening — the SAME handlers, and the observer — when nothing is followed any more, and on unmount", () => {
    const added = vi.spyOn(window, "addEventListener");
    const removed = vi.spyOn(window, "removeEventListener");
    const disconnect = vi.fn();
    class ObservingResizeObserver {
      observe() {}
      unobserve() {}
      disconnect = disconnect;
    }
    const realObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = ObservingResizeObserver as unknown as typeof ResizeObserver;
    try {
      const { rerender, initial, unmount } = setup();
      const handlers = added.mock.calls
        .filter(([name]) => name === "resize" || name === "orientationchange")
        .map(([name, handler]) => [name, handler]);
      expect(handlers).toHaveLength(2);
      // The target goes away (nothing selected): the listeners go with it.
      rerender({ ...initial, selectedObjectIds: [] });
      for (const [name, handler] of handlers) {
        expect(removed).toHaveBeenCalledWith(name, handler);
      }
      expect(disconnect).toHaveBeenCalledTimes(1);
      // And unmounting while following tears down too.
      removed.mockClear();
      rerender({ ...initial });
      unmount();
      expect(removed.mock.calls.map((call) => call[0])).toEqual(
        expect.arrayContaining(["resize", "orientationchange"]),
      );
      expect(disconnect).toHaveBeenCalledTimes(2);
    } finally {
      globalThis.ResizeObserver = realObserver;
      added.mockRestore();
      removed.mockRestore();
    }
  });

  it("the combat strip's bottom bounds the band from above, in the SURFACE's frame", () => {
    document.body.innerHTML = "";
    mountElements({ sheetTop: 472, stripBottom: 80 });
    // Cell 1 → screen 75: its top edge at 50 is under a strip ending at 80.
    const { result } = setup({ snapshot: snapshotWith(1) });
    // Under the strip's edge at 96: a lead inside it, 96 + 25 + 25.
    expect(result.current.cameraCommand).toEqual({
      type: "focus-point",
      x: 175,
      y: 75,
      at: { x: 175, y: 146 },
    });
  });

  it("combat starting is a trigger: the strip appears over a still piece", () => {
    const { result, rerender, initial } = setup({ snapshot: snapshotWith(1) });
    expect(result.current.cameraCommand).toBeNull();
    mountStrip(80);
    rerender({ ...initial, snapshot: snapshotWith(1, { combatActive: true }) });
    expect(result.current.cameraCommand).toMatchObject({ type: "focus-point", y: 75 });
  });

  it("is inert while inactive or in map-edit mode, and a heartbeat (same cell, new snapshot object) re-issues nothing", () => {
    const { result, rerender, initial } = setup({ active: false, snapshot: snapshotWith(9) });
    expect(result.current.cameraCommand).toBeNull();
    rerender({ ...initial, active: true, mapEditMode: true, snapshot: snapshotWith(9) });
    expect(result.current.cameraCommand).toBeNull();
    rerender({ ...initial, active: true });
    expect(result.current.cameraCommand).not.toBeNull();
    act(() => result.current.onCameraCommandHandled());
    expect(result.current.cameraCommand).toBeNull();
    rerender({ ...initial, active: true, snapshot: snapshotWith(9) });
    expect(result.current.cameraCommand).toBeNull();
  });

  it("an app-level command goes FIRST; the follow's own is dropped and re-evaluated once that command has moved the camera", () => {
    const app: CameraCommand = { type: "reset" };
    const { result, rerender, initial, onAppCommandHandled } = setup({ appCommand: app });
    expect(result.current.cameraCommand).toBe(app);
    // A step under the sheet while the app command is still pending.
    rerender({ ...initial, appCommand: app, snapshot: snapshotWith(9) });
    expect(result.current.cameraCommand).toBe(app);
    act(() => result.current.onCameraCommandHandled());
    expect(onAppCommandHandled).toHaveBeenCalledTimes(1);
    // The app cleared its command; the follow has nothing queued yet …
    rerender({ ...initial, appCommand: null, snapshot: snapshotWith(9) });
    expect(result.current.cameraCommand).toBeNull();
    // … until the camera lands where the app command put it: one evaluation.
    rerender({
      ...initial,
      appCommand: null,
      snapshot: snapshotWith(9),
      camera: { x: 0, y: 0, scale: 1 },
    });
    expect(result.current.cameraCommand).toEqual(UNDER_SHEET);
    act(() => result.current.onCameraCommandHandled());
    expect(onAppCommandHandled).toHaveBeenCalledTimes(1);
    expect(result.current.cameraCommand).toBeNull();
    // A later camera change alone is a pan again: nothing.
    rerender({
      ...initial,
      appCommand: null,
      snapshot: snapshotWith(9),
      camera: { x: 0, y: 5, scale: 1 },
    });
    expect(result.current.cameraCommand).toBeNull();
  });

  it("an app command that moved nothing is forgotten on the next frame, never banked against the next pan", async () => {
    const app: CameraCommand = { type: "reset" };
    const { result, rerender, initial } = setup({ appCommand: app, snapshot: snapshotWith(9) });
    act(() => result.current.onCameraCommandHandled());
    rerender({ ...initial, appCommand: null, snapshot: snapshotWith(9) });
    expect(result.current.cameraCommand).toBeNull();
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    });
    // The camera changes later — a pan: the follow must not fire from the stale arm.
    rerender({
      ...initial,
      appCommand: null,
      snapshot: snapshotWith(9),
      camera: { x: 0, y: 5, scale: 1 },
    });
    expect(result.current.cameraCommand).toBeNull();
  });

  it("measures the REAL sheet top: a taller sheet (a DM's Lock/Unlock row) covers more", () => {
    document.body.innerHTML = "";
    mountElements({ sheetTop: 300 });
    // Cell 5 → screen 275, plate to 340: under a sheet at 300, clear of 472.
    const { result } = setup({ snapshot: snapshotWith(5) });
    expect(result.current.cameraCommand).toEqual({
      type: "focus-point",
      x: 175,
      y: 275,
      at: { x: 175, y: 194 },
    });
  });

  it("does nothing when the elements are not in the DOM, or not laid out yet (a zero-size surface)", () => {
    document.body.innerHTML = "";
    expect(setup({ snapshot: snapshotWith(9) }).result.current.cameraCommand).toBeNull();
    document.body.innerHTML = "";
    mountElements({ sheetTop: 472, surface: { width: 0, height: 0 } });
    expect(setup({ snapshot: snapshotWith(9) }).result.current.cameraCommand).toBeNull();
  });
});
