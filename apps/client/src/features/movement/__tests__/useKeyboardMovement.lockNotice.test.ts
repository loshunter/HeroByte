// A movement key on a piece only the lock holds still used to do nothing at all:
// the step was never sent (the server would refuse it), so no refusal came back to
// explain it. Now the press says so (lockNotice → App's toast) — once per press,
// not once per key repeat — and a key that was never the actor's stays silent.

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientMessage, RoomSnapshot } from "@herobyte/shared";
import { useKeyboardMovement } from "../useKeyboardMovement";
import { onLockNotice } from "../../locking/lockNotice";

const table = (locked: boolean) =>
  ({
    tokens: [
      { id: "mine", owner: "me", x: 3, y: 4, color: "#000" },
      { id: "theirs", owner: "them", x: 7, y: 8, color: "#000" },
    ],
    props: [],
    sceneObjects: [
      { id: "token:mine", locked },
      { id: "token:theirs", locked: true },
    ],
    characters: [{ id: "c0", name: "c0", type: "pc", ownedByPlayerUID: "me", tokenId: "mine" }],
  }) as unknown as RoomSnapshot;

function mount(selectedObjectIds: string[], snapshot: RoomSnapshot, isDM = false) {
  const sendMessage = vi.fn<(message: ClientMessage) => void>();
  renderHook(() =>
    useKeyboardMovement({
      selectedObjectIds,
      snapshot,
      uid: "me",
      isDM,
      mapEditMode: false,
      selectionTool: false,
      composingTool: false,
      sendMessage,
    }),
  );
  return sendMessage;
}

function press(key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key,
    code: key.startsWith("Arrow") ? key : undefined,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  window.dispatchEvent(event);
  return event;
}

describe("a movement key on a locked piece says why", () => {
  let heard: (string | undefined)[];
  let off: () => void;
  beforeEach(() => {
    heard = [];
    off = onLockNotice((message) => heard.push(message));
  });
  afterEach(() => off());

  it("the player's own locked token (nothing selected): one notice per press, none per repeat", () => {
    const sendMessage = mount([], table(true));
    expect(press("ArrowRight").defaultPrevented).toBe(true);
    press("ArrowRight", { repeat: true });
    press("ArrowRight", { repeat: true });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(heard).toEqual([undefined]);
    press("ArrowLeft");
    expect(heard).toHaveLength(2);
  });

  it("the DM with a locked token selected is told too", () => {
    const sendMessage = mount(["token:theirs"], table(false), true);
    press("d");
    expect(sendMessage).not.toHaveBeenCalled();
    expect(heard).toEqual([undefined]);
  });

  it("someone else's locked token is not the player's to move: the key stays silent and free", () => {
    const sendMessage = mount(["token:theirs"], table(false));
    expect(press("ArrowRight").defaultPrevented).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(heard).toEqual([]);
  });

  it("control: unlocked, the press steps the token and says nothing", () => {
    const sendMessage = mount([], table(false));
    press("ArrowRight");
    expect(sendMessage).toHaveBeenCalledWith({
      t: "step-object",
      ids: ["token:mine"],
      dx: 1,
      dy: 0,
    });
    expect(heard).toEqual([]);
  });
});
