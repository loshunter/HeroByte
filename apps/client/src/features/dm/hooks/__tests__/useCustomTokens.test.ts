/**
 * useCustomTokens: the shelf is read off the snapshot, and the two messages
 * that change it carry exactly the wire shape — no description key when
 * there is none, so the validator's optional stays optional.
 */

import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { RoomSnapshot } from "@herobyte/shared";
import { useCustomTokens } from "../useCustomTokens";

const token = {
  id: "ct-1",
  name: "Old Marta",
  imageUrl: "https://i.imgur.com/x.png",
  tags: ["npc", "villager"],
  size: "medium",
  addedBy: "dm",
  addedAt: 1,
};

describe("useCustomTokens", () => {
  it("reads the shelf off the snapshot, and an absent one is an empty list", () => {
    const sendMessage = vi.fn();
    const withShelf = renderHook(() =>
      useCustomTokens({
        snapshot: { customTokens: [token] } as unknown as RoomSnapshot,
        sendMessage,
      }),
    );
    expect(withShelf.result.current.tokens).toEqual([token]);
    const without = renderHook(() =>
      useCustomTokens({ snapshot: {} as unknown as RoomSnapshot, sendMessage }),
    );
    expect(without.result.current.tokens).toEqual([]);
    const none = renderHook(() => useCustomTokens({ snapshot: null, sendMessage }));
    expect(none.result.current.tokens).toEqual([]);
  });

  it("addToken sends add-custom-token, with the description only when there is one", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useCustomTokens({ snapshot: null, sendMessage }));
    result.current.addToken({
      name: "Old Marta",
      imageUrl: "https://i.imgur.com/x.png",
      tags: ["npc"],
      size: "small",
    });
    expect(sendMessage).toHaveBeenLastCalledWith({
      t: "add-custom-token",
      name: "Old Marta",
      imageUrl: "https://i.imgur.com/x.png",
      tags: ["npc"],
      size: "small",
    });
    result.current.addToken({
      name: "Ogre",
      imageUrl: "https://x/o.png",
      description: "Big.",
      tags: [],
      size: "large",
    });
    expect(sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ t: "add-custom-token", description: "Big.", size: "large" }),
    );
  });

  it("removeToken sends remove-custom-token", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() => useCustomTokens({ snapshot: null, sendMessage }));
    result.current.removeToken("ct-1");
    expect(sendMessage).toHaveBeenCalledWith({ t: "remove-custom-token", id: "ct-1" });
  });
});
