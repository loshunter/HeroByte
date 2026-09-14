// The listener: a bare movement key sends ONE relative step-object naming
// every movable selected object; the 4.17 guard (typing surface, modifier, a
// modal overlay) and map-edit mode make it inert; nothing selected falls back
// to the actor's own token (F4) while the board has the conversation (a bare
// target, the last pointer on the stage, no composing tool) — and where there
// is no single own PC character, or the selection is someone else's piece, the
// key is left alone (no preventDefault — arrows still scroll a focused panel);
// a held key walks at the bounded cadence. There is no client-side chain any more: the server
// resolves every step from its own cell, so N presses are N steps in order.

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientMessage, RoomSnapshot } from "@herobyte/shared";
import { HOLD_STEP_INTERVAL_MS, useKeyboardMovement } from "../useKeyboardMovement";

function snapshotWith(
  tokens: Array<{ id: string; owner: string; x: number; y: number }>,
  characters: Array<{ type: "pc" | "npc"; owner: string; tokenId: string | null }> = [],
) {
  return {
    tokens: tokens.map((t) => ({ ...t, color: "hsl(0 0% 0%)" })),
    props: [],
    sceneObjects: [],
    characters: characters.map((c, i) => ({
      id: `c${i}`,
      name: `c${i}`,
      type: c.type,
      ownedByPlayerUID: c.owner,
      tokenId: c.tokenId,
    })),
  } as unknown as RoomSnapshot;
}

/** The actor's one PC, linked to the token "mine"; "theirs" belongs to someone else. */
const oneHero = () =>
  snapshotWith(
    [
      { id: "mine", owner: "me", x: 3, y: 4 },
      { id: "theirs", owner: "them", x: 7, y: 8 },
    ],
    [{ type: "pc", owner: "me", tokenId: "mine" }],
  );

