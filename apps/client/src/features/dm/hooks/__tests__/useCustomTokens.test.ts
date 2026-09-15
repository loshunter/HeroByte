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
import { CUSTOM_TOKEN_LIMITS } from "@herobyte/shared";
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

const draft = {
  name: "Old Marta",
  imageUrl: "https://i.imgur.com/x.png",
  tags: [] as string[],
  size: "medium" as const,
};

/**
 * A hook wired to a shelf that behaves like the server: an accepted add grows
 * it, which is the signal the hook waits on. `accept: false` is every silent
 * refusal — a validator rejection, the 200-token cap, a revoked DM role, a
 * dropped socket — which the wire reports identically, i.e. not at all.
 *
 * The shelf array is MUTATED rather than replaced, because the hook holds it
 * by reference to read the latest length from inside an in-flight add.
 */
function setup(options: { accept?: boolean; shelf?: unknown[]; prepareImage?: unknown } = {}) {
  const accept = options.accept !== false;
  const shelf = (options.shelf ?? []) as Record<string, unknown>[];
  const sendMessage = vi.fn((message: { t: string }) => {
    if (message.t === "add-custom-token" && accept)
      shelf.push({ ...token, id: `ct-${shelf.length}` });
  });
  const { result } = renderHook(() =>
    useCustomTokens({
      snapshot: { customTokens: shelf } as unknown as RoomSnapshot,
      sendMessage,
      prepareImage: (options.prepareImage ?? passthrough) as never,
      // Short, so the refusal path costs the suite 60ms rather than 5s.
      confirmTimeoutMs: 60,
    }),
  );
  return { result, sendMessage, shelf };
}

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
    const { result, sendMessage } = setup();
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
    const prepareImage = vi.fn(passthrough);
    const { result } = setup({ prepareImage });

    await result.current.addToken(draft);
    expect(prepareImage).toHaveBeenLastCalledWith(draft.imageUrl, { mirror: true });
    await result.current.addToken(draft, {});
    expect(prepareImage).toHaveBeenLastCalledWith(draft.imageUrl, { mirror: true });
    await result.current.addToken(draft, { mirror: false });
    expect(prepareImage).toHaveBeenLastCalledWith(draft.imageUrl, { mirror: false });
  });

  it("confirms a copy that was made — the one outcome the DM asked for by hand", async () => {
    const prepareImage = vi.fn(async () => ({
      imageUrl: `/assets/${"b".repeat(64)}`,
      thumbUrl: `/assets/${"c".repeat(64)}`,
      mirrored: true,
    }));
    const { result } = setup({ prepareImage });

    const copied = await result.current.addToken({
      name: "Old Marta",
      imageUrl: "https://i.imgur.com/x.png",
      tags: [],
      size: "medium",
    });
    expect(copied.note).toMatch(/copy .* is kept on this table/i);

    // And stays silent when there was nothing to copy.
    prepareImage.mockResolvedValueOnce({
      imageUrl: "/tokens/NPC/x.png",
      mirrored: false,
    } as never);
    const untouched = await result.current.addToken({
      name: "Goblin",
      imageUrl: "/tokens/NPC/x.png",
      tags: [],
      size: "medium",
    });
    expect(untouched).toEqual({ added: true });
  });

  it("sends what the pipeline produced, and hands its note back to the form", async () => {
    const prepareImage = vi.fn(async () => ({
      imageUrl: "https://i.imgur.com/x.png",
      mirrored: false,
      thumbUrl: `http://localhost:8788/assets/${"a".repeat(64)}`,
    }));
    const { result, sendMessage } = setup({ prepareImage });

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
    expect(withThumb).toEqual({ added: true });

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
    expect(noThumb).toEqual({ added: true, note: "No thumbnail — that image could not be read." });
  });

  it("removeToken sends remove-custom-token", () => {
    const { result, sendMessage } = setup();
    result.current.removeToken("ct-1");
    expect(sendMessage).toHaveBeenCalledWith({ t: "remove-custom-token", id: "ct-1" });
  });

  it("sees the shelf grow the way the WIRE grows it: a new array on a new snapshot", async () => {
    // The helper above mutates one array in place, which no real snapshot ever
    // does — `snapshot.customTokens` is freshly deserialized per broadcast. If
    // the watcher could only see in-place growth it would time out on every
    // successful add in production while every unit test stayed green. This is
    // the test that would have caught that.
    let shelf: unknown[] = [];
    const sendMessage = vi.fn();
    const { result, rerender } = renderHook(() =>
      useCustomTokens({
        snapshot: { customTokens: shelf } as unknown as RoomSnapshot,
        sendMessage,
        prepareImage: passthrough as never,
        confirmTimeoutMs: 2000,
      }),
    );

    const pending = result.current.addToken(draft);
    // The server answers: a whole new snapshot, holding a DIFFERENT array.
    shelf = [token];
    rerender();

    await expect(pending).resolves.toEqual({ added: true });
  });

  it("says so when the table does not take the token, instead of looking like a success", async () => {
    // Every refusal reaches the client the same way: not at all. The add is
    // fire-and-forget with no commandId, a validator rejection is a
    // server-side log, and the cap refusal is a console.warn — so an add that
    // vanished used to render exactly like one that worked.
    const { result, sendMessage } = setup({ accept: false });

    const refused = await result.current.addToken(draft);
    expect(sendMessage).toHaveBeenCalled();
    expect(refused.note).toMatch(/did not take that token/i);
  });

  it("refuses an address the wire would drop BEFORE it spends two uploads on it", async () => {
    const prepareImage = vi.fn(passthrough);
    const { result, sendMessage } = setup({ prepareImage });

    for (const imageUrl of ["goblin.png", "http://example.com/x.png", "data:image/png;base64,AA"]) {
      const result_ = await result.current.addToken({ ...draft, imageUrl });
      expect(result_.note, imageUrl).toMatch(/cannot be used/i);
    }
    // Not one upload rendered, not one message sent.
    expect(prepareImage).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("refuses at the cap, before the uploads, and names the number", async () => {
    const full = Array.from({ length: CUSTOM_TOKEN_LIMITS.COUNT_MAX }, (_, i) => ({
      ...token,
      id: `ct-${i}`,
    }));
    const prepareImage = vi.fn(passthrough);
    const { result, sendMessage } = setup({ shelf: full, prepareImage });

    const refused = await result.current.addToken(draft);
    expect(refused.note).toContain(String(CUSTOM_TOKEN_LIMITS.COUNT_MAX));
    expect(prepareImage).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
