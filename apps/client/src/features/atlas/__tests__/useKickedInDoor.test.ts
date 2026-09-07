// The keystroke and the pending state machine: G opens for a DM with no tool
// on the axis and no modifier, and for nobody else; kick() sends ONE atlas-kick
// with five distinct minted ids; the arrival clears (and toasts) even after the
// timeout; a matching atlas-error clears while a foreign one does not; the
// timeout keeps the ids so the re-ROLL is a replay; the dials survive a remount.

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientMessage, RoomSnapshot } from "@herobyte/shared";
import type { ToolMode } from "../../../components/layout/Header";
import {
  KICK_PENDING_TIMEOUT_MS,
  useKickedInDoor,
  type AtlasErrorMessage,
  type KickRequest,
} from "../useKickedInDoor";

const REQUEST: KickRequest = {
  name: "  Cellar  ",
  seed: 77,
  recipe: { recipeId: "dungeon", theme: "wood", density: "low", size: "small" },
  linkType: "stair",
};

const TOOLS: Exclude<ToolMode, null>[] = [
  "pointer",
  "measure",
  "draw",
  "transform",
  "select",
  "align",
  "atlas-link",
  "map-edit",
];

function snapshotWith(currentAtlasNodeId?: string, compiled = true): RoomSnapshot {
  return {
    currentAtlasNodeId,
    compiledScene: compiled ? ({ sourceDocumentId: "doc" } as never) : undefined,
  } as unknown as RoomSnapshot;
}

function setup(
  options: {
    isDM?: boolean;
    tool?: ToolMode;
    snapshot?: RoomSnapshot;
    pendingToast?: boolean;
  } = {},
) {
  const sendMessage = vi.fn<(message: ClientMessage) => void>();
  let toastCounter = 0;
  const toast = {
    info: vi.fn(() => `toast-${++toastCounter}`),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  };
  const atlasErrorRef = { current: null as ((message: AtlasErrorMessage) => void) | null };
  const view = renderHook(
    ({ isDM, tool, snapshot }) =>
      useKickedInDoor({
        isDM,
        snapshot,
        sendMessage,
        activeTool: tool,
        toast,
        atlasErrorRef,
        pendingToast: options.pendingToast,
      }),
    {
      initialProps: {
        isDM: options.isDM ?? true,
        tool: options.tool ?? null,
        snapshot: options.snapshot ?? snapshotWith(undefined),
      },
    },
  );
  return { sendMessage, toast, atlasErrorRef, ...view };
}

function pressG(init: KeyboardEventInit = {}, target: EventTarget = window) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "g", bubbles: true, ...init }));
}

function sentKick(sendMessage: ReturnType<typeof vi.fn>) {
  return sendMessage.mock.calls[0]?.[0] as Extract<ClientMessage, { t: "atlas-kick" }>;
}

