// The listener: a bare movement key sends ONE transform-object per movable
// selected object, one cell over; the 4.17 guard (typing surface, modifier,
// held key) and map-edit mode make it inert; nothing selected leaves the key
// alone (no preventDefault — arrows still scroll a focused panel); two quick
// presses chain so the second lands two cells over, not one.

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientMessage, RoomSnapshot } from "@herobyte/shared";
import { HOLD_STEP_INTERVAL_MS, useKeyboardMovement } from "../useKeyboardMovement";

function snapshotWith(tokens: Array<{ id: string; owner: string; x: number; y: number }>) {
  return {
    tokens: tokens.map((t) => ({ ...t, color: "hsl(0 0% 0%)" })),
    props: [],
    sceneObjects: [],
  } as unknown as RoomSnapshot;
}

interface HookProps {
  selectedObjectIds: string[];
  snapshot: RoomSnapshot | null;
  isDM: boolean;
  mapEditMode: boolean;
}

function setup(overrides: Partial<HookProps> = {}) {
  const sendMessage = vi.fn<(message: ClientMessage) => void>();
  const initial: HookProps = {
    selectedObjectIds: ["token:mine"],
    snapshot: snapshotWith([
      { id: "mine", owner: "me", x: 3, y: 4 },
      { id: "theirs", owner: "them", x: 7, y: 8 },
    ]),
    isDM: false,
    mapEditMode: false,
    ...overrides,
  };
  const view = renderHook(
    (props: HookProps) => useKeyboardMovement({ ...props, uid: "me", sendMessage }),
    { initialProps: initial },
  );
  return { sendMessage, initial, ...view };
}

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = window) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

function sent(sendMessage: ReturnType<typeof vi.fn>) {
  return sendMessage.mock.calls.map((call) => call[0]) as Array<
    Extract<ClientMessage, { t: "transform-object" }>
  >;
}

describe("useKeyboardMovement", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("d moves the selected token one cell right over transform-object, and swallows the key", () => {
    const { sendMessage } = setup();
    const event = press("d");
    expect(sent(sendMessage)).toEqual([
      { t: "transform-object", id: "token:mine", position: { x: 4, y: 4 } },
    ]);
    expect(event.defaultPrevented).toBe(true);
  });

  it("ArrowUp is one cell up; the diagonal keys are one press each", () => {
    const { sendMessage } = setup();
    press("ArrowUp");
    press("q");
    expect(sent(sendMessage).map((m) => m.position)).toEqual([
      { x: 3, y: 3 },
      // Chained from the pending (3,3): up-left lands on (2,2).
      { x: 2, y: 2 },
    ]);
  });

  it("is inert from a typing surface or with any modifier", () => {
    const { sendMessage } = setup();
    const input = document.createElement("input");
    document.body.appendChild(input);
    press("d", {}, input);
    input.remove();
    press("d", { ctrlKey: true });
    press("d", { metaKey: true });
    press("d", { altKey: true });
    press("D", { shiftKey: true });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("a held key walks at the bounded cadence: repeats inside the interval send nothing", () => {
    // The OS repeats ~every 33 ms; only the repeat that crosses the interval
    // steps, so a one-second hold is ~6 steps, not 30. Swallowed repeats are
    // still preventDefault-ed (the page must not scroll under a walking token).
    const { sendMessage } = setup();
    press("d");
    const swallowed = press("d", { repeat: true });
    expect(swallowed.defaultPrevented).toBe(true);
    vi.setSystemTime(1_000_000 + HOLD_STEP_INTERVAL_MS - 1);
    press("d", { repeat: true });
    expect(sent(sendMessage)).toHaveLength(1);
    vi.setSystemTime(1_000_000 + HOLD_STEP_INTERVAL_MS);
    press("d", { repeat: true });
    expect(sent(sendMessage).map((m) => m.position)).toEqual([
      { x: 4, y: 4 },
      { x: 5, y: 4 },
    ]);
  });

  it("a fresh press is never throttled, even right after a step", () => {
    const { sendMessage } = setup();
    press("d");
    press("d");
    expect(sent(sendMessage)).toHaveLength(2);
  });

  it("is inert in map-edit mode — the DM is authoring, not moving pieces", () => {
    const { sendMessage } = setup({ mapEditMode: true, isDM: true });
    press("d");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("leaves the key alone when nothing movable is selected — arrows keep scrolling", () => {
    const { sendMessage, result } = setup({ selectedObjectIds: ["token:theirs"] });
    expect(result.current.movableCount).toBe(0);
    const event = press("ArrowRight");
    expect(sendMessage).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("a non-movement key is ignored entirely", () => {
    const { sendMessage } = setup();
    const event = press("g");
    expect(sendMessage).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("two quick presses chain: the second lands two cells over, not on the first's cell", () => {
    const { sendMessage } = setup();
    press("d");
    press("d");
    expect(sent(sendMessage).map((m) => m.position)).toEqual([
      { x: 4, y: 4 },
      { x: 5, y: 4 },
    ]);
  });

  it("once the snapshot catches up, the next press starts from it", () => {
    const { sendMessage, rerender, initial } = setup();
    press("d");
    rerender({ ...initial, snapshot: snapshotWith([{ id: "mine", owner: "me", x: 4, y: 4 }]) });
    press("d");
    expect(sent(sendMessage).map((m) => m.position)).toEqual([
      { x: 4, y: 4 },
      { x: 5, y: 4 },
    ]);
  });

  it("a refused step stops chaining after the TTL — the snapshot never moved", () => {
    const { sendMessage } = setup();
    press("d");
    vi.setSystemTime(1_000_000 + 5_000);
    press("d");
    // Both from the snapshot's (3,4): the stale pending step is not trusted.
    expect(sent(sendMessage).map((m) => m.position)).toEqual([
      { x: 4, y: 4 },
      { x: 4, y: 4 },
    ]);
  });

  it("the DM moves every selected token in one press; move() is the d-pad's road to the same", () => {
    const { sendMessage, result } = setup({
      isDM: true,
      selectedObjectIds: ["token:mine", "token:theirs"],
    });
    expect(result.current.movableCount).toBe(2);
    act(() => result.current.move({ dx: 0, dy: 1 }));
    expect(sent(sendMessage)).toEqual([
      { t: "transform-object", id: "token:mine", position: { x: 3, y: 5 } },
      { t: "transform-object", id: "token:theirs", position: { x: 7, y: 9 } },
    ]);
  });

  it("a fractional origin (Snap off) snaps to the nearest cell before stepping", () => {
    const { sendMessage } = setup({
      snapshot: snapshotWith([{ id: "mine", owner: "me", x: 16.97, y: 14.6 }]),
    });
    press("d");
    press("d");
    expect(sent(sendMessage).map((m) => m.position)).toEqual([
      { x: 18, y: 15 },
      // Still chained: the rounded snapshot cell equals the step's `from`.
      { x: 19, y: 15 },
    ]);
  });

  it("removes its listener on unmount", () => {
    const { sendMessage, unmount } = setup();
    unmount();
    press("d");
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
