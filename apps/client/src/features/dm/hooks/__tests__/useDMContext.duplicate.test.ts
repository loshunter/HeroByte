/**
 * Tests for duplicateNpc (S8).
 *
 * There is no "duplicate-npc" message and deliberately so: the server already
 * numbers a colliding name, so a copy is just a create whose base name is the
 * original's. What is worth pinning is that the copy actually carries the
 * original's stats and art — a duplicate that silently drops the token image
 * looks like it worked.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { RoomSnapshot } from "@herobyte/shared";
import { useDMContext } from "../useDMContext";

afterEach(() => vi.useRealTimers());

const snapshot = {
  characters: [
    {
      id: "npc-1",
      type: "npc",
      name: "Goblin 3",
      hp: 4,
      maxHp: 7,
      portrait: "goblin.png",
      tokenImage: "goblin-token.png",
    },
    { id: "npc-2", type: "npc", name: "Orc", hp: 12, maxHp: 12 },
  ],
} as unknown as RoomSnapshot;

function setup(snap: RoomSnapshot | null = snapshot) {
  const sendMessage = vi.fn();
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
  const { result } = renderHook(() =>
    useDMContext({
      snapshot: snap,
      sendMessage,
      cameraState: { x: 0, y: 0, scale: 1 },
      // The session hook only needs the shape; nothing here exercises toasts.
      toast: toast as never,
    }),
  );
  return { result, sendMessage };
}

describe("useDMContext.duplicateNpc", () => {
  it("replays the source NPC's fields through create-npc", () => {
    const { result, sendMessage } = setup();

    act(() => result.current.npcManagement.duplicateNpc("npc-1"));

    expect(sendMessage).toHaveBeenCalledWith({
      t: "create-npc",
      // The SERVER renumbers this; sending the original's name is what tells
      // it which series the copy belongs to.
      name: "Goblin 3",
      hp: 4,
      maxHp: 7,
      portrait: "goblin.png",
      tokenImage: "goblin-token.png",
    });
  });

  it("does not invent art the original did not have", () => {
    const { result, sendMessage } = setup();

    act(() => result.current.npcManagement.duplicateNpc("npc-2"));

    const sent = sendMessage.mock.calls[0][0];
    expect(sent).toMatchObject({ t: "create-npc", name: "Orc", hp: 12, maxHp: 12 });
    expect(sent.portrait).toBeUndefined();
    expect(sent.tokenImage).toBeUndefined();
  });

  it("sends nothing for an id that is not at the table", () => {
    const { result, sendMessage } = setup();

    act(() => result.current.npcManagement.duplicateNpc("does-not-exist"));

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("sends nothing when there is no snapshot yet", () => {
    const { result, sendMessage } = setup(null);

    act(() => result.current.npcManagement.duplicateNpc("npc-1"));

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("never asks for more than one copy", () => {
    const { result, sendMessage } = setup();

    act(() => result.current.npcManagement.duplicateNpc("npc-1"));

    expect(sendMessage.mock.calls[0][0].count).toBeUndefined();
  });
});