describe("useKickedInDoor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom's localStorage in this config is not a full Storage (no clear) —
    // the juiceSettings precedent: install a working one, which also isolates
    // each test from whatever the last one remembered.
    const store: Record<string, string> = {};
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => (key in store ? store[key]! : null),
        setItem: (key: string, value: string) => {
          store[key] = value;
        },
        removeItem: (key: string) => {
          delete store[key];
        },
      },
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("G opens the panel for a DM with no tool armed — and not with a modifier, held, or in a field", () => {
    const { result } = setup();
    expect(result.current.open).toBe(false);
    act(() => pressG({ ctrlKey: true }));
    act(() => pressG({ metaKey: true }));
    act(() => pressG({ altKey: true }));
    act(() => pressG({ shiftKey: true, key: "G" }));
    act(() => pressG({ repeat: true }));
    expect(result.current.open).toBe(false);

    const input = document.createElement("input");
    document.body.appendChild(input);
    act(() => pressG({}, input));
    expect(result.current.open).toBe(false);
    input.remove();

    act(() => pressG());
    expect(result.current.open).toBe(true);
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(result.current.open).toBe(false);
  });

  it("G does nothing for a player", () => {
    const { result } = setup({ isDM: false });
    act(() => pressG());
    expect(result.current.open).toBe(false);
    act(() => result.current.openKick());
    expect(result.current.open).toBe(false);
  });

  it.each(TOOLS)("G does nothing while %s owns the tool axis", (tool) => {
    const { result } = setup({ tool });
    act(() => pressG());
    expect(result.current.open).toBe(false);
  });

  it("kick() sends exactly one atlas-kick with five distinct minted ids, remembers the dials, closes the panel, holds a sticky toast", () => {
    const { result, sendMessage, toast } = setup();
    act(() => result.current.openKick());
    act(() => result.current.kick(REQUEST));

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const message = sentKick(sendMessage);
    expect(message).toMatchObject({
      t: "atlas-kick",
      name: "Cellar",
      seed: 77,
      recipe: REQUEST.recipe,
      linkType: "stair",
    });
    const ids = [
      message.commandId,
      message.nodeId,
      message.originNodeId,
      message.linkId,
      message.returnLinkId,
    ];
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(5);
    expect(result.current.open).toBe(false);
    expect(result.current.pending).toMatchObject({
      nodeId: message.nodeId,
      name: "Cellar",
      expired: false,
    });
    expect(result.current.settings).toEqual({ recipe: REQUEST.recipe, linkType: "stair" });
    expect(toast.info).toHaveBeenCalledWith("🚪 Kicking in the door…", 0);
  });

  it("the dials survive a remount", () => {
    const first = setup();
    act(() => first.result.current.kick(REQUEST));
    first.unmount();
    const second = setup();
    expect(second.result.current.settings).toEqual({ recipe: REQUEST.recipe, linkType: "stair" });
  });

  it("the arrival clears pending, dismisses the sticky toast and names the place", () => {
    const { result, rerender, sendMessage, toast } = setup();
    act(() => result.current.kick(REQUEST));
    const { nodeId } = sentKick(sendMessage);
    // A snapshot that is NOT the arrival keeps it pending (the detection can pass, not only fire).
    rerender({ isDM: true, tool: null, snapshot: snapshotWith("somewhere-else") });
    expect(result.current.pending).not.toBeNull();

    rerender({ isDM: true, tool: null, snapshot: snapshotWith(nodeId) });
    expect(result.current.pending).toBeNull();
    expect(toast.dismiss).toHaveBeenCalledWith("toast-1");
    expect(toast.success).toHaveBeenCalledWith("🚪 Cellar — kicked in");
  });

  it("a matching atlas-error clears pending; a foreign one does not", () => {
    const { result, sendMessage, atlasErrorRef, toast } = setup();
    act(() => result.current.kick(REQUEST));
    const { nodeId } = sentKick(sendMessage);
    act(() =>
      atlasErrorRef.current?.({ t: "atlas-error", code: "rejected", reason: "x", nodeId: "other" }),
    );
    expect(result.current.pending).not.toBeNull();
    act(() => atlasErrorRef.current?.({ t: "atlas-error", code: "rejected", reason: "x", nodeId }));
    expect(result.current.pending).toBeNull();
    expect(toast.dismiss).toHaveBeenCalledWith("toast-1");
    // The ids are dropped: the next kick is a fresh set.
    act(() => result.current.kick(REQUEST));
    expect(sendMessage.mock.calls[1]?.[0]).not.toMatchObject({ nodeId });
  });

  it("the timeout marks pending expired (not cleared), toasts, keeps the ids — and a re-ROLL reuses them; a LATE arrival still lands", () => {
    const { result, rerender, sendMessage, toast } = setup();
    act(() => result.current.kick(REQUEST));
    const first = sentKick(sendMessage);
    act(() => vi.advanceTimersByTime(KICK_PENDING_TIMEOUT_MS));
    expect(result.current.pending).toMatchObject({ nodeId: first.nodeId, expired: true });
    expect(toast.error).toHaveBeenCalledWith("The door didn't budge — ROLL again (same ids)");
    expect(toast.dismiss).toHaveBeenCalledWith("toast-1");

    act(() => result.current.kick(REQUEST));
    const second = sentKick(sendMessage) && (sendMessage.mock.calls[1]![0] as typeof first);
    expect(second.nodeId).toBe(first.nodeId);
    expect(second.commandId).toBe(first.commandId);
    expect(second.linkId).toBe(first.linkId);
    expect(result.current.pending).toMatchObject({ expired: false });

    rerender({ isDM: true, tool: null, snapshot: snapshotWith(first.nodeId) });
    expect(result.current.pending).toBeNull();
    expect(toast.success).toHaveBeenCalledWith("🚪 Cellar — kicked in");
  });

  it("canKick follows the compiled scene; a phone shows no sticky toast", () => {
    const { result, toast } = setup({
      snapshot: snapshotWith(undefined, false),
      pendingToast: false,
    });
    expect(result.current.canKick).toBe(false);
    act(() => result.current.kick(REQUEST));
    expect(toast.info).not.toHaveBeenCalled();
  });
});