interface HookProps {
  selectedObjectIds: string[];
  snapshot: RoomSnapshot | null;
  isDM: boolean;
  mapEditMode: boolean;
  toolOwnsKeys: boolean;
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
    toolOwnsKeys: false,
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

/** A pointer landing on `el` (jsdom has no PointerEvent — a plain Event carries the target). */
function pointerDownOn(el: EventTarget) {
  el.dispatchEvent(new Event("pointerdown", { bubbles: true }));
}

/** A stage stand-in: Konva's container div with a canvas inside, mounted in the body. */
function mountStage() {
  const container = document.createElement("div");
  container.className = "konvajs-content";
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  document.body.appendChild(container);
  return { container, canvas, remove: () => container.remove() };
}

function sent(sendMessage: ReturnType<typeof vi.fn>) {
  return sendMessage.mock.calls.map((call) => call[0]) as Array<
    Extract<ClientMessage, { t: "step-object" }>
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

  it("d sends ONE relative step for the selected token, and swallows the key", () => {
    const { sendMessage } = setup();
    const event = press("d");
    expect(sent(sendMessage)).toEqual([{ t: "step-object", ids: ["token:mine"], dx: 1, dy: 0 }]);
    expect(event.defaultPrevented).toBe(true);
  });

  it("every key is its own direction; a burst of presses is a burst of steps in order, never a cell", () => {
    const { sendMessage } = setup();
    press("ArrowUp");
    press("q");
    press("d");
    press("d");
    expect(sent(sendMessage).map((m) => [m.dx, m.dy])).toEqual([
      [0, -1],
      [-1, -1],
      [1, 0],
      [1, 0],
    ]);
    expect(sent(sendMessage).every((m) => !("position" in m))).toBe(true);
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
    const { sendMessage } = setup();
    press("d");
    const swallowed = press("d", { repeat: true });
    expect(swallowed.defaultPrevented).toBe(true);
    vi.setSystemTime(1_000_000 + HOLD_STEP_INTERVAL_MS - 1);
    press("d", { repeat: true });
    expect(sent(sendMessage)).toHaveLength(1);
    vi.setSystemTime(1_000_000 + HOLD_STEP_INTERVAL_MS);
    press("d", { repeat: true });
    expect(sent(sendMessage)).toHaveLength(2);
  });

  it("a fresh press is never throttled, even right after a step", () => {
    const { sendMessage } = setup();
    press("d");
    press("d");
    expect(sent(sendMessage)).toHaveLength(2);
  });

  it("map-edit mode zeroes the movable selection for the d-pad too, not only the keys", () => {
    const { sendMessage, result } = setup({ mapEditMode: true, isDM: true });
    expect(result.current.movableCount).toBe(0);
    press("d");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("a selection the actor may not move leaves the key alone — arrows keep scrolling", () => {
    // On the strong fixture: an own token IS available to a fallback, and a
    // selection of someone else's piece must not reach for it.
    const { sendMessage, result } = setup({
      selectedObjectIds: ["token:theirs"],
      snapshot: oneHero(),
    });
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

  it("a snapshot that moves the token changes nothing about the next press — the server owns the cell", () => {
    const { sendMessage, rerender, initial } = setup();
    press("d");
    rerender({ ...initial, snapshot: snapshotWith([{ id: "mine", owner: "me", x: 9, y: 9 }]) });
    press("d");
    expect(sent(sendMessage)).toEqual([
      { t: "step-object", ids: ["token:mine"], dx: 1, dy: 0 },
      { t: "step-object", ids: ["token:mine"], dx: 1, dy: 0 },
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
      { t: "step-object", ids: ["token:mine", "token:theirs"], dx: 0, dy: 1 },
    ]);
  });

  it("a selection past the wire's cap goes in chunks, none dropped", () => {
    const tokens = Array.from({ length: 70 }, (_, i) => ({ id: `t${i}`, owner: "me", x: 0, y: 0 }));
    const { sendMessage } = setup({
      snapshot: snapshotWith(tokens),
      selectedObjectIds: tokens.map((t) => `token:${t.id}`),
    });
    press("d");
    const messages = sent(sendMessage);
    expect(messages.map((m) => m.ids.length)).toEqual([64, 6]);
    expect(messages.flatMap((m) => m.ids)).toEqual(tokens.map((t) => `token:${t.id}`));
  });

  it("is inert while a full-screen modal is up, and leaves the key to the modal", () => {
    const { sendMessage } = setup();
    const overlay = document.createElement("div");
    overlay.setAttribute("data-modal-overlay", "");
    document.body.appendChild(overlay);
    try {
      const event = press("ArrowDown");
      expect(sendMessage).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    } finally {
      overlay.remove();
    }
    press("ArrowDown");
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("re-registers the listener only when the SET of movable ids changes, not on every snapshot", () => {
    const add = vi.spyOn(window, "addEventListener");
    const { rerender, initial } = setup();
    const keydowns = () => add.mock.calls.filter((c) => c[0] === "keydown").length;
    const before = keydowns();
    rerender({ ...initial, snapshot: snapshotWith([{ id: "mine", owner: "me", x: 4, y: 4 }]) });
    expect(keydowns()).toBe(before);
    // A selection with nothing movable in it deregisters (an EMPTY one would
    // fall back to the own token on a fixture with a character).
    rerender({ ...initial, selectedObjectIds: ["token:theirs"] });
    rerender({ ...initial, selectedObjectIds: ["token:mine"] });
    expect(keydowns()).toBe(before + 1);
    add.mockRestore();
  });

  describe("nothing selected → your own token (F4)", () => {
    it("with nothing selected, d steps the actor's own token and swallows the key", () => {
      const { sendMessage, result } = setup({ selectedObjectIds: [], snapshot: oneHero() });
      expect(result.current.movableCount).toBe(1);
      const event = press("d");
      expect(sent(sendMessage)).toEqual([{ t: "step-object", ids: ["token:mine"], dx: 1, dy: 0 }]);
      expect(event.defaultPrevented).toBe(true);
    });

    it("two PCs of mine and nothing selected: no guess — the key is left alone", () => {
      const twoHeroes = snapshotWith(
        [
          { id: "mine", owner: "me", x: 3, y: 4 },
          { id: "mine2", owner: "me", x: 5, y: 5 },
        ],
        [
          { type: "pc", owner: "me", tokenId: "mine" },
          { type: "pc", owner: "me", tokenId: "mine2" },
        ],
      );
      const { sendMessage, result } = setup({ selectedObjectIds: [], snapshot: twoHeroes });
      expect(result.current.movableCount).toBe(0);
      const event = press("ArrowRight");
      expect(sendMessage).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it("a selection I may not move is not 'nothing' — no fallback, the key is left alone", () => {
      const { sendMessage, result } = setup({
        selectedObjectIds: ["token:theirs"],
        snapshot: oneHero(),
      });
      expect(result.current.movableCount).toBe(0);
      const event = press("ArrowRight");
      expect(sendMessage).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it("the fallback takes a click's road: a locked own token is the DM's alone", () => {
      const locked = {
        ...oneHero(),
        sceneObjects: [{ id: "token:mine", locked: true }],
      } as unknown as RoomSnapshot;
      const player = setup({ selectedObjectIds: [], snapshot: locked });
      expect(player.result.current.movableCount).toBe(0);
      press("d");
      expect(player.sendMessage).not.toHaveBeenCalled();
      player.unmount();
      const dm = setup({ selectedObjectIds: [], snapshot: locked, isDM: true });
      expect(dm.result.current.movableCount).toBe(1);
      press("d");
      expect(sent(dm.sendMessage)).toEqual([
        { t: "step-object", ids: ["token:mine"], dx: 1, dy: 0 },
      ]);
    });

    it("map-edit mode is inert with the fallback too", () => {
      const { sendMessage, result } = setup({
        selectedObjectIds: [],
        snapshot: oneHero(),
        mapEditMode: true,
      });
      expect(result.current.movableCount).toBe(0);
      press("d");
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it("a tool composing on the stage owns the keys: the fallback registers nothing", () => {
      const { sendMessage, result } = setup({
        selectedObjectIds: [],
        snapshot: oneHero(),
        toolOwnsKeys: true,
      });
      expect(result.current.movableCount).toBe(0);
      const event = press("d");
      expect(sendMessage).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it("one PC linked to the SECOND of two owned tokens steps that one, not the first", () => {
      const snap = snapshotWith(
        [
          { id: "spare", owner: "me", x: 1, y: 1 },
          { id: "mine", owner: "me", x: 3, y: 4 },
        ],
        [{ type: "pc", owner: "me", tokenId: "mine" }],
      );
      const { sendMessage } = setup({ selectedObjectIds: [], snapshot: snap });
      press("d");
      expect(sent(sendMessage)).toEqual([{ t: "step-object", ids: ["token:mine"], dx: 1, dy: 0 }]);
    });

    it("a link to a token that is gone is inert — no step, and the key is left alone", () => {
      const stale = snapshotWith(
        [{ id: "mine", owner: "me", x: 3, y: 4 }],
        [{ type: "pc", owner: "me", tokenId: "ghost" }],
      );
      const { sendMessage, result } = setup({ selectedObjectIds: [], snapshot: stale });
      expect(result.current.movableCount).toBe(0);
      const event = press("ArrowRight");
      expect(sendMessage).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it("a DM running only NPCs has no own token to fall back to", () => {
      const dmOnlyNpcs = snapshotWith(
        [{ id: "goblin", owner: "me", x: 3, y: 4 }],
        [{ type: "npc", owner: "", tokenId: "goblin" }],
      );
      const { sendMessage, result } = setup({
        selectedObjectIds: [],
        snapshot: dmOnlyNpcs,
        isDM: true,
      });
      expect(result.current.movableCount).toBe(0);
      const event = press("d");
      expect(sendMessage).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it("a second character arriving mid-session takes the fallback down — the listener is gone", () => {
      const { sendMessage, rerender, initial, result } = setup({
        selectedObjectIds: [],
        snapshot: oneHero(),
      });
      expect(result.current.movableCount).toBe(1);
      const twoHeroes = snapshotWith(
        [
          { id: "mine", owner: "me", x: 3, y: 4 },
          { id: "mine2", owner: "me", x: 5, y: 5 },
        ],
        [
          { type: "pc", owner: "me", tokenId: "mine" },
          { type: "pc", owner: "me", tokenId: "mine2" },
        ],
      );
      rerender({ ...initial, selectedObjectIds: [], snapshot: twoHeroes });
      expect(result.current.movableCount).toBe(0);
      const event = press("d");
      expect(sendMessage).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it("a selection of a kind that cannot step (a drawing) is not 'nothing' either", () => {
      const { sendMessage, result } = setup({
        selectedObjectIds: ["drawing:d1"],
        snapshot: oneHero(),
      });
      expect(result.current.movableCount).toBe(0);
      const event = press("d");
      expect(sendMessage).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    describe("the board must have the conversation", () => {
      it("a pointer landing off the stage hands the keys to that surface; one on the stage takes them back", () => {
        const stage = mountStage();
        const panel = document.createElement("div");
        document.body.appendChild(panel);
        try {
          const { sendMessage } = setup({ selectedObjectIds: [], snapshot: oneHero() });
          pointerDownOn(panel);
          const swallowedNot = press("ArrowDown");
          expect(sendMessage).not.toHaveBeenCalled();
          expect(swallowedNot.defaultPrevented).toBe(false);
          pointerDownOn(stage.canvas);
          const swallowed = press("ArrowDown");
          expect(sent(sendMessage)).toEqual([
            { t: "step-object", ids: ["token:mine"], dx: 0, dy: 1 },
          ]);
          expect(swallowed.defaultPrevented).toBe(true);
        } finally {
          panel.remove();
          stage.remove();
        }
      });

      it("a focused control keeps its arrows: a key whose target is a button is left alone", () => {
        const button = document.createElement("button");
        document.body.appendChild(button);
        try {
          const { sendMessage } = setup({ selectedObjectIds: [], snapshot: oneHero() });
          const event = press("ArrowRight", {}, button);
          expect(sendMessage).not.toHaveBeenCalled();
          expect(event.defaultPrevented).toBe(false);
        } finally {
          button.remove();
        }
      });

      it("a SELECTED piece keeps its reach after a click elsewhere — that road was a deliberate click", () => {
        const panel = document.createElement("div");
        document.body.appendChild(panel);
        try {
          const { sendMessage } = setup();
          pointerDownOn(panel);
          const event = press("d");
          expect(sent(sendMessage)).toEqual([
            { t: "step-object", ids: ["token:mine"], dx: 1, dy: 0 },
          ]);
          expect(event.defaultPrevented).toBe(true);
        } finally {
          panel.remove();
        }
      });
    });
  });

  it("removes its listener on unmount", () => {
    const { sendMessage, unmount } = setup();
    unmount();
    press("d");
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
