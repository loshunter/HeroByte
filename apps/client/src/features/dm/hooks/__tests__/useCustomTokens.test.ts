/**
 * useCustomTokens: the shelf is read off the snapshot, and the two messages
 * that change it carry exactly the wire shape — no description key when
 * there is none, so the validator's optional stays optional. An add runs the
 * image pipeline first, so the thumbnail it made (or did not) is what rides
 * the message.
 */

import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { RoomSnapshot } from "@herobyte/shared";
import { useCustomTokens } from "../useCustomTokens";
import type { PreparedCustomImage } from "../../token-library/customTokenImages";

/** The pipeline is proved in its own suite; here it is a stand-in. */
const passthrough = (imageUrl: string) =>
  Promise.resolve<PreparedCustomImage>({ imageUrl, mirrored: false });

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

  it("addToken sends add-custom-token, with the description only when there is one", async () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() =>
      useCustomTokens({ snapshot: null, sendMessage, prepareImage: passthrough }),
    );
    await result.current.addToken({
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
    await result.current.addToken({
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

  it("keeps a copy by default, and only when the caller says otherwise does not", async () => {
    const sendMessage = vi.fn();
    const prepareImage = vi.fn(passthrough);
    const { result } = renderHook(() =>
      useCustomTokens({ snapshot: null, sendMessage, prepareImage }),
    );
    const draft = {
      name: "Old Marta",
      imageUrl: "https://i.imgur.com/x.png",
      tags: [],
      size: "medium" as const,
    };

    await result.current.addToken(draft);
    expect(prepareImage).toHaveBeenLastCalledWith(draft.imageUrl, { mirror: true });
    await result.current.addToken(draft, {});
    expect(prepareImage).toHaveBeenLastCalledWith(draft.imageUrl, { mirror: true });
    await result.current.addToken(draft, { mirror: false });
    expect(prepareImage).toHaveBeenLastCalledWith(draft.imageUrl, { mirror: false });
  });

  it("sends what the pipeline produced, and hands its note back to the form", async () => {
    const sendMessage = vi.fn();
    const prepareImage = vi.fn(async () => ({
      imageUrl: "https://i.imgur.com/x.png",
      mirrored: false,
      thumbUrl: `http://localhost:8788/assets/${"a".repeat(64)}`,
    }));
    const { result } = renderHook(() =>
      useCustomTokens({ snapshot: null, sendMessage, prepareImage }),
    );

    const withThumb = await result.current.addToken({
      name: "Old Marta",
      imageUrl: "https://i.imgur.com/x.png",
      tags: [],
      size: "medium",
    });
    expect(prepareImage).toHaveBeenCalledWith("https://i.imgur.com/x.png", { mirror: true });
    expect(sendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ thumbUrl: `http://localhost:8788/assets/${"a".repeat(64)}` }),
    );
    expect(withThumb).toEqual({});

    // No thumb: the key is ABSENT, not undefined — the validator's optional
    // stays optional, and the picker falls back to the full picture.
    prepareImage.mockResolvedValueOnce({
      imageUrl: "https://i.imgur.com/x.png",
      mirrored: false,
      note: "No thumbnail — that image could not be read.",
    } as never);
    const noThumb = await result.current.addToken({
      name: "Old Marta",
      imageUrl: "https://i.imgur.com/x.png",
      tags: [],
      size: "medium",
    });
    expect(Object.keys(sendMessage.mock.lastCall![0])).not.toContain("thumbUrl");
    expect(noThumb).toEqual({ note: "No thumbnail — that image could not be read." });
  });

  it("removeToken sends remove-custom-token", () => {
    const sendMessage = vi.fn();
    const { result } = renderHook(() =>
      useCustomTokens({ snapshot: null, sendMessage, prepareImage: passthrough }),
    );
    result.current.removeToken("ct-1");
    expect(sendMessage).toHaveBeenCalledWith({ t: "remove-custom-token", id: "ct-1" });
  });
});
